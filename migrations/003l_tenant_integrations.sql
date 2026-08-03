-- =====================================================================
-- 003l | Entegrasyon kimlikleri: kiracı/kullanıcı bazlı tek depo.
--
-- NEDEN: Bugün her entegrasyon ayrı yazılıyor. Google için imzalı state'li
-- düzgün bir OAuth akışı var; Meta ise ortam değişkeninde (META_ADS_*),
-- yani kullanıcı bağlayamıyor, tek hesaba kilitli. Instagram/YouTube gibi
-- yeni platformlar için üçüncü, dördüncü bir yol açılacaktı.
--
-- Bu tablo tek depo: sağlayıcı bazlı token + durum + hesap etiketi.
-- Yeni platform eklemek artık tek adaptör yazmak demek.
--
-- İKİ SEVİYE (scope):
--   'user'   → kişisel hesap (Gmail kutusu, kişisel takvim)
--   'tenant' → şirket varlığı (Meta reklam hesabı, Instagram iş hesabı)
-- Ayrım önemli: danışman ayrılınca kişisel bağlantısı gider, şirket
-- reklam hesabı kalmalı.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      text NOT NULL,                     -- 'meta_ads', 'instagram', 'youtube'...
  scope         text NOT NULL CHECK (scope IN ('tenant','user')),
  -- scope='user' ise hangi kullanıcıya ait; scope='tenant' ise NULL.
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'connected'
                  CHECK (status IN ('connected','expired','error','revoked')),
  -- Bağlı hesabın insan-okur etiketi ("@produality", "GSN Ads (act_123)").
  account_label text,
  account_ref   text,                              -- sağlayıcıdaki kimlik
  scopes        text[] NOT NULL DEFAULT '{}',
  -- Token'lar: uygulama katmanında şifrelenir, burada opak metin.
  credentials   jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at    timestamptz,
  last_error    text,
  last_checked_at timestamptz,
  connected_by  uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Aynı sağlayıcı aynı sahip için tek kayıt: yeniden bağlama ÜZERİNE yazar,
-- yoksa eski token'lar birikip hangisinin geçerli olduğu belirsizleşir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_integrations_owner
  ON tenant_integrations (tenant_id, provider, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_lookup
  ON tenant_integrations (tenant_id, provider, status);

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Okuma: kendi kiracısı. Yazma: yalnız yetkili roller (app_is_privileged)
-- ya da service_agent (n8n/otomasyon token yenilemesi).
DROP POLICY IF EXISTS tenant_integrations_read ON tenant_integrations;
CREATE POLICY tenant_integrations_read ON tenant_integrations
  FOR SELECT USING (tenant_id = app_tenant());

DROP POLICY IF EXISTS tenant_integrations_write ON tenant_integrations;
CREATE POLICY tenant_integrations_write ON tenant_integrations
  FOR ALL USING (tenant_id = app_tenant() AND (app_is_privileged() OR app_role() = 'service_agent'))
  WITH CHECK (tenant_id = app_tenant() AND (app_is_privileged() OR app_role() = 'service_agent'));

DROP TRIGGER IF EXISTS update_tenant_integrations_updated_at ON tenant_integrations;
CREATE TRIGGER update_tenant_integrations_updated_at
  BEFORE UPDATE ON tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_integrations TO prei_app;

COMMIT;
