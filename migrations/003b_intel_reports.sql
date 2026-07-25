-- =====================================================================
-- 003b | Haftalık istihbarat raporu arşivi.
--
-- Amaç (Onur'un tarifi): rapor MÜŞTERİYE GİTMEZ. İki işe yarar:
--   1) kendimizi piyasa konusunda haberdar tutmak (bilgi bankası)
--   2) sosyal medya postu ve video içeriği çıkarmak
--
-- Bu yüzden iki tablo: raporun kendisi (bölümlere ayrılmış, aranabilir)
-- ve rapordan çıkan PAYLAŞILABİLİR HABER kalemleri (içerik kuyruğu).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS intel_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  title          text NOT NULL,
  /** Kapsam dönemi — "17-24 Temmuz 2026" gibi rapor başlığından çıkar. */
  period_start   date,
  period_end     date,
  report_date    date NOT NULL DEFAULT CURRENT_DATE,
  /** İzlenen pazarlar (TR, AE, ES, GB, NL, DE, TH, GLOBAL...). */
  markets        text[] NOT NULL DEFAULT '{}',
  /** Tam metin — arama bunun üzerinde çalışır. */
  full_text      text NOT NULL,
  /** Bölümler: [{ index, heading, body }] — 15 bölümlü yapı korunur. */
  sections       jsonb NOT NULL DEFAULT '[]'::jsonb,
  /** Kaynak dosya (documents_vault kaydı) — orijinali kaybolmasın. */
  document_id    uuid,
  source         text NOT NULL DEFAULT 'upload',  -- upload | cowork | manual
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid,
  deleted_at     timestamptz,
  CONSTRAINT intel_reports_source_chk CHECK (source IN ('upload','cowork','manual'))
);

CREATE INDEX IF NOT EXISTS idx_intel_reports_recent
  ON intel_reports (tenant_id, report_date DESC) WHERE deleted_at IS NULL;

-- Tam metin arama: "İspanya'da geçen çeyrek ne olmuş" sorusunu yanıtlar.
-- Türkçe sözlük Postgres'te yok; 'simple' köklemesiz ama güvenilir çalışır.
CREATE INDEX IF NOT EXISTS idx_intel_reports_fts
  ON intel_reports USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || full_text));

-- ---------------------------------------------------------------------
-- Paylaşılabilir haber kalemleri — sosyal medya içerik kuyruğu.
-- Rapordaki her haber bir post/video adayı olabilir; hangisi kullanıldı,
-- hangisi bekliyor buradan takip edilir.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_report_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  report_id     uuid NOT NULL REFERENCES intel_reports(id) ON DELETE CASCADE,
  /** Haberin kendisi — rapordan alınmış, kısa ve somut. */
  headline      text NOT NULL,
  detail        text,
  market_code   text,
  /** Rapordaki hangi bölümden geldi (izlenebilirlik). */
  section       text,
  /** Spekülatif mi? Rapor bunu ayrı bölümde etiketliyor — korunmalı. */
  is_speculative boolean NOT NULL DEFAULT false,
  /** İçerik önerisi: hangi formata uygun. */
  suggested_format text,   -- reel | carousel | single_image | story | video
  /** Kuyruk durumu: paylaşıldı mı, atlandı mı. */
  status        text NOT NULL DEFAULT 'new',  -- new | queued | published | skipped
  /** Paylaşıldıysa hangi paylaşıma bağlandı (social_posts). */
  social_post_id uuid,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid,
  CONSTRAINT intel_items_status_chk CHECK (status IN ('new','queued','published','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_intel_items_queue
  ON intel_report_items (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intel_items_report
  ON intel_report_items (tenant_id, report_id);

DROP TRIGGER IF EXISTS trg_intel_reports_updated ON intel_reports;
CREATE TRIGGER trg_intel_reports_updated
  BEFORE UPDATE ON intel_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_intel_items_updated ON intel_report_items;
CREATE TRIGGER trg_intel_items_updated
  BEFORE UPDATE ON intel_report_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS — pazarlama tablolarıyla aynı desen (002s/002w/002y)
ALTER TABLE intel_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_report_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intel_reports_app ON intel_reports;
CREATE POLICY intel_reports_app ON intel_reports
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

DROP POLICY IF EXISTS intel_items_app ON intel_report_items;
CREATE POLICY intel_items_app ON intel_report_items
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

GRANT SELECT, INSERT, UPDATE, DELETE ON intel_reports, intel_report_items TO prei_app;

COMMIT;
