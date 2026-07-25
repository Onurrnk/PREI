-- =====================================================================
-- PREI | 003e — Firma bazlı doküman kasası + firma kişileri + sözleşme firması
--
-- Sorun: kasa düzdü (5 sabit klasör, firma bağı yok), bir geliştiricinin
-- tek bir "kilit kişi"si olabiliyordu ve sözleşme firmayı ancak mülk
-- üzerinden dolaylı biliyordu — mülksüz sözleşme firmasız kalıyordu.
--
-- Çözüm: kasa Firma → Proje → Kategori olarak dallanır, firmanın birden
-- çok unvanlı kişisi olur, sözleşme firmaya DOĞRUDAN bağlanır.
-- =====================================================================
BEGIN;

-- ── 1) Firma kişileri ────────────────────────────────────────────────
-- Bir geliştiricide satış müdürü, mali işler, şantiye şefi… hepsi ayrı
-- kişi ve hepsinin unvanı var. Tek keyContact alanı bunu taşıyamıyordu.
CREATE TABLE IF NOT EXISTS organization_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  title           text,                      -- unvan: "Satış Direktörü"
  email           text,
  phone           text,
  whatsapp        text,
  -- Birincil kişi: listelerde ve otomatik yazışmalarda kullanılan.
  is_primary      boolean NOT NULL DEFAULT false,
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users(id),
  updated_by      uuid REFERENCES users(id),
  deleted_at      timestamptz,
  CONSTRAINT organization_contacts_name_chk CHECK (btrim(full_name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_org_contacts_org
  ON organization_contacts (tenant_id, organization_id)
  WHERE deleted_at IS NULL;

-- Aynı firmada aynı e-posta iki kez girilmesin (mükerrer kişi kaydı).
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_contacts_email
  ON organization_contacts (organization_id, lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL AND btrim(email) <> '';

-- Firma başına EN FAZLA bir birincil kişi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_contacts_primary
  ON organization_contacts (organization_id)
  WHERE deleted_at IS NULL AND is_primary;

ALTER TABLE organization_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_contacts_tenant ON organization_contacts;
CREATE POLICY organization_contacts_tenant ON organization_contacts
  USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());

DROP TRIGGER IF EXISTS trg_org_contacts_updated ON organization_contacts;
CREATE TRIGGER trg_org_contacts_updated BEFORE UPDATE ON organization_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Mevcut tek kişilik keyContact bilgisini taşı (veri kaybolmasın).
INSERT INTO organization_contacts
  (tenant_id, organization_id, full_name, title, email, phone, is_primary, created_by, updated_by)
SELECT o.tenant_id, o.id,
       btrim(o.metadata->>'keyContactName'),
       NULLIF(btrim(coalesce(o.metadata->>'keyContactTitle', '')), ''),
       NULLIF(btrim(coalesce(o.metadata->>'keyContactEmail', '')), ''),
       NULLIF(btrim(coalesce(o.metadata->>'keyContactPhone', '')), ''),
       true, o.created_by, o.updated_by
  FROM organizations o
 WHERE o.deleted_at IS NULL
   AND btrim(coalesce(o.metadata->>'keyContactName', '')) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM organization_contacts c
      WHERE c.organization_id = o.id AND c.deleted_at IS NULL
   );

-- ── 2) Kasa: firma + proje + kategori ────────────────────────────────
ALTER TABLE documents_vault
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS project_id      uuid REFERENCES properties(id);

-- Eski `folder` metinleri yerine kanonik kategori kodları. Tek alan kalsın
-- diye kolon adı korunuyor, değerleri değişiyor.
ALTER TABLE documents_vault DROP CONSTRAINT IF EXISTS documents_vault_folder_chk;

-- Önce firma/proje bağını kur — kategori eşlemesi buna bakıyor.
UPDATE documents_vault d
   SET project_id = d.related_id
 WHERE d.related_type = 'project' AND d.project_id IS NULL;

UPDATE documents_vault d
   SET organization_id = p.developer_id
  FROM properties p
 WHERE d.project_id = p.id AND d.organization_id IS NULL
   AND p.developer_id IS NOT NULL;

-- Kategori eşlemesi. Dikkat: proje girişi (intake) BROŞÜRLERİ
-- 'Developer Agreements' klasörüne yazıyordu — bunlar sözleşme değil,
-- pazarlama evrakı. O yüzden proje bağlı olanlar 'marketing'e gider.
UPDATE documents_vault SET folder = CASE
  WHEN folder = 'Developer Agreements' AND related_type = 'project' THEN 'marketing'
  WHEN folder = 'Developer Agreements' THEN 'contract'
  WHEN folder = 'Contracts'   THEN 'contract'
  WHEN folder = 'Client KYC'  THEN 'kyc'
  WHEN folder = 'Marketing'   THEN 'marketing'
  ELSE 'other'
END
WHERE folder IN ('Root', 'Client KYC', 'Contracts', 'Marketing', 'Developer Agreements');

ALTER TABLE documents_vault
  ALTER COLUMN folder SET DEFAULT 'other',
  ADD CONSTRAINT documents_vault_folder_chk CHECK (folder = ANY (ARRAY[
    'contract',   -- Sözleşme
    'permit',     -- Ruhsat & İzin
    'legal',      -- Tapu & Hukuk
    'technical',  -- Teknik & Plan
    'marketing',  -- Broşür & Görsel
    'financial',  -- Finansal
    'kyc',        -- KYC & Kimlik
    'other'       -- Diğer
  ]));

CREATE INDEX IF NOT EXISTS idx_docs_vault_org
  ON documents_vault (tenant_id, organization_id)
  WHERE deleted_at IS NULL AND organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_docs_vault_project
  ON documents_vault (tenant_id, project_id)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

-- ── 3) Sözleşme → firma doğrudan bağ ─────────────────────────────────
-- Eskiden yalnız mülk üzerinden çıkarılabiliyordu; çerçeve sözleşmesi
-- gibi mülksüz kayıtlar firmasız kalıyordu.
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

UPDATE contracts c
   SET organization_id = p.developer_id
  FROM properties p
 WHERE c.property_id = p.id AND c.organization_id IS NULL
   AND p.developer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_org
  ON contracts (tenant_id, organization_id)
  WHERE deleted_at IS NULL AND organization_id IS NOT NULL;

COMMIT;
