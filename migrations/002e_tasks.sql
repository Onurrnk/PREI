-- =====================================================================
-- PREI | Migration 002e — tasks (görev/toplantı) tablosu
-- FAZ 1: Tasks modülünün mock söküm hedefi. task_type ile Task/Meeting
-- birleşik; related_* ile lead/client/project'e (polimorfik) bağ.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- RLS: tenant izolasyonu + ownership RESTRICTIVE (assignee/created_by, 002b deseni).
-- =====================================================================

CREATE TABLE IF NOT EXISTS tasks (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),
    assignee_id   uuid REFERENCES users(id),
    title         text NOT NULL,
    description   text,
    due_date      timestamptz,
    priority      text NOT NULL DEFAULT 'medium',  -- low|medium|high
    status        text NOT NULL DEFAULT 'pending',  -- pending|in_progress|completed
    task_type     text NOT NULL DEFAULT 'task',     -- task|meeting
    -- ilişkili kayıt (polimorfik; ad denormalize edilir — hızlı listeleme)
    related_type  text,                             -- lead|client|project
    related_id    uuid,
    related_name  text,
    metadata      jsonb NOT NULL DEFAULT '{}',
    version       integer NOT NULL DEFAULT 1,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid,
    updated_by    uuid,
    deleted_at    timestamptz,
    CONSTRAINT tasks_priority_chk CHECK (priority IN ('low','medium','high')),
    CONSTRAINT tasks_status_chk   CHECK (status IN ('pending','in_progress','completed')),
    CONSTRAINT tasks_type_chk     CHECK (task_type IN ('task','meeting'))
);
COMMENT ON TABLE tasks IS 'Görev/toplantı — atanmış kişi + ilişkili kayıt; Meetings de type=meeting ile buradan beslenebilir.';

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (tenant_id, assignee_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (tenant_id, due_date) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_tasks_updated ON tasks;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tasks_tenant ON tasks;
CREATE POLICY tasks_tenant ON tasks FOR ALL
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());
DROP POLICY IF EXISTS tasks_ownership ON tasks;
CREATE POLICY tasks_ownership ON tasks AS RESTRICTIVE FOR ALL
    USING (app_is_privileged() OR assignee_id = app_user() OR created_by = app_user())
    WITH CHECK (app_is_privileged() OR assignee_id = app_user() OR created_by = app_user());

-- =====================================================================
-- DOWN (geri alma):
--   DROP TABLE IF EXISTS tasks CASCADE;
-- =====================================================================
