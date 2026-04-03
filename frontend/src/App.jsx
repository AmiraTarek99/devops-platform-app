import { useState, useEffect, useCallback } from "react";

const STATUSES  = ["pending", "in_progress", "done"];
const PRIORITIES = ["low", "medium", "high"];

const STATUS_COLORS = {
  pending:     { bg: "#1e3a5f", text: "#60a5fa", label: "Pending" },
  in_progress: { bg: "#3b2c00", text: "#fbbf24", label: "In Progress" },
  done:        { bg: "#052e16", text: "#4ade80", label: "Done" },
};

const PRIORITY_COLORS = {
  low:    "#64748b",
  medium: "#f59e0b",
  high:   "#ef4444",
};

export default function App() {
  const [tasks,   setTasks]   = useState([]);
  const [stats,   setStats]   = useState(null);
  const [info,    setInfo]    = useState(null);
  const [filter,  setFilter]  = useState("all");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [form,    setForm]    = useState({ title: "", description: "", priority: "medium" });
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const url = filter === "all" ? "/api/tasks" : `/api/tasks?status=${filter}`;
      const [tasksRes, statsRes, infoRes] = await Promise.all([
        fetch(url),
        fetch("/api/stats"),
        fetch("/api/info"),
      ]);
      setTasks(await tasksRes.json());
      setStats(await statsRes.json());
      setInfo(await infoRes.json());
      setError(null);
    } catch {
      setError("Cannot reach backend API");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ title: "", description: "", priority: "medium" });
      fetchAll();
    } catch { setError("Failed to create task"); }
    finally { setSubmitting(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchAll();
    } catch { setError("Failed to update task"); }
  };

  const deleteTask = async (id) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      fetchAll();
    } catch { setError("Failed to delete task"); }
  };

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
      <p style={{ color: "#64748b", marginTop: 16 }}>Loading...</p>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <h1 style={s.title}>📋 Task Manager</h1>
          <p style={s.subtitle}>Production DevOps Platform — Flask · PostgreSQL · EKS</p>
        </div>

        {error && (
          <div style={s.error}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={s.closeBtn}>✕</button>
          </div>
        )}

        {/* Stats row */}
        {stats && (
          <div style={s.statsRow}>
            {[
              { label: "Total",       value: stats.total,       color: "#94a3b8" },
              { label: "Pending",     value: stats.pending,     color: "#60a5fa" },
              { label: "In Progress", value: stats.in_progress, color: "#fbbf24" },
              { label: "Done",        value: stats.done,        color: "#4ade80" },
              { label: "High Priority", value: stats.high_priority, color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label} style={s.statCard}>
                <div style={{ ...s.statNum, color }}>{value}</div>
                <div style={s.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add task form */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>+ Add New Task</h2>
          <form onSubmit={createTask} style={s.form}>
            <input
              style={s.input}
              placeholder="Task title *"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              style={s.input}
              placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
            <select
              style={s.select}
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)} Priority</option>
              ))}
            </select>
            <button type="submit" style={s.btn} disabled={submitting}>
              {submitting ? "Adding..." : "Add Task"}
            </button>
          </form>
        </div>

        {/* Filter tabs */}
        <div style={s.tabs}>
          {["all", ...STATUSES].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ ...s.tab, ...(filter === f ? s.tabActive : {}) }}
            >
              {f === "all" ? "All" : STATUS_COLORS[f]?.label || f}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div style={s.card}>
          {!Array.isArray(tasks) || tasks.length === 0 ? (
            <p style={{ color: "#475569", textAlign: "center", padding: "2rem" }}>
              No tasks found. Add one above.
            </p>
          ) : (
            tasks.map(task => (
              <div key={task.id} style={s.taskRow}>
                <div style={s.taskLeft}>
                  <div style={s.taskTitle}>{task.title}</div>
                  {task.description && (
                    <div style={s.taskDesc}>{task.description}</div>
                  )}
                  <div style={s.taskMeta}>
                    <span style={{
                      ...s.statusBadge,
                      background: STATUS_COLORS[task.status]?.bg,
                      color:      STATUS_COLORS[task.status]?.text,
                    }}>
                      {STATUS_COLORS[task.status]?.label || task.status}
                    </span>
                    <span style={{ color: PRIORITY_COLORS[task.priority], fontSize: ".75rem" }}>
                      ● {task.priority} priority
                    </span>
                  </div>
                </div>
                <div style={s.taskActions}>
                  <select
                    style={s.statusSelect}
                    value={task.status}
                    onChange={e => updateStatus(task.id, e.target.value)}
                  >
                    {STATUSES.map(st => (
                      <option key={st} value={st}>{STATUS_COLORS[st]?.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteTask(task.id)}
                    style={s.deleteBtn}
                    title="Delete task"
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* System info */}
        {info && (
          <div style={{ ...s.card, marginTop: 8 }}>
            <h2 style={s.cardTitle}>⚙️ System Info</h2>
            <div style={s.infoGrid}>
              {[
                ["Service",     info.service],
                ["Version",     info.version],
                ["Environment", info.environment],
                ["Pod",         info.hostname],
                ["Database",    info.db_host],
              ].map(([label, value]) => (
                <div key={label} style={s.infoRow}>
                  <span style={s.infoLabel}>{label}</span>
                  <span style={s.infoValue}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page:        { minHeight: "100vh", background: "#0f172a", fontFamily: "'Segoe UI', monospace", padding: "1.5rem 1rem" },
  container:   { maxWidth: 720, margin: "0 auto" },
  center:      { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0f172a" },
  spinner:     { width: 40, height: 40, border: "3px solid #1e293b", borderTop: "3px solid #38bdf8", borderRadius: "50%", animation: "spin 1s linear infinite" },
  header:      { marginBottom: "1.5rem", textAlign: "center" },
  title:       { color: "#f1f5f9", fontSize: "1.8rem", margin: 0 },
  subtitle:    { color: "#475569", fontSize: ".85rem", marginTop: 6 },
  error:       { background: "#450a0a", color: "#fca5a5", padding: "12px 16px", borderRadius: 8, marginBottom: "1rem", display: "flex", justifyContent: "space-between" },
  closeBtn:    { background: "none", border: "none", color: "#fca5a5", cursor: "pointer" },
  statsRow:    { display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" },
  statCard:    { flex: 1, minWidth: 100, background: "#1e293b", borderRadius: 8, padding: "1rem", textAlign: "center" },
  statNum:     { fontSize: "1.8rem", fontWeight: "bold" },
  statLabel:   { color: "#64748b", fontSize: ".75rem", marginTop: 4 },
  card:        { background: "#1e293b", borderRadius: 10, padding: "1.25rem", marginBottom: "1rem" },
  cardTitle:   { color: "#94a3b8", fontSize: ".8rem", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 1rem" },
  form:        { display: "flex", gap: 8, flexWrap: "wrap" },
  input:       { flex: 1, minWidth: 160, background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", color: "#f1f5f9", fontSize: ".9rem", outline: "none" },
  select:      { background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", color: "#f1f5f9", fontSize: ".9rem" },
  btn:         { background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" },
  tabs:        { display: "flex", gap: 6, marginBottom: "1rem", flexWrap: "wrap" },
  tab:         { background: "#1e293b", color: "#64748b", border: "1px solid #334155", padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: ".85rem" },
  tabActive:   { background: "#0ea5e9", color: "#fff", border: "1px solid #0ea5e9" },
  taskRow:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid #0f172a" },
  taskLeft:    { flex: 1 },
  taskTitle:   { color: "#f1f5f9", fontWeight: "bold", marginBottom: 4 },
  taskDesc:    { color: "#64748b", fontSize: ".85rem", marginBottom: 6 },
  taskMeta:    { display: "flex", gap: 12, alignItems: "center" },
  statusBadge: { padding: "2px 10px", borderRadius: 20, fontSize: ".75rem", fontWeight: "bold" },
  taskActions: { display: "flex", gap: 6, alignItems: "center", marginLeft: 12 },
  statusSelect:{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "4px 8px", color: "#f1f5f9", fontSize: ".8rem" },
  deleteBtn:   { background: "#450a0a", color: "#fca5a5", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: ".8rem" },
  infoGrid:    { display: "flex", flexDirection: "column", gap: 4 },
  infoRow:     { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #0f172a" },
  infoLabel:   { color: "#64748b", fontSize: ".85rem" },
  infoValue:   { color: "#38bdf8", fontSize: ".85rem" },
};
