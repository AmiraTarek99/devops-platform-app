import pytest
from unittest.mock import patch, MagicMock
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


# ── Health tests ──────────────────────────────────────────────────────
def test_health_returns_200(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json["status"] == "healthy"
    assert r.json["service"] == "task-manager-backend"


def test_info_returns_metadata(client):
    r = client.get("/api/info")
    assert r.status_code == 200
    assert r.json["service"] == "task-manager-backend"
    assert "hostname" in r.json
    assert "version" in r.json


# ── Database-dependent tests with mocks ──────────────────────────────
def test_ready_when_db_connected(client):
    with patch("app.get_db") as mock_db:
        mock_conn = MagicMock()
        mock_cur  = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        r = client.get("/api/ready")
        assert r.status_code == 200
        assert r.json["status"] == "ready"


def test_ready_when_db_down(client):
    with patch("app.get_db") as mock_db:
        mock_db.side_effect = Exception("Connection refused")

        r = client.get("/api/ready")
        assert r.status_code == 503
        assert r.json["status"] == "not ready"


def test_get_tasks_returns_list(client):
    with patch("app.get_db") as mock_db:
        mock_conn = MagicMock()
        mock_cur  = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchall.return_value = [
            {"id": 1, "title": "Test task", "status": "pending",
             "priority": "high", "description": "", "created_at": "2024-01-01",
             "updated_at": "2024-01-01"}
        ]

        r = client.get("/api/tasks")
        assert r.status_code == 200
        assert isinstance(r.json, list)
        assert r.json[0]["title"] == "Test task"


def test_create_task_missing_title(client):
    r = client.post("/api/tasks",
                    json={"description": "no title"},
                    content_type="application/json")
    assert r.status_code == 400
    assert "error" in r.json


def test_create_task_success(client):
    with patch("app.get_db") as mock_db:
        mock_conn = MagicMock()
        mock_cur  = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchone.return_value = {
            "id": 1, "title": "New task", "description": "",
            "status": "pending", "priority": "medium",
            "created_at": "2024-01-01"
        }

        r = client.post("/api/tasks",
                        json={"title": "New task"},
                        content_type="application/json")
        assert r.status_code == 201
