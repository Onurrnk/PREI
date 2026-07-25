-- =====================================================================
-- PREI | 003g — Yatırım hedefleri (ülke + bölge) net kayıt
--
-- Sorun: müşteri/adayın nereye yatırım yapmak istediği hiçbir yerde
-- sorgulanabilir değildi. leads.target_market_code, pref_city, pref_district
-- kolonları TAMAMEN BOŞ; gerçek bilgi yalnız Eylül'ün çıkardığı
-- metadata.criteria içinde serbest metin olarak duruyordu
-- ("İstanbul/Nişantaşı", "Londra/İngiltere", "Dubai/Dubai Marina").
-- Bu yüzden "İspanya'da kaç müşteri arıyor" sorusu cevaplanamıyordu.
--
-- Çözüm: kişiye bağlı, ISO ülke kodlu, çok satırlı hedef tablosu.
-- Bir kişi birden fazla ülke/bölge isteyebilir (Dubai + İstanbul).
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS investment_targets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  -- Hedef KİŞİYE aittir: müşteri olsun aday olsun kişi değişmez.
  contact_id    uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- Hangi talepten geldiği (varsa) — izlenebilirlik için, zorunlu değil.
  lead_id       uuid REFERENCES leads(id) ON DELETE SET NULL,
  country_code  text NOT NULL,            -- ISO-3166-1 alpha-2
  region        text,                     -- şehir / bölge (İstanbul, Dubai Marina)
  district      text,                     -- ilçe / mahalle (Nişantaşı)
  -- Sıralama: 1 = birincil hedef. Danışman önceliği görsün.
  rank          integer NOT NULL DEFAULT 1,
  -- Kaynak: elle mi girildi, Eylül mü çıkardı, web formundan mı geldi.
  source        text NOT NULL DEFAULT 'manual',
  notes         text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users(id),
  updated_by    uuid REFERENCES users(id),
  deleted_at    timestamptz,
  CONSTRAINT investment_targets_country_chk CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT investment_targets_source_chk
    CHECK (source = ANY (ARRAY['manual', 'eylul', 'web', 'import']))
);

CREATE INDEX IF NOT EXISTS idx_inv_targets_contact
  ON investment_targets (tenant_id, contact_id)
  WHERE deleted_at IS NULL;

-- "Şu ülkeyi isteyen kaç kişi var" sorgusunun taşıyıcısı.
CREATE INDEX IF NOT EXISTS idx_inv_targets_country
  ON investment_targets (tenant_id, country_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inv_targets_lead
  ON investment_targets (lead_id)
  WHERE deleted_at IS NULL AND lead_id IS NOT NULL;

-- Aynı kişiye aynı ülke+bölge+ilçe iki kez yazılmasın. COALESCE ile
-- NULL'lar da tekilleştirmeye dahil (NULL <> NULL tuzağı).
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_targets_unique
  ON investment_targets (
    contact_id, country_code,
    lower(COALESCE(region, '')), lower(COALESCE(district, ''))
  )
  WHERE deleted_at IS NULL;

ALTER TABLE investment_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investment_targets_tenant ON investment_targets;
CREATE POLICY investment_targets_tenant ON investment_targets
  USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());

DROP TRIGGER IF EXISTS trg_inv_targets_updated ON investment_targets;
CREATE TRIGGER trg_inv_targets_updated BEFORE UPDATE ON investment_targets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Mevcut veriyi taşı ───────────────────────────────────────────────
-- Kaynak: leads.metadata->'criteria' (Eylül'ün çıkardığı serbest metin).
-- Ülke eşlemesi backend'deki geo.ts ile AYNI kuralları izler; buradaki
-- liste yalnız canlıda GERÇEKTEN bulunan değerleri kapsar, gerisi
-- uygulama katmanında çözülür (uydurma eşleme yapmıyoruz).
INSERT INTO investment_targets
  (tenant_id, contact_id, lead_id, country_code, region, district, source, created_by, updated_by)
SELECT DISTINCT ON (l.contact_id, code.c, lower(COALESCE(city.v, '')), lower(COALESCE(dist.v, '')))
       l.tenant_id, l.contact_id, l.id, code.c, city.v, dist.v, 'eylul', l.created_by, l.updated_by
  FROM leads l
  CROSS JOIN LATERAL (
    SELECT NULLIF(btrim(l.metadata->'criteria'->>'market'), '')   AS market,
           NULLIF(btrim(l.metadata->'criteria'->>'city'), '')     AS city,
           NULLIF(btrim(l.metadata->'criteria'->>'district'), '') AS district
  ) raw
  CROSS JOIN LATERAL (SELECT raw.city AS v) city
  CROSS JOIN LATERAL (SELECT raw.district AS v) dist
  CROSS JOIN LATERAL (
    SELECT CASE
      -- Ülke adları
      WHEN raw.market ILIKE 'türkiye' OR raw.market ILIKE 'turkiye' THEN 'TR'
      WHEN raw.market ILIKE 'ingiltere' OR raw.market ILIKE 'i̇ngiltere' THEN 'GB'
      WHEN raw.market ILIKE 'ispanya'   OR raw.market ILIKE 'i̇spanya'   THEN 'ES'
      WHEN raw.market ILIKE 'almanya'  THEN 'DE'
      WHEN raw.market ILIKE 'bae' OR raw.market ILIKE 'uae' THEN 'AE'
      -- Şehir pazar alanına yazılmış olabilir
      WHEN raw.market ILIKE 'dubai' THEN 'AE'
      ELSE NULL
    END AS c
  ) code
 WHERE l.deleted_at IS NULL
   AND code.c IS NOT NULL
 ON CONFLICT DO NOTHING;

COMMIT;
