-- =====================================================================
-- PREI | Migration 002g — documents_vault (dosya kasası)
-- FAZ 1: Document Vault modülünün gerçek veri kaynağı. DİKKAT: mevcut
-- `documents` tablosu RAG korpusudur (1515 chunk, embedding'li) — Vault
-- ile İLGİSİZ; bu yüzden ayrı tablo. Dosyanın kendisi Supabase Storage
-- 'vault' bucket'ında durur; bu tablo metadata + storage_path tutar.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- Down-script en altta (yorum).
-- =====================================================================

-- 1. TABLO --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents_vault (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),

    name          text NOT NULL,                 -- görünen dosya adı
    folder        text NOT NULL DEFAULT 'Root',  -- UI klasörü
    mime_type     text NOT NULL,
    size_bytes    bigint NOT NULL,
    storage_path  text NOT NULL,                 -- Storage 'vault' bucket içi yol

    -- Opsiyonel ilişki (müşteri KYC dosyası vb.) — polimorfik, FK'sız
    related_type  text,                          -- contact | property | contract ...
    related_id    uuid,

    uploaded_by   uuid REFERENCES users(id),
    metadata      jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,

    CONSTRAINT documents_vault_folder_chk
      CHECK (folder IN ('Root','Client KYC','Contracts','Marketing','Developer Agreements'))
);
COMMENT ON TABLE documents_vault IS 'Document Vault — dosya metadata; içerik Supabase Storage vault bucket''ında.';

CREATE INDEX IF NOT EXISTS idx_docs_vault_tenant_folder
    ON documents_vault (tenant_id, folder) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_docs_vault_related
    ON documents_vault (tenant_id, related_type, related_id) WHERE deleted_at IS NULL;

-- 2. RLS: tenant izolasyonu ----------------------------------------------
ALTER TABLE documents_vault ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documents_vault_tenant ON documents_vault;
CREATE POLICY documents_vault_tenant ON documents_vault FOR ALL
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());

-- =====================================================================
-- DOWN (geri alma):
--   DROP TABLE IF EXISTS documents_vault CASCADE;
-- =====================================================================
