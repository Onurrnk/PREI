-- =====================================================================
-- 003j | Sunulan ürünler + satış aşamaları
--
-- Onur: "bu kişilere sunulmuş ürünlerin müşteri listesinde kayıt edilmesi
-- için bir yer lazım. Hem kendi içimizdeki projeleri hem herhangi bir ilanı
-- girebilmeliyiz. İlan bilgileri yoksa ilan numarası, linki, özellikleri
-- girilmeli. Böylece ne sunduk ne sunmadık bilebiliriz."
--
-- Ayrıca: "satışın gerçekleştiği, sözleşmenin gerçekleştiği, kontrat
-- aşaması" görünür olmalı → stage kolonu.
--
-- Neden yeni tablo (lead_property_interests yerine): o tablo yalnız
-- lead_id + property_id + interest_level taşıyor; DIŞ İLAN taşıyamıyor
-- ve aşama tutamıyor. Ayrıca hiç kullanılmamış (0 satır, 0 kod referansı).
--
-- proposals ile karışmaz: proposals = resmi teklif BELGESİ (sihirbaz,
-- PDF, ROI). Bu tablo = "bu mülkü gösterdik" kaydı — daha hafif, daha erken.
-- =====================================================================

CREATE TABLE IF NOT EXISTS presented_properties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  contact_id    uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- Hangi talep kapsamında sunuldu (opsiyonel — kişi bazlı da çalışır).
  lead_id       uuid REFERENCES leads(id) ON DELETE SET NULL,

  -- İÇ PROJE: katalogdan seçilir.
  property_id   uuid REFERENCES properties(id) ON DELETE SET NULL,

  -- DIŞ İLAN: katalogda olmayan her şey (sahibinden, Bayut, geliştirici
  -- sitesi…). property_id yoksa bu alanlar doldurulur.
  external_title      text,
  external_listing_no text,
  external_url        text,
  external_source     text,

  -- Her iki durumda da doldurulabilen ortak alanlar.
  location  text,
  features  text,              -- serbest metin: "3+1, 145 m², havuzlu, deniz manzarası"
  price     numeric(14,2),
  currency  text DEFAULT 'EUR',

  -- Satış zinciri aşaması (Onur: sunum → sözleşme → satış görünür olsun).
  stage     text NOT NULL DEFAULT 'presented',

  notes         text,
  presented_at  timestamptz NOT NULL DEFAULT now(),
  -- Satışa döndüyse gerçek anlaşma kaydı (kapanan ciro oradan okunur).
  deal_id       uuid REFERENCES deals(id) ON DELETE SET NULL,

  version    integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  deleted_at timestamptz,

  -- İç proje ya da dış ilan — en az biri tanımlı olmalı; boş kayıt olamaz.
  CONSTRAINT presented_needs_source
    CHECK (property_id IS NOT NULL OR NULLIF(btrim(COALESCE(external_title,'')), '') IS NOT NULL),

  CONSTRAINT presented_stage_chk CHECK (stage IN (
    'presented',    -- Sunuldu
    'interested',   -- İlgilendi
    'rejected',     -- Beğenmedi / elendi
    'offer',        -- Teklif verildi
    'reserved',     -- Rezerve edildi
    'contract',     -- Sözleşme aşaması
    'sold'          -- Satış tamamlandı
  ))
);

-- Müşteri kartı bu kişinin sunumlarını çeker — en sık sorgu.
CREATE INDEX IF NOT EXISTS idx_presented_contact
  ON presented_properties (tenant_id, contact_id, presented_at DESC)
  WHERE deleted_at IS NULL;

-- "Bu projeyi kime sunduk" sorusu (proje kartından bakış).
CREATE INDEX IF NOT EXISTS idx_presented_property
  ON presented_properties (property_id)
  WHERE deleted_at IS NULL AND property_id IS NOT NULL;

-- Aynı mülkü aynı kişiye iki kez kaydetmeyi engelle (iç projeler için).
CREATE UNIQUE INDEX IF NOT EXISTS uq_presented_contact_property
  ON presented_properties (contact_id, property_id)
  WHERE deleted_at IS NULL AND property_id IS NOT NULL;

-- RLS: diğer tenant tabloları ile aynı desen.
ALTER TABLE presented_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presented_tenant_isolation ON presented_properties;
CREATE POLICY presented_tenant_isolation ON presented_properties
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON presented_properties TO prei_app;
