-- =====================================================================
-- PREI | Migration 002r — proje konumu + geliştirici atıf bildirimi
-- =====================================================================
-- A) project_submissions'a koordinat (harita pin'i). Onayda properties'in
--    mevcut latitude/longitude (001) alanlarına taşınır.
-- B) project_client_notifications'a developer_notified_at — bir yatırımcıya
--    önerilen projenin geliştiricisine "yönlendirdik" atıf maili gönderilip
--    gönderilmediğini izler (komisyon/hak koruması; idempotent).
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- =====================================================================

ALTER TABLE project_submissions
    ADD COLUMN IF NOT EXISTS latitude  numeric(9,6),
    ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

ALTER TABLE project_client_notifications
    ADD COLUMN IF NOT EXISTS developer_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pcn_dev_pending
    ON project_client_notifications (tenant_id) WHERE developer_notified_at IS NULL;

-- DOWN:
--   ALTER TABLE project_submissions DROP COLUMN IF EXISTS latitude, DROP COLUMN IF EXISTS longitude;
--   ALTER TABLE project_client_notifications DROP COLUMN IF EXISTS developer_notified_at;
