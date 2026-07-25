-- =====================================================================
-- 002y | Pazarlama Zekâsı: tam Meta metrikleri + onay kapılı reklam kuyruğu
--
-- Üç parça:
--   1) social_insights   — hesap seviyesi GÜNLÜK metrikler (erişim, gösterim,
--                          profil görüntüleme, etkileşen hesap, tıklama)
--   2) social_posts (+)   — paylaşım başına tam performans kolonları
--   3) social_audience   — kitle kırılımı (ülke/şehir/yaş/cinsiyet)
--   4) ad_proposals      — reklam ÖNERİ kuyruğu; onay olmadan yayın YOK
--
-- ad_proposals'ın onay kuralı yalnız uygulama katmanında değil, TETİKLEYİCİ
-- ile veritabanında zorlanır: bir kod hatası ya da elle UPDATE bile onaysız
-- yayına alamaz. Bütçe onaydan sonra değişirse onay OTOMATİK DÜŞER.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Hesap seviyesi günlük metrikler
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  platform        text NOT NULL,              -- instagram | facebook
  metric_date     date NOT NULL DEFAULT CURRENT_DATE,
  followers       integer NOT NULL DEFAULT 0,
  reach           integer NOT NULL DEFAULT 0, -- tekil hesap sayısı
  impressions     integer NOT NULL DEFAULT 0, -- toplam gösterim
  profile_views   integer NOT NULL DEFAULT 0,
  accounts_engaged integer NOT NULL DEFAULT 0,
  website_clicks  integer NOT NULL DEFAULT 0,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  CONSTRAINT social_insights_uniq UNIQUE (tenant_id, platform, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_social_insights_lookup
  ON social_insights (tenant_id, platform, metric_date DESC);

-- ---------------------------------------------------------------------
-- 2) Paylaşım performansı — mevcut social_posts'a tam metrik seti
--    (impressions/engagements/leads zaten var)
-- ---------------------------------------------------------------------
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS post_type    text,                    -- feed | reel | story | video
  ADD COLUMN IF NOT EXISTS reach        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_views  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS synced_at    timestamptz;

-- ---------------------------------------------------------------------
-- 3) Kitle kırılımı — hangi ülke/şehir/yaş bizi izliyor
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_audience (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  platform      text NOT NULL,
  dimension     text NOT NULL,   -- country | city | age | gender
  bucket        text NOT NULL,   -- 'TR' | 'Istanbul' | '25-34' | 'F'
  value         integer NOT NULL DEFAULT 0,
  metric_date   date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_audience_uniq UNIQUE (tenant_id, platform, dimension, bucket, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_social_audience_lookup
  ON social_audience (tenant_id, platform, dimension, metric_date DESC);

-- ---------------------------------------------------------------------
-- 4) Reklam öneri kuyruğu — ONAY KAPISI
--
-- Akış: taslak (AI üretir) → beklemede → ONUR ONAYLAR → Meta'da DURDURULMUŞ
-- olarak yaratılır → İKİNCİ ONAY → yayına alınır.
-- Hiçbir adımda para harcanmaz; bütçe yalnız Onur'un onayladığı rakamdır.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,

  -- Öneri içeriği
  title           text NOT NULL,
  objective       text NOT NULL DEFAULT 'OUTCOME_ENGAGEMENT',
  market_code     text,
  primary_text    text,            -- reklam metni
  headline        text,
  description     text,
  call_to_action  text,
  creative_brief  text,            -- görsel/video için yönerge
  targeting       jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale       text,            -- AI neden bunu önerdi

  -- Bütçe — SADECE öneridir; onaylanmadan hiçbir şey harcanmaz
  daily_budget    numeric(15,2),
  total_budget    numeric(15,2),
  currency        text NOT NULL DEFAULT 'TRY',

  -- Durum makinesi
  status          text NOT NULL DEFAULT 'draft',
                  -- draft | pending | approved | rejected | published | archived
  publish_state   text NOT NULL DEFAULT 'none',
                  -- none | paused | active
  source          text NOT NULL DEFAULT 'ai',   -- ai | manual

  -- Denetim izi — onay kimliği ASLA silinemez (tetikleyici korur)
  approved_by     uuid,
  approved_at     timestamptz,
  rejected_by     uuid,
  rejected_at     timestamptz,
  rejection_note  text,
  activated_by    uuid,
  activated_at    timestamptz,
  published_at    timestamptz,

  -- Meta tarafındaki karşılıkları (yalnız onaydan sonra dolar)
  meta_campaign_id text,
  meta_adset_id    text,
  meta_ad_id       text,

  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,

  CONSTRAINT ad_proposals_status_chk
    CHECK (status IN ('draft','pending','approved','rejected','published','archived')),
  CONSTRAINT ad_proposals_publish_chk
    CHECK (publish_state IN ('none','paused','active')),
  -- Bütçe negatif olamaz
  CONSTRAINT ad_proposals_budget_chk
    CHECK (COALESCE(daily_budget, 0) >= 0 AND COALESCE(total_budget, 0) >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ad_proposals_queue
  ON ad_proposals (tenant_id, status, created_at DESC) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- ONAY KAPISI — veritabanı seviyesinde zorlanır
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ad_proposal_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Bütçe onaydan SONRA değiştiyse onay otomatik düşer (yeniden onay şart).
  -- Böylece "onaylanmış" bir öneriye sonradan yüksek bütçe yazılamaz.
  IF TG_OP = 'UPDATE' AND OLD.approved_at IS NOT NULL THEN
    IF NEW.daily_budget IS DISTINCT FROM OLD.daily_budget
       OR NEW.total_budget IS DISTINCT FROM OLD.total_budget
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      -- Zaten yayındaysa sessizce düşürmek tehlikeli: açıkça reddet.
      IF OLD.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'Yayındaki reklamın bütçesi doğrudan değiştirilemez — önce durdurun ve yeniden onaylayın';
      END IF;
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
      NEW.status := 'pending';
    END IF;
  END IF;

  -- Meta'ya gönderim (published_at) ONAYSIZ olamaz.
  IF NEW.published_at IS NOT NULL AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN
    RAISE EXCEPTION 'Reklam onaysız yayına alınamaz (approved_by/approved_at boş)';
  END IF;

  -- Yayına ALMA (active) AYRI ve ikinci bir onay ister.
  IF NEW.publish_state = 'active' AND (NEW.activated_by IS NULL OR NEW.activated_at IS NULL) THEN
    RAISE EXCEPTION 'Reklam onaysız aktifleştirilemez (activated_by/activated_at boş)';
  END IF;

  -- Denetim izi geri alınamaz: onay/aktifleştirme kaydı silinemez.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.activated_at IS NOT NULL AND NEW.activated_at IS NULL THEN
      RAISE EXCEPTION 'Aktifleştirme kaydı silinemez (denetim izi)';
    END IF;
    IF OLD.published_at IS NOT NULL AND NEW.published_at IS NULL THEN
      RAISE EXCEPTION 'Yayın kaydı silinemez (denetim izi)';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ad_proposal_guard ON ad_proposals;
CREATE TRIGGER trg_ad_proposal_guard
  BEFORE INSERT OR UPDATE ON ad_proposals
  FOR EACH ROW EXECUTE FUNCTION ad_proposal_guard();

DROP TRIGGER IF EXISTS trg_ad_proposals_updated ON ad_proposals;
CREATE TRIGGER trg_ad_proposals_updated
  BEFORE UPDATE ON ad_proposals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_social_insights_updated ON social_insights;
CREATE TRIGGER trg_social_insights_updated
  BEFORE UPDATE ON social_insights
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- RLS — diğer pazarlama tablolarıyla aynı desen (002s/002w)
-- ---------------------------------------------------------------------
ALTER TABLE social_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_audience ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_proposals    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_insights_app ON social_insights;
CREATE POLICY social_insights_app ON social_insights
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

DROP POLICY IF EXISTS social_audience_app ON social_audience;
CREATE POLICY social_audience_app ON social_audience
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

DROP POLICY IF EXISTS ad_proposals_app ON ad_proposals;
CREATE POLICY ad_proposals_app ON ad_proposals
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

GRANT SELECT, INSERT, UPDATE, DELETE ON social_insights, social_audience, ad_proposals TO prei_app;

COMMIT;
