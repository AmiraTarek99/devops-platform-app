-- ═══════════════════════════════════════════════════════════════════
--  Database Initialization Script
--  Runs automatically when PostgreSQL container starts for first time
-- ═══════════════════════════════════════════════════════════════════

-- ── Tasks table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT         DEFAULT '',
    status      VARCHAR(50)  DEFAULT 'pending'
                CHECK (status IN ('pending', 'in_progress', 'done')),
    priority    VARCHAR(50)  DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high')),
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexes for performance ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created  ON tasks(created_at DESC);

-- ── Seed data ─────────────────────────────────────────────────────
INSERT INTO tasks (title, description, status, priority) VALUES
    ('Set up CI/CD pipeline',    'Configure Jenkins pipelines for CI and CD', 'done',        'high'),
    ('Provision EKS cluster',    'Use Terraform to create EKS on AWS',        'done',        'high'),
    ('Dockerize application',    'Write Dockerfiles for backend and frontend', 'done',        'high'),
    ('Configure Helm charts',    'Write Helm charts for Kubernetes deployment', 'in_progress', 'medium'),
    ('Set up monitoring',        'Install Prometheus and Grafana on EKS',      'in_progress', 'medium'),
    ('Write documentation',      'Document the full architecture and setup',   'pending',     'low'),
    ('Add integration tests',    'Write end-to-end tests for the API',         'pending',     'medium'),
    ('Configure auto-scaling',   'Set up HPA for backend and frontend pods',   'pending',     'high')
ON CONFLICT DO NOTHING;

-- ── Confirm ───────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'Database initialized — tasks table ready with seed data';
END $$;
