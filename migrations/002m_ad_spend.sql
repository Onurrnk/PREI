-- =====================================================================
-- PREI | Migration 002m — ad_spend (Marketing modülü gerçek veri kaynağı)
-- =====================================================================
-- Neden: Meta Ads API (ads_read) App Review + tüzel kişilik doğrulaması
-- beklerken Marketing paneli mock veriyle çalışıyordu. Bu tablo, reklam
-- harcamasını ELLE veya CSV ile girmeyi sağlar (Meta Ads Manager dışa
-- aktarımı → CSV → PREI). Harcama/gösterim/tıklama bu tablodan; funnel,
-- CPL, ROAS ise GERÇEK CRM verisinden (leads / lead_scores / tasks(meeting)
-- / deals / lead_attributions) hesaplanır. Meta API gelince aynı tablo
-- otomatik beslenir (kaynak değişir, şema değişmez).
--
-- Para birimi: satır kendi currency'siyle saklanır; raporlama fx_to_eur
-- (002c) ile EUR bazına çevrilir — financials ile aynı desen.
-- campaign_ref: Meta campaign_id; lead_attributions.campaign_id ile eşleşir
-- (CTWA atıfı geldiğinde kampanya-bazlı lead/CPL/ROAS otomatik dolar).
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- =====================================================================

-- 1. TABLO --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_spend (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),

    name          text NOT NULL,                    -- kampanya adı (görünen)
    campaign_ref  text,                             -- Meta campaign_id (opsiyonel; atıf eşleşmesi)
    market_code   text REFERENCES markets(code),    -- TR/AE/ES/GB...
    channel       text NOT NULL DEFAULT 'meta',     -- meta | instagram | google | other
    status        text NOT NULL DEFAULT 'active',   -- active | paused

    period_start  date NOT NULL,
    period_end    date NOT NULL,

    spend         numeric(15,2) NOT NULL DEFAULT 0, -- kendi para biriminde
    currency      text NOT NULL DEFAULT 'EUR',
    impressions   bigint NOT NULL DEFAULT 0,
    clicks        bigint NOT NULL DEFAULT 0,        -- CTWA / bağlantı tıklaması

    metadata      jsonb NOT NULL DEFAULT '{}',
    version       integer NOT NULL DEFAULT 1,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid,
    updated_by    uuid,
    deleted_at    timestamptz,

    CONSTRAINT ad_spend_period_chk   CHECK (period_end >= period_start),
    CONSTRAINT ad_spend_status_chk   CHECK (status IN ('active','paused')),
    CONSTRAINT ad_spend_channel_chk  CHECK (channel IN ('meta','instagram','google','other')),
    CONSTRAINT ad_spend_spend_chk    CHECK (spend >= 0),
    CONSTRAINT ad_spend_nonneg_chk   CHECK (impressions >= 0 AND clicks >= 0)
);
COMMENT ON TABLE ad_spend IS 'Marketing harcama kaynağı (elle/CSV). Funnel/CPL/ROAS gerçek CRM''den; bu tablo yalnız spend/gösterim/tıklama + kampanya kimliği tutar.';
COMMENT ON COLUMN ad_spend.campaign_ref IS 'Meta campaign_id; lead_attributions.campaign_id ile eşleşir → kampanya-bazlı lead/CPL/ROAS.';

CREATE INDEX IF NOT EXISTS idx_ad_spend_tenant_period ON ad_spend (tenant_id, period_start, period_end)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ad_spend_market ON ad_spend (tenant_id, market_code)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ad_spend_campaign_ref ON ad_spend (tenant_id, campaign_ref)
    WHERE deleted_at IS NULL AND campaign_ref IS NOT NULL;

-- 2. RLS: pazarlama verisi ayrıcalıklı rollere görünür/yazılır -----------
--    app_is_privileged() = super_admin/manager/marketing_manager/finance_manager
--    (001'de tanımlı). Danışman (consultant) reklam harcaması görmez.
ALTER TABLE ad_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ad_spend_privileged ON ad_spend;
CREATE POLICY ad_spend_privileged ON ad_spend
    USING (tenant_id = app_tenant() AND app_is_privileged())
    WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

-- 3. updated_at + version trigger (001'deki set_updated_at) --------------
DROP TRIGGER IF EXISTS trg_ad_spend_updated ON ad_spend;
CREATE TRIGGER trg_ad_spend_updated BEFORE UPDATE ON ad_spend
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- DOWN (geri alma):
--   DROP TRIGGER IF EXISTS trg_ad_spend_updated ON ad_spend;
--   DROP TABLE IF EXISTS ad_spend CASCADE;
-- =====================================================================
