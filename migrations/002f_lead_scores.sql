-- =====================================================================
-- PREI | Migration 002f — lead_scores (skor geçmişi + gerekçe)
-- FAZ 2 hazırlığı: gerçek lead skorlama motoru. n8n bir RAG akışıyla
-- (lead'in communications geçmişi + ProDuality bilgi tabanı/knowledge_chunks)
-- skoru hesaplar ve POST /api/agent/lead-score ile buraya yazar (OV-4:
-- n8n asla service_role almaz, yalnız AgentKeyGuard + service_agent ile).
-- Append-only (audit_log deseniyle aynı — F6): UPDATE/DELETE yok, yalnız INSERT+SELECT.
-- leads.score kolonu "en son skor" önbelleği olarak kalır (liste/kanban ekranları
-- ekstra join yapmasın diye); bu tablo TAM gerekçe + geçmiş içindir.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- Down-script en altta (yorum).
-- =====================================================================

-- 1. TABLO --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_scores (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    score       integer NOT NULL,
    reasoning   text,                        -- LLM'in doğal dil gerekçesi
    signals     jsonb NOT NULL DEFAULT '{}',  -- yapılandırılmış sinyal kırılımı (opsiyonel)
    source      text NOT NULL DEFAULT 'manual', -- manual | n8n_ai

    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid,

    CONSTRAINT lead_scores_score_chk CHECK (score BETWEEN 0 AND 100),
    CONSTRAINT lead_scores_source_chk CHECK (source IN ('manual', 'n8n_ai'))
);
COMMENT ON TABLE lead_scores IS 'Lead skor geçmişi — her skorlama bir satır (append-only); leads.score en sonuncunun önbelleği.';

CREATE INDEX IF NOT EXISTS idx_lead_scores_lead ON lead_scores (tenant_id, lead_id, created_at DESC);

-- 2. RLS: tenant izolasyonu, append-only (audit_log ile aynı F6 deseni) ---
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_scores_select ON lead_scores;
DROP POLICY IF EXISTS lead_scores_insert ON lead_scores;
CREATE POLICY lead_scores_select ON lead_scores FOR SELECT
    USING (tenant_id = app_tenant());
CREATE POLICY lead_scores_insert ON lead_scores FOR INSERT
    WITH CHECK (tenant_id = app_tenant());
-- UPDATE/DELETE için policy YOK → RLS altında reddedilir. Ek olarak GRANT + trigger:
REVOKE UPDATE, DELETE ON lead_scores FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
        EXECUTE 'REVOKE UPDATE, DELETE ON lead_scores FROM authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
        EXECUTE 'REVOKE UPDATE, DELETE ON lead_scores FROM anon';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION lead_scores_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'lead_scores değiştirilemez (append-only): % engellendi', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;
DROP TRIGGER IF EXISTS trg_lead_scores_immutable ON lead_scores;
CREATE TRIGGER trg_lead_scores_immutable
    BEFORE UPDATE OR DELETE ON lead_scores
    FOR EACH ROW EXECUTE FUNCTION lead_scores_immutable();

-- =====================================================================
-- DOWN (geri alma):
--   DROP TRIGGER IF EXISTS trg_lead_scores_immutable ON lead_scores;
--   DROP FUNCTION IF EXISTS lead_scores_immutable();
--   DROP TABLE IF EXISTS lead_scores CASCADE;
-- =====================================================================
