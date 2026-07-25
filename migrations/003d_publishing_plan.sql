-- =====================================================================
-- 003d | Haftalık yayın akışı.
--
-- Onur'un kuralı: LinkedIn ELLE paylaşılır (otomasyon ban riski taşır),
-- Meta da elle paylaşılır (organik paylaşım izni yok + tercih böyle).
-- Sistem HAZIRLAR ve PLANLAR; paylaşan insan.
--
-- Bu yüzden burada "publish" eylemi YOK — yalnız hazırlık, plan ve
-- "paylaştım" işaretleme var.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS publishing_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  report_id     uuid REFERENCES intel_reports(id) ON DELETE SET NULL,
  /** Yayın haftası — daima PAZARTESİ. */
  week_start    date NOT NULL,
  week_end      date NOT NULL,
  /** Drive'daki haftalık klasör (LinkedIn dosyaları orada). */
  drive_folder_id   text,
  drive_folder_link text,
  status        text NOT NULL DEFAULT 'draft',  -- draft | ready | archived
  model         text,
  /** Kullanılmayan başlıklar ve nedeni (şeffaflık). */
  skipped       jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid,
  deleted_at    timestamptz,
  CONSTRAINT publishing_plans_status_chk CHECK (status IN ('draft','ready','archived')),
  CONSTRAINT publishing_plans_week_uniq UNIQUE (tenant_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_publishing_plans_week
  ON publishing_plans (tenant_id, week_start DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS publishing_plan_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  plan_id       uuid NOT NULL REFERENCES publishing_plans(id) ON DELETE CASCADE,
  /** Yayın günü. */
  scheduled_date date NOT NULL,
  day_name      text NOT NULL,
  kind          text NOT NULL,          -- post | carousel
  order_index   integer NOT NULL,
  /** Kanallar: LinkedIn yalnız postlarda, Meta hepsinde. */
  for_linkedin  boolean NOT NULL DEFAULT false,
  for_meta      boolean NOT NULL DEFAULT true,

  -- İçerik
  title         text NOT NULL,
  hook          text,
  body          text,                   -- LinkedIn gövdesi
  instagram_caption text,               -- Meta için kısa hâli
  hashtags      text[] NOT NULL DEFAULT '{}',
  market_code   text,
  source_section text,
  /** Karusel slaytları: [{index, headline, body, imagePrompt}] */
  slides        jsonb NOT NULL DEFAULT '[]'::jsonb,

  /** Drive'daki LinkedIn dosyası. */
  drive_file_id   text,
  drive_file_link text,

  /** Onur'un takibi: hazır → paylaştım / atladım. */
  status        text NOT NULL DEFAULT 'ready',
  published_at  timestamptz,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid,
  CONSTRAINT plan_items_kind_chk CHECK (kind IN ('post','carousel')),
  CONSTRAINT plan_items_status_chk CHECK (status IN ('ready','published','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_plan_items_plan
  ON publishing_plan_items (tenant_id, plan_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_plan_items_date
  ON publishing_plan_items (tenant_id, scheduled_date, status);

-- Karusel görselleri plan kalemine bağlanır (003c'deki paket görselleri
-- geneldi; buradakiler yayın akışına ait).
ALTER TABLE intel_carousel_images
  ADD COLUMN IF NOT EXISTS plan_item_id uuid REFERENCES publishing_plan_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_intel_images_plan_item
  ON intel_carousel_images (tenant_id, plan_item_id, slide_index);

-- pack_id artık zorunlu değil: yayın akışı görselleri pack'e bağlı olmayabilir.
ALTER TABLE intel_carousel_images ALTER COLUMN pack_id DROP NOT NULL;

DROP TRIGGER IF EXISTS trg_publishing_plans_updated ON publishing_plans;
CREATE TRIGGER trg_publishing_plans_updated
  BEFORE UPDATE ON publishing_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_plan_items_updated ON publishing_plan_items;
CREATE TRIGGER trg_plan_items_updated
  BEFORE UPDATE ON publishing_plan_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE publishing_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS publishing_plans_app ON publishing_plans;
CREATE POLICY publishing_plans_app ON publishing_plans
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

DROP POLICY IF EXISTS plan_items_app ON publishing_plan_items;
CREATE POLICY plan_items_app ON publishing_plan_items
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

GRANT SELECT, INSERT, UPDATE, DELETE ON publishing_plans, publishing_plan_items TO prei_app;

COMMIT;
