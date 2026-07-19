-- =====================================================================
-- PREI | Migration 002o — Otomatik Proje Girişi (geliştirici portalı)
-- =====================================================================
-- İki tablo:
--   1) project_invites — geliştiriciye verilen tokenli davet linki
--      (çok kullanımlık + süreli + iptal edilebilir; v1.1 kararı).
--   2) project_submissions — geliştiricinin gönderdiği TASLAK proje
--      (onay kuyruğu). Onaylanınca gerçek `properties` satırı üretilir;
--      bu staging tablosu ham gönderiyi + medya referanslarını tutar.
-- Onay kuyruğu için `properties`'e dokunulmuyor (mevcut katalog sorguları
-- bozulmasın diye ayrı staging tercih edildi).
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- =====================================================================

-- 1. DAVET LİNKLERİ -----------------------------------------------------
CREATE TABLE IF NOT EXISTS project_invites (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),
    developer_id  uuid REFERENCES organizations(id),  -- hangi geliştirici için
    token         text NOT NULL UNIQUE,               -- URL'deki gizli anahtar
    label         text,                               -- ör. "Emaar 2026 Q3"
    expires_at    timestamptz,                        -- null = süresiz
    revoked_at    timestamptz,                        -- iptal
    max_uses      integer,                            -- null = sınırsız
    used_count    integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid
);
CREATE INDEX IF NOT EXISTS idx_project_invites_tenant ON project_invites (tenant_id) WHERE revoked_at IS NULL;

ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_invites_privileged ON project_invites;
CREATE POLICY project_invites_privileged ON project_invites
    USING (tenant_id = app_tenant() AND app_is_privileged())
    WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());
-- Not: public submit guard'ı token'ı DatabaseService.raw (RLS-bypass sistem
-- sorgusu) ile çözer — istekte henüz tenant ctx yok (AgentKeyGuard deseni).

DROP TRIGGER IF EXISTS trg_project_invites_updated ON project_invites;
CREATE TRIGGER trg_project_invites_updated BEFORE UPDATE ON project_invites
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. GÖNDERİLER (onay kuyruğu) -----------------------------------------
CREATE TABLE IF NOT EXISTS project_submissions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    invite_id           uuid REFERENCES project_invites(id),
    developer_id        uuid REFERENCES organizations(id),
    status              text NOT NULL DEFAULT 'pending',  -- pending|approved|rejected

    title               text NOT NULL,
    city                text,
    district            text,
    market_code         text REFERENCES markets(code),
    price_min           numeric(15,2),
    price_max           numeric(15,2),
    currency            text NOT NULL DEFAULT 'EUR',
    commission_pct      numeric(6,3),
    unit_types          text[] NOT NULL DEFAULT '{}',
    description         text,

    image_urls          text[] NOT NULL DEFAULT '{}',  -- media bucket public URL'leri
    brochure_path       text,                          -- vault bucket path (signedUrl ile sunulur)

    payload             jsonb NOT NULL DEFAULT '{}',    -- ham form + ek alanlar
    created_property_id uuid REFERENCES properties(id), -- onayda üretilen proje
    review_note         text,
    reviewed_by         uuid,
    reviewed_at         timestamptz,
    submitted_ip        text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT project_submissions_status_chk CHECK (status IN ('pending','approved','rejected')),
    CONSTRAINT project_submissions_price_chk  CHECK (price_max IS NULL OR price_min IS NULL OR price_max >= price_min),
    CONSTRAINT project_submissions_comm_chk   CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100))
);
CREATE INDEX IF NOT EXISTS idx_project_submissions_pending
    ON project_submissions (tenant_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_project_submissions_developer
    ON project_submissions (tenant_id, developer_id);

ALTER TABLE project_submissions ENABLE ROW LEVEL SECURITY;
-- Ayrıcalıklı personel: onay kuyruğunu tam yönetir.
DROP POLICY IF EXISTS project_submissions_privileged ON project_submissions;
CREATE POLICY project_submissions_privileged ON project_submissions
    USING (tenant_id = app_tenant() AND app_is_privileged())
    WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());
-- Public submit (token guard → service_agent bağlamı): yalnız INSERT.
DROP POLICY IF EXISTS project_submissions_service_insert ON project_submissions;
CREATE POLICY project_submissions_service_insert ON project_submissions
    FOR INSERT WITH CHECK (tenant_id = app_tenant() AND app_role() = 'service_agent');

DROP TRIGGER IF EXISTS trg_project_submissions_updated ON project_submissions;
CREATE TRIGGER trg_project_submissions_updated BEFORE UPDATE ON project_submissions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- DOWN:
--   DROP TABLE IF EXISTS project_submissions CASCADE;
--   DROP TABLE IF EXISTS project_invites CASCADE;
-- =====================================================================
