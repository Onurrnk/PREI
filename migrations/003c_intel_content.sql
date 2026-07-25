-- =====================================================================
-- 003c | Haftalık rapordan içerik üretimi.
--
-- Akış: Co-work raporu üretir → PREI arşivler (003b) → BURADA post
-- metinleri ve karusel planları üretilir → yerel betik bunları alıp
-- bilgisayardaki tarihli klasöre yazar.
--
-- Neden ayrı tablo: bir rapordan birden çok kez içerik üretilebilir
-- (farklı açı, farklı platform). Geçmiş kaybolmasın.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS intel_content_packs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  report_id     uuid NOT NULL REFERENCES intel_reports(id) ON DELETE CASCADE,
  /** Üretilen paket: posts[] + carousels[] (şemayla kısıtlı JSON). */
  pack          jsonb NOT NULL,
  /** Hangi model üretti (izlenebilirlik). */
  model         text,
  /** Kaç post / kaç karusel çıktı — listeleme için. */
  post_count    integer NOT NULL DEFAULT 0,
  carousel_count integer NOT NULL DEFAULT 0,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid
);

CREATE INDEX IF NOT EXISTS idx_intel_packs_report
  ON intel_content_packs (tenant_id, report_id, created_at DESC);

-- Üretilen karusel görselleri. Sunucuda saklanır, yerel betik indirir.
CREATE TABLE IF NOT EXISTS intel_carousel_images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  pack_id       uuid NOT NULL REFERENCES intel_content_packs(id) ON DELETE CASCADE,
  /** Hangi karusel, kaçıncı slayt. */
  carousel_index integer NOT NULL,
  slide_index   integer NOT NULL,
  /** Görselin üretildiği istem — tekrar üretmek gerekirse. */
  prompt        text NOT NULL,
  mime_type     text NOT NULL DEFAULT 'image/png',
  /** Görsel verisi. Az sayıda ve küçük olduğu için satırda tutulur. */
  image_data    bytea,
  /** Üretilemediyse sebebi (anahtar yok, kota, reddedildi...). */
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  CONSTRAINT intel_img_uniq UNIQUE (pack_id, carousel_index, slide_index)
);

CREATE INDEX IF NOT EXISTS idx_intel_images_pack
  ON intel_carousel_images (tenant_id, pack_id, carousel_index, slide_index);

ALTER TABLE intel_content_packs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_carousel_images  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intel_packs_app ON intel_content_packs;
CREATE POLICY intel_packs_app ON intel_content_packs
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

DROP POLICY IF EXISTS intel_images_app ON intel_carousel_images;
CREATE POLICY intel_images_app ON intel_carousel_images
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

GRANT SELECT, INSERT, UPDATE, DELETE ON intel_content_packs, intel_carousel_images TO prei_app;

COMMIT;
