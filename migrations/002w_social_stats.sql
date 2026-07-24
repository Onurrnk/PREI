-- =====================================================================
-- PREI | Migration 002w — sosyal medya istatistikleri (Komuta Merkezi kartı)
-- =====================================================================
-- Neden: Sosyal hesap API'leri (Meta Graph/LinkedIn) henüz bağlı değil —
-- ad_spend (002m) ile AYNI desen: veri ELLE (Pazarlama sayfası) veya ileride
-- n8n/API ile girilir; şema değişmez, kaynak değişir.
--
-- İki tablo:
--   social_follower_snapshots — platform başına takipçi sayısı anlık
--     görüntüleri (tarihli). Büyüme = son kayıt vs ~30 gün önceki kayıt.
--   social_posts — paylaşım başına gösterim/etkileşim + getirdiği lead
--     sayısı. leads kolonu elle girilir; post_ref ileride
--     lead_attributions ile otomatik eşleşme için rezervedir.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- =====================================================================

-- 1. TAKİPÇİ ANLIK GÖRÜNTÜLERİ ------------------------------------------
CREATE TABLE IF NOT EXISTS social_follower_snapshots (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),

    platform      text NOT NULL,
    followers     integer NOT NULL DEFAULT 0,
    snapshot_date date NOT NULL DEFAULT current_date,

    metadata      jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid,

    CONSTRAINT social_snap_platform_chk CHECK (platform IN
        ('instagram','linkedin','x','youtube','tiktok','facebook','telegram')),
    CONSTRAINT social_snap_followers_chk CHECK (followers >= 0),
    CONSTRAINT social_snap_uniq UNIQUE (tenant_id, platform, snapshot_date)
);
COMMENT ON TABLE social_follower_snapshots IS
    'Platform başına takipçi sayısı anlık görüntüleri (elle/n8n). Büyüme iki kayıt farkından hesaplanır.';

CREATE INDEX IF NOT EXISTS idx_social_snap_lookup
    ON social_follower_snapshots (tenant_id, platform, snapshot_date DESC);

-- 2. PAYLAŞIMLAR ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_posts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),

    platform      text NOT NULL,
    title         text NOT NULL,                 -- paylaşım başlığı/özeti
    url           text,                          -- paylaşım linki (opsiyonel)
    post_ref      text,                          -- platform post id (ileride otomatik atıf)
    posted_at     date NOT NULL DEFAULT current_date,

    impressions   integer NOT NULL DEFAULT 0,
    engagements   integer NOT NULL DEFAULT 0,    -- beğeni+yorum+paylaşım toplamı
    leads         integer NOT NULL DEFAULT 0,    -- bu paylaşımdan gelen lead (elle/atıf)

    metadata      jsonb NOT NULL DEFAULT '{}',
    version       integer NOT NULL DEFAULT 1,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid,
    updated_by    uuid,
    deleted_at    timestamptz,

    CONSTRAINT social_post_platform_chk CHECK (platform IN
        ('instagram','linkedin','x','youtube','tiktok','facebook','telegram')),
    CONSTRAINT social_post_nonneg_chk CHECK (impressions >= 0 AND engagements >= 0 AND leads >= 0)
);
COMMENT ON TABLE social_posts IS
    'Paylaşım performansı (elle/n8n): gösterim/etkileşim + getirdiği lead. post_ref ileride lead_attributions eşleşmesi için.';

CREATE INDEX IF NOT EXISTS idx_social_posts_recent
    ON social_posts (tenant_id, posted_at DESC) WHERE deleted_at IS NULL;

-- 3. RLS: ad_spend ile aynı — ayrıcalıklı roller (danışman görmez) --------
ALTER TABLE social_follower_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_snap_privileged ON social_follower_snapshots;
CREATE POLICY social_snap_privileged ON social_follower_snapshots
    USING (tenant_id = app_tenant() AND app_is_privileged())
    WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_posts_privileged ON social_posts;
CREATE POLICY social_posts_privileged ON social_posts
    USING (tenant_id = app_tenant() AND app_is_privileged())
    WITH CHECK (tenant_id = app_tenant() AND app_is_privileged());

-- 4. updated_at + version trigger (yalnız social_posts; snapshot append-only)
DROP TRIGGER IF EXISTS trg_social_posts_updated ON social_posts;
CREATE TRIGGER trg_social_posts_updated BEFORE UPDATE ON social_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- DOWN (geri alma):
--   DROP TRIGGER IF EXISTS trg_social_posts_updated ON social_posts;
--   DROP TABLE IF EXISTS social_posts CASCADE;
--   DROP TABLE IF EXISTS social_follower_snapshots CASCADE;
-- =====================================================================
