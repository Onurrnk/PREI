-- =====================================================================
-- PREI | Migration 002d — proposals (teklif) tablosu
-- FAZ 1: Proposals modülünün mock söküm hedefi. Lead-merkezli modelde
-- teklif; contact→müşteri adı, property→proje adı join'lenir.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- RLS: tenant izolasyonu + ownership RESTRICTIVE (B-3 deseni, 002b ile aynı).
-- Down-script en altta (yorum) — geri alma için.
-- =====================================================================

-- 1. TABLO --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposals (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id),
    lead_id        uuid REFERENCES leads(id),
    contact_id     uuid REFERENCES contacts(id),   -- müşteri adı kaynağı (join)
    property_id    uuid REFERENCES properties(id), -- proje adı kaynağı (join)
    owner_id       uuid REFERENCES users(id),      -- teklifi hazırlayan (ABAC anahtarı)

    title          text NOT NULL,
    status         text NOT NULL DEFAULT 'draft',  -- draft|sent|viewed|accepted|rejected
    total_value    numeric(15,2),
    currency       text NOT NULL DEFAULT 'EUR',

    sent_at        timestamptz,
    last_viewed_at timestamptz,
    view_count     integer NOT NULL DEFAULT 0,

    metadata       jsonb NOT NULL DEFAULT '{}',
    version        integer NOT NULL DEFAULT 1,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    created_by     uuid,
    updated_by     uuid,
    deleted_at     timestamptz,
    CONSTRAINT proposals_status_chk
      CHECK (status IN ('draft','sent','viewed','accepted','rejected'))
);
COMMENT ON TABLE proposals IS 'Teklif (proposal) — lead/contact/property''ye bağlı; view tracking (sent/viewed/accepted).';

CREATE INDEX IF NOT EXISTS idx_proposals_tenant_status ON proposals (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_owner ON proposals (tenant_id, owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals (tenant_id, lead_id) WHERE deleted_at IS NULL;

-- 2. updated_at trigger (set_updated_at 001'de tanımlı) -----------------
DROP TRIGGER IF EXISTS trg_proposals_updated ON proposals;
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON proposals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. RLS: tenant izolasyonu + ownership RESTRICTIVE (B-3) ---------------
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proposals_tenant ON proposals;
CREATE POLICY proposals_tenant ON proposals FOR ALL
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());
DROP POLICY IF EXISTS proposals_ownership ON proposals;
CREATE POLICY proposals_ownership ON proposals AS RESTRICTIVE FOR ALL
    USING (app_is_privileged() OR owner_id = app_user())
    WITH CHECK (app_is_privileged() OR owner_id = app_user());

-- =====================================================================
-- DOWN (geri alma):
--   DROP TABLE IF EXISTS proposals CASCADE;
-- =====================================================================
