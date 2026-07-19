-- =====================================================================
-- PREI | Migration 002n — ad_spend Meta senkron desteği
-- =====================================================================
-- 1) Meta Insights günlük satırlarını idempotent upsert için UNIQUE indeks:
--    kaynak='meta' satırlarında (campaign_ref, period_start) benzersiz.
--    Günlük iş son 30 günü tekrar çeker → mevcut günü GÜNCELLER, çoğaltmaz.
-- 2) service_agent (n8n senkron principal'ı, AgentKeyGuard) ad_spend'e
--    yazabilsin diye ek RLS politikası. Ayrıcalıklı insan rolleri 002m'deki
--    ad_spend_privileged ile devam eder; bu yalnız otomatik senkron içindir.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- =====================================================================

-- 1. Meta upsert idempotency indeksi -----------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_spend_meta_daily
    ON ad_spend (tenant_id, campaign_ref, period_start)
    WHERE deleted_at IS NULL AND campaign_ref IS NOT NULL
      AND (metadata->>'source') = 'meta';

-- 2. service_agent senkron politikası ----------------------------------
DROP POLICY IF EXISTS ad_spend_service_sync ON ad_spend;
CREATE POLICY ad_spend_service_sync ON ad_spend
    USING (tenant_id = app_tenant() AND app_role() = 'service_agent')
    WITH CHECK (tenant_id = app_tenant() AND app_role() = 'service_agent');

-- =====================================================================
-- DOWN:
--   DROP POLICY IF EXISTS ad_spend_service_sync ON ad_spend;
--   DROP INDEX IF EXISTS uq_ad_spend_meta_daily;
-- =====================================================================
