-- =====================================================================
-- 002z | Pazarlama Yöneticisi: hedefler + döngü hafızası + eylem tipleri
--
-- Bir "analizci" ile "yönetici" arasındaki fark üç şey:
--   1) HEDEFİ vardır          → marketing_goals
--   2) NE DENEDİĞİNİ HATIRLAR → marketing_runs (her çalışmanın kaydı)
--   3) MEVCUDU DÜZELTİR       → ad_proposals.kind = 'optimization'
--
-- Onay kuralı değişmedi: her eylem (yeni kampanya, bütçe kaydırma,
-- hedefleme değişikliği) ad_proposals'tan geçer ve 002y tetikleyicisi
-- onaysız yayını/harcamayı engellemeye devam eder.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) HEDEFLER — "artır" sözü ölçülebilir olmadan yönetilemez
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  metric       text NOT NULL,          -- followers | reach | leads | profile_views
  target_value numeric(15,2) NOT NULL,
  period       text NOT NULL DEFAULT 'monthly',  -- monthly | quarterly
  market_code  text,                   -- boş = tüm pazarlar
  is_active    boolean NOT NULL DEFAULT true,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  CONSTRAINT marketing_goals_metric_chk
    CHECK (metric IN ('followers','reach','leads','profile_views','engagement')),
  CONSTRAINT marketing_goals_period_chk CHECK (period IN ('monthly','quarterly')),
  CONSTRAINT marketing_goals_positive CHECK (target_value > 0)
);

-- Benzersizlik: aynı metrik+dönem+pazar için tek hedef.
-- UNIQUE kısıtı ifade alamadığı için indeks kullanılır (market_code NULL olabilir).
CREATE UNIQUE INDEX IF NOT EXISTS marketing_goals_uniq
  ON marketing_goals (tenant_id, metric, period, COALESCE(market_code, ''));

-- ---------------------------------------------------------------------
-- 2) DÖNGÜ HAFIZASI — yönetici geçen sefer ne dediğini ve ne olduğunu bilir
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  run_at        timestamptz NOT NULL DEFAULT now(),
  -- Çalışma anındaki ölçümler (sonraki çalışma bununla kıyaslar)
  snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Yöneticinin okuması: durum değerlendirmesi, hedeflere ilerleme
  assessment    text,
  -- Geçen çalışmadaki önerilerin ne olduğu (onaylandı/reddedildi/sonuç)
  previous_review text,
  -- Üretilen eylem sayıları
  proposals_created integer NOT NULL DEFAULT 0,
  stage         text NOT NULL DEFAULT 'setup',   -- setup | growth | optimization
  model         text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    uuid
);

CREATE INDEX IF NOT EXISTS idx_marketing_runs_recent
  ON marketing_runs (tenant_id, run_at DESC);

-- ---------------------------------------------------------------------
-- 3) EYLEM TİPLERİ — yeni kampanya / mevcut kampanya düzeltmesi / içerik
-- ---------------------------------------------------------------------
ALTER TABLE ad_proposals
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'new_campaign',
  ADD COLUMN IF NOT EXISTS target_campaign_ref text,   -- optimization ise hangi kampanya
  ADD COLUMN IF NOT EXISTS expected_impact text,       -- yönetici ne bekliyor
  ADD COLUMN IF NOT EXISTS run_id uuid;                -- hangi çalışmadan çıktı

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ad_proposals_kind_chk') THEN
    ALTER TABLE ad_proposals ADD CONSTRAINT ad_proposals_kind_chk
      CHECK (kind IN ('new_campaign','optimization','content','pause'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ad_proposals_run ON ad_proposals (run_id);

-- ---------------------------------------------------------------------
-- Tetikleyiciler + RLS (002y ile aynı desen)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_marketing_goals_updated ON marketing_goals;
CREATE TRIGGER trg_marketing_goals_updated
  BEFORE UPDATE ON marketing_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE marketing_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_runs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_goals_app ON marketing_goals;
CREATE POLICY marketing_goals_app ON marketing_goals
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

DROP POLICY IF EXISTS marketing_runs_app ON marketing_runs;
CREATE POLICY marketing_runs_app ON marketing_runs
  USING (tenant_id = app_tenant() AND app_is_privileged())
  WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_goals, marketing_runs TO prei_app;

-- ---------------------------------------------------------------------
-- Başlangıç hedefleri — mevcut duruma göre gerçekçi, sonra düzenlenebilir.
-- 143 IG + 21 FB takipçi, 0 paylaşım: hedefler mütevazı ve ulaşılabilir.
-- ---------------------------------------------------------------------
INSERT INTO marketing_goals (tenant_id, metric, target_value, period, note)
SELECT t.id, g.metric, g.target_value, 'monthly', g.note
  FROM tenants t
 CROSS JOIN (VALUES
   ('followers',     50::numeric, 'Aylık net yeni takipçi (mevcut ~164)'),
   ('reach',      5000::numeric, 'Aylık erişilen tekil hesap'),
   ('leads',        10::numeric, 'Aylık sosyal kaynaklı müşteri adayı')
 ) AS g(metric, target_value, note)
 WHERE NOT EXISTS (
   SELECT 1 FROM marketing_goals mg
    WHERE mg.tenant_id = t.id AND mg.metric = g.metric AND mg.period = 'monthly'
 );

COMMIT;
