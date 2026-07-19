-- =====================================================================
-- PREI | Migration 002q — proje→müşteri bildirim izleme (Faz 2)
-- =====================================================================
-- Onaylanan (developer_submission kaynaklı) proje, kriteri uyan + izinli
-- müşterilere markalı mail ile duyurulur. Bu tablo "hangi proje hangi
-- müşteriye bildirildi"yi tutar → aynı proje aynı müşteriye iki kez
-- gitmez (idempotent digest). n8n günlük iş service_agent ile yazar.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_client_notifications (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id),
    property_id  uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    contact_id   uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    sent_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_client_notif UNIQUE (property_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_project_client_notif_tenant
    ON project_client_notifications (tenant_id, contact_id);

ALTER TABLE project_client_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pcn_privileged ON project_client_notifications;
CREATE POLICY pcn_privileged ON project_client_notifications
    USING (tenant_id = app_tenant() AND app_is_privileged())
    WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());
-- n8n digest (service_agent): dedup için SELECT + gönderim sonrası INSERT.
DROP POLICY IF EXISTS pcn_service ON project_client_notifications;
CREATE POLICY pcn_service ON project_client_notifications
    USING (tenant_id = app_tenant() AND app_role() = 'service_agent')
    WITH CHECK (tenant_id = app_tenant() AND app_role() = 'service_agent');

-- DOWN:
--   DROP TABLE IF EXISTS project_client_notifications CASCADE;
