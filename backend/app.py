from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import os
import socket

app = Flask(__name__)
CORS(app)


# ── Database connection ───────────────────────────────────────────────
def get_db():
    """
    Creates a new database connection on every request.
    Reads config from environment variables so the same code
    works locally (Docker PostgreSQL) and in production (AWS RDS).
    """
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "database"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "taskdb"),
        user=os.getenv("DB_USER", "taskuser"),
        password=os.getenv("DB_PASSWORD", "localpassword"),
        cursor_factory=psycopg2.extras.RealDictCursor
    )


# ── Health endpoints ──────────────────────────────────────────────────
@app.route("/api/health")
def health():
    """Liveness probe — Kubernetes restarts container if this fails"""
    return jsonify({
        "status": "healthy",
        "service": "task-manager-backend",
        "version": os.getenv("APP_VERSION", "1.0.0")
    }), 200

@app.route("/api/health")
def simple_health():
    return {"status": "ok"}, 200

@app.route("/")
def home():
    return {"message": "Backend is running"}

    
@app.route("/api/ready")
def ready():
    """
    Readiness probe — Kubernetes stops sending traffic if this fails.
    Checks real database connectivity so pod is only ready when
    it can actually serve requests.
    """
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        return jsonify({
            "status": "ready",
            "database": "connected",
            "host": socket.gethostname()
        }), 200
    except Exception as e:
        return jsonify({
            "status": "not ready",
            "database": "disconnected",
            "error": str(e)
        }), 503


@app.route("/api/info")
def info():
    """Returns metadata about this running instance"""
    return jsonify({
        "service": "task-manager-backend",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "environment": os.getenv("ENV", "production"),
        "hostname": socket.gethostname(),
        "db_host": os.getenv("DB_HOST", "unknown")
    })


# ── Tasks CRUD ────────────────────────────────────────────────────────
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    """Get all tasks — supports filtering by status"""
    try:
        status = request.args.get("status")  # optional filter

        conn = get_db()
        cur = conn.cursor()

        if status:
            cur.execute(
                """
                SELECT id, title, description, status, priority, created_at, updated_at
                FROM tasks
                WHERE status = %s
                ORDER BY created_at DESC
                """,
                (status,)
            )
        else:
            cur.execute(
                """
                SELECT id, title, description, status, priority, created_at, updated_at
                FROM tasks
                ORDER BY created_at DESC
                """
            )

        tasks = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify([dict(t) for t in tasks]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks", methods=["POST"])
def create_task():
    """Create a new task"""
    try:
        data = request.get_json()

        if not data or not data.get("title"):
            return jsonify({"error": "title is required"}), 400

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO tasks (title, description, status, priority)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, description, status, priority, created_at
            """,
            (
                data["title"],
                data.get("description", ""),
                data.get("status", "pending"),
                data.get("priority", "medium")
            )
        )

        task = dict(cur.fetchone())
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(task), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    """Update a task's status or details"""
    try:
        data = request.get_json()

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE tasks
            SET title = COALESCE(%s, title),
                description = COALESCE(%s, description),
                status = COALESCE(%s, status),
                priority = COALESCE(%s, priority),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, title, description, status, priority, updated_at
            """,
            (
                data.get("title"),
                data.get("description"),
                data.get("status"),
                data.get("priority"),
                task_id
            )
        )

        task = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if task:
            return jsonify(dict(task)), 200
        return jsonify({"error": "Task not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    """Delete a task by ID"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM tasks WHERE id = %s RETURNING id", (task_id,))
        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if deleted:
            return jsonify({"message": f"Task {task_id} deleted"}), 200
        return jsonify({"error": "Task not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Stats endpoint ────────────────────────────────────────────────────
@app.route("/api/stats")
def get_stats():
    """Returns task statistics — used by the frontend dashboard"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
                COUNT(*) FILTER (WHERE status = 'done') AS done,
                COUNT(*) FILTER (WHERE priority = 'high') AS high_priority
            FROM tasks
            """
        )
        stats = dict(cur.fetchone())
        cur.close()
        conn.close()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
