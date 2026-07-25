// =====================================================================
// PREI | SocialService — sosyal medya istatistikleri (002w).
// Takipçi anlık görüntüleri + paylaşım performansı. Veri elle (Pazarlama
// sayfası) veya ileride n8n/API ile girilir — ad_spend ile aynı desen.
// Büyüme: platformun SON kaydı vs ~30 gün önceki en yakın kaydı.
// =====================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { AppConfig } from '../../config/configuration';
import type { CreateSocialPostDto, UpsertFollowersDto } from './dto/social.dto';
import {
  fetchSocialPages, fetchIgPosts, fetchIgDaily, fetchIgAudience,
  fetchIgPostInsights, fetchPageFollowers,
} from './meta-ads';

export interface SocialMetaSyncResult {
  ok: boolean;
  configured: boolean;
  pagesFound: number;
  snapshots: number;          // yazılan takipçi kaydı sayısı
  postsUpserted: number;
  insightsWritten: number;    // hesap seviyesi günlük metrik kaydı
  audienceRows: number;       // kitle kırılımı satırı (ülke/şehir/yaş/cinsiyet)
  message?: string;           // 'skipped' nedeni (sayfa atanmamış vb.)
}

export interface SocialPlatformStat {
  platform: string;
  followers: number;
  deltaPct: number | null;   // ~30 günlük değişim yüzdesi (kıyas kaydı yoksa null)
  asOf: string;              // son kayıt tarihi (YYYY-MM-DD)
}

export interface SocialPostItem {
  id: string;
  platform: string;
  title: string;
  url: string | null;
  postedAt: string;
  impressions: number;
  engagements: number;
  leads: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoViews: number;
  /** Etkileşim / erişim — hangi paylaşım gerçekten "tuttu". */
  engagementRate: number | null;
  source: 'auto' | 'manual';          // meta_sync → auto (UI: elle girişten ayrışsın)
}

/** Hesap seviyesi 30 günlük görünürlük — takipçiden ÖNCE gelen metrikler. */
export interface SocialReachStats {
  reach: number;
  impressions: number;
  profileViews: number;
  accountsEngaged: number;
  websiteClicks: number;
  reachDeltaPct: number | null;
  profileViewsDeltaPct: number | null;
}

/** Kitle kırılımı satırı — bizi kim takip ediyor. */
export interface SocialAudienceRow {
  dimension: string;   // country | city | age | gender
  bucket: string;
  value: number;
}

export interface SocialSummary {
  hasData: boolean;
  totalFollowers: number;
  totalDeltaPct: number | null;
  platforms: SocialPlatformStat[];
  topPosts: SocialPostItem[];         // etkileşime göre ilk 5 (son 90 gün)
  totals30d: { posts: number; engagements: number; leads: number };
  reach30d: SocialReachStats;
  audience: SocialAudienceRow[];
  metaLastSyncAt: string | null;      // Meta otomatik senkronunun son çalışma zamanı
}

/** Yüzde değişim; önceki 0/yok ise null (yanıltıcı ∞ göstermeyiz). */
export function pctDelta(current: number, previous: number | null): number | null {
  if (previous == null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Meta Graph'tan OTOMATİK sosyal senkron: Facebook sayfası + bağlı Instagram
   * business hesabının takipçi sayıları (bugünün snapshot'ı) ve son IG
   * paylaşımları (beğeni+yorum → engagements; post_ref ile upsert — elle
   * girilen leads değeri EZİLMEZ). Sayfa, Business Manager'da PREI CRM sistem
   * kullanıcısına atanmamışsa dürüstçe 'skipped' döner (hata değil).
   */
  async syncFromMeta(ctx: RequestContext): Promise<SocialMetaSyncResult> {
    const meta = this.config.get('metaAds', { infer: true });
    if (!meta.accessToken) {
      return {
        ok: false, configured: false, pagesFound: 0, snapshots: 0, postsUpserted: 0,
        insightsWritten: 0, audienceRows: 0, message: 'META_ADS_ACCESS_TOKEN tanımlı değil',
      };
    }

    const pages = await fetchSocialPages(meta.accessToken, meta.apiVersion);
    if (pages.length === 0) {
      return {
        ok: true, configured: true, pagesFound: 0, snapshots: 0, postsUpserted: 0,
        insightsWritten: 0, audienceRows: 0,
        message: 'Erişilebilir sayfa yok — Business Manager > Sistem Kullanıcıları > PREI CRM altına Facebook sayfasını atayın.',
      };
    }

    let snapshots = 0;
    let postsUpserted = 0;
    let insightsWritten = 0;
    let audienceRows = 0;

    await this.db.withContext(ctx, async (c) => {
      for (const p of pages) {
        if (p.fbFollowers != null) {
          await c.query(
            `INSERT INTO social_follower_snapshots (tenant_id, platform, followers, snapshot_date, metadata, created_by)
             VALUES ($1,'facebook',$2,current_date,$3,$4)
             ON CONFLICT (tenant_id, platform, snapshot_date)
             DO UPDATE SET followers = EXCLUDED.followers, metadata = EXCLUDED.metadata`,
            [ctx.tenantId, p.fbFollowers, JSON.stringify({ source: 'meta_sync', page: p.pageName }), ctx.userId],
          );
          snapshots++;
        }
        if (p.igId && p.igFollowers != null) {
          await c.query(
            `INSERT INTO social_follower_snapshots (tenant_id, platform, followers, snapshot_date, metadata, created_by)
             VALUES ($1,'instagram',$2,current_date,$3,$4)
             ON CONFLICT (tenant_id, platform, snapshot_date)
             DO UPDATE SET followers = EXCLUDED.followers, metadata = EXCLUDED.metadata`,
            [ctx.tenantId, p.igFollowers, JSON.stringify({ source: 'meta_sync', username: p.igUsername }), ctx.userId],
          );
          snapshots++;
        }

        // Facebook sayfası: günlük metrik satırı (takipçi; Page Insights
        // metrikleri bu API sürümünde kapalı — olanı yazarız, uydurmayız).
        const fbFollowers = p.fbFollowers
          ?? await fetchPageFollowers(meta.accessToken, meta.apiVersion, p.pageId);
        if (fbFollowers != null) {
          await c.query(
            `INSERT INTO social_insights (tenant_id, platform, metric_date, followers, metadata, created_by)
             VALUES ($1,'facebook',current_date,$2,$3,$4)
             ON CONFLICT (tenant_id, platform, metric_date)
             DO UPDATE SET followers = EXCLUDED.followers, metadata = EXCLUDED.metadata, updated_at = now()`,
            [ctx.tenantId, fbFollowers, JSON.stringify({ source: 'meta_sync', page: p.pageName }), ctx.userId],
          );
          insightsWritten++;
        }

        if (!p.igId) continue;

        // Instagram hesap seviyesi GÜNLÜK metrikler: erişim, gösterim,
        // profil görüntüleme, etkileşen hesap, site tıklaması.
        const daily = await fetchIgDaily(meta.accessToken, meta.apiVersion, p.igId);
        await c.query(
          `INSERT INTO social_insights
             (tenant_id, platform, metric_date, followers, reach, impressions,
              profile_views, accounts_engaged, website_clicks, metadata, created_by)
           VALUES ($1,'instagram',current_date,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (tenant_id, platform, metric_date) DO UPDATE SET
             followers = EXCLUDED.followers, reach = EXCLUDED.reach,
             impressions = EXCLUDED.impressions, profile_views = EXCLUDED.profile_views,
             accounts_engaged = EXCLUDED.accounts_engaged,
             website_clicks = EXCLUDED.website_clicks,
             metadata = EXCLUDED.metadata, updated_at = now()`,
          [ctx.tenantId, p.igFollowers ?? 0, daily.reach, daily.reach /* gösterim ayrı uçta yok */,
           daily.profileViews, daily.accountsEngaged, daily.websiteClicks,
           JSON.stringify({ source: 'meta_sync', username: p.igUsername }), ctx.userId],
        );
        insightsWritten++;

        // Kitle kırılımı: bizi kim takip ediyor (ülke/şehir/yaş/cinsiyet).
        // Pazar stratejisi için en değerli veri — hangi ülkeden ilgi var.
        const audience = await fetchIgAudience(meta.accessToken, meta.apiVersion, p.igId);
        for (const a of audience) {
          await c.query(
            `INSERT INTO social_audience (tenant_id, platform, dimension, bucket, value, metric_date)
             VALUES ($1,'instagram',$2,$3,$4,current_date)
             ON CONFLICT (tenant_id, platform, dimension, bucket, metric_date)
             DO UPDATE SET value = EXCLUDED.value`,
            [ctx.tenantId, a.dimension, a.bucket, a.value],
          );
          audienceRows++;
        }

        // Paylaşımlar — her biri için ayrıca performans metrikleri.
        // post_ref ile upsert; elle girilen leads EZİLMEZ.
        const posts = await fetchIgPosts(meta.accessToken, meta.apiVersion, p.igId).catch((e) => {
          this.logger.warn(`IG media çekilemedi (${p.igUsername ?? p.igId}): ${(e as Error).message}`);
          return [];
        });
        for (const m of posts) {
          const ins = await fetchIgPostInsights(meta.accessToken, meta.apiVersion, m.postRef);
          // Etkileşim: Meta'nın toplam etkileşimi varsa onu kullan, yoksa
          // beğeni+yorum+paylaşım+kaydetme'den kendimiz topla.
          const engagements = ins.totalInteractions
            || (m.likeCount + m.commentsCount + ins.shares + ins.saves);
          const meta_ = JSON.stringify({
            source: 'meta_sync', likes: m.likeCount, comments: m.commentsCount,
          });
          const res = await c.query(
            `UPDATE social_posts SET
               title = $3, url = $4, impressions = GREATEST(impressions, $5),
               engagements = $6, reach = $7, likes = $8, comments = $9,
               shares = $10, saves = $11, video_views = $12,
               synced_at = now(), updated_by = $13, metadata = metadata || $14::jsonb
             WHERE tenant_id = $1 AND post_ref = $2 AND deleted_at IS NULL`,
            [ctx.tenantId, m.postRef, m.caption, m.permalink, ins.impressions,
             engagements, ins.reach, m.likeCount, m.commentsCount,
             ins.shares, ins.saves, ins.videoViews, ctx.userId, meta_],
          );
          if ((res.rowCount ?? 0) === 0) {
            await c.query(
              `INSERT INTO social_posts
                 (tenant_id, platform, title, url, post_ref, posted_at, impressions,
                  engagements, leads, reach, likes, comments, shares, saves, video_views,
                  synced_at, metadata, created_by, updated_by)
               VALUES ($1,'instagram',$2,$3,$4,$5::date,$6,$7,0,$8,$9,$10,$11,$12,$13,now(),$14,$15,$15)`,
              [ctx.tenantId, m.caption, m.permalink, m.postRef, m.timestamp.slice(0, 10),
               ins.impressions, engagements, ins.reach, m.likeCount, m.commentsCount,
               ins.shares, ins.saves, ins.videoViews, meta_, ctx.userId],
            );
          }
          postsUpserted++;
        }
      }
    });

    this.logger.log(
      `Sosyal senkron: ${pages.length} sayfa, ${snapshots} takipçi, ` +
      `${insightsWritten} metrik, ${audienceRows} kitle satırı, ${postsUpserted} paylaşım`,
    );
    return {
      ok: true, configured: true, pagesFound: pages.length,
      snapshots, postsUpserted, insightsWritten, audienceRows,
    };
  }

  async summary(ctx: RequestContext): Promise<SocialSummary> {
    return this.db.withContext(ctx, async (c) => {
      // Platform başına: son kayıt + ~30 gün öncesine en yakın kayıt
      const { rows: plat } = await c.query<{
        platform: string; followers: string; snapshot_date: string; prev_followers: string | null;
      }>(
        `SELECT s.platform, s.followers, to_char(s.snapshot_date,'YYYY-MM-DD') AS snapshot_date,
                (SELECT p.followers FROM social_follower_snapshots p
                  WHERE p.platform = s.platform
                    AND p.snapshot_date <= s.snapshot_date - interval '25 days'
                  ORDER BY p.snapshot_date DESC LIMIT 1) AS prev_followers
           FROM social_follower_snapshots s
          WHERE s.snapshot_date = (SELECT max(s2.snapshot_date)
                                     FROM social_follower_snapshots s2
                                    WHERE s2.platform = s.platform)
          ORDER BY s.followers DESC`,
      );

      const { rows: posts } = await c.query<{
        id: string; platform: string; title: string; url: string | null;
        posted_at: string; impressions: string; engagements: string; leads: string; src: string | null;
        reach: string; likes: string; comments: string; shares: string; saves: string; video_views: string;
      }>(
        `SELECT id, platform, title, url, to_char(posted_at,'YYYY-MM-DD') AS posted_at,
                impressions, engagements, leads, metadata->>'source' AS src,
                reach, likes, comments, shares, saves, video_views
           FROM social_posts
          WHERE deleted_at IS NULL AND posted_at >= current_date - interval '90 days'
          ORDER BY engagements DESC, posted_at DESC
          LIMIT 5`,
      );

      const { rows: tot } = await c.query<{ posts: string; engagements: string; leads: string }>(
        `SELECT count(*) AS posts, COALESCE(SUM(engagements),0) AS engagements, COALESCE(SUM(leads),0) AS leads
           FROM social_posts
          WHERE deleted_at IS NULL AND posted_at >= current_date - interval '30 days'`,
      );

      const { rows: sync } = await c.query<{ last: string | null }>(
        `SELECT max(created_at)::text AS last FROM social_follower_snapshots
          WHERE metadata->>'source' = 'meta_sync'`,
      );

      // Son 30 günün hesap metrikleri + bir önceki 30 günle kıyas.
      const { rows: reachRows } = await c.query<{
        reach: string; impressions: string; profile_views: string;
        accounts_engaged: string; website_clicks: string;
        prev_reach: string; prev_views: string;
      }>(
        `SELECT
           COALESCE(SUM(reach) FILTER (WHERE metric_date >= current_date - 30),0) AS reach,
           COALESCE(SUM(impressions) FILTER (WHERE metric_date >= current_date - 30),0) AS impressions,
           COALESCE(SUM(profile_views) FILTER (WHERE metric_date >= current_date - 30),0) AS profile_views,
           COALESCE(SUM(accounts_engaged) FILTER (WHERE metric_date >= current_date - 30),0) AS accounts_engaged,
           COALESCE(SUM(website_clicks) FILTER (WHERE metric_date >= current_date - 30),0) AS website_clicks,
           COALESCE(SUM(reach) FILTER (WHERE metric_date >= current_date - 60
                                         AND metric_date < current_date - 30),0) AS prev_reach,
           COALESCE(SUM(profile_views) FILTER (WHERE metric_date >= current_date - 60
                                                 AND metric_date < current_date - 30),0) AS prev_views
         FROM social_insights`,
      );

      // Kitle kırılımı — her boyutun EN SON tarihli kaydı (kümülatif değil).
      const { rows: aud } = await c.query<{ dimension: string; bucket: string; value: string }>(
        `SELECT a.dimension, a.bucket, a.value
           FROM social_audience a
          WHERE a.metric_date = (SELECT max(a2.metric_date) FROM social_audience a2
                                  WHERE a2.dimension = a.dimension AND a2.platform = a.platform)
          ORDER BY a.dimension, a.value DESC`,
      );

      const platforms: SocialPlatformStat[] = plat.map((p) => ({
        platform: p.platform,
        followers: Number(p.followers),
        deltaPct: pctDelta(Number(p.followers), p.prev_followers != null ? Number(p.prev_followers) : null),
        asOf: p.snapshot_date,
      }));

      const totalFollowers = platforms.reduce((s, p) => s + p.followers, 0);
      const prevTotal = plat.reduce(
        (s, p) => (p.prev_followers != null ? s + Number(p.prev_followers) : s), 0);
      const allHavePrev = plat.length > 0 && plat.every((p) => p.prev_followers != null);

      return {
        hasData: platforms.length > 0 || posts.length > 0,
        totalFollowers,
        totalDeltaPct: allHavePrev ? pctDelta(totalFollowers, prevTotal) : null,
        platforms,
        topPosts: posts.map((p) => {
          const reach = Number(p.reach);
          const engagements = Number(p.engagements);
          return {
            id: p.id, platform: p.platform, title: p.title, url: p.url,
            postedAt: p.posted_at,
            impressions: Number(p.impressions), engagements, leads: Number(p.leads),
            reach, likes: Number(p.likes), comments: Number(p.comments),
            shares: Number(p.shares), saves: Number(p.saves), videoViews: Number(p.video_views),
            // Erişim yoksa oran uydurma — null göster.
            engagementRate: reach > 0 ? Math.round((engagements / reach) * 1000) / 10 : null,
            source: (p.src === 'meta_sync' ? 'auto' : 'manual') as 'auto' | 'manual',
          };
        }),
        totals30d: {
          posts: Number(tot[0]?.posts ?? 0),
          engagements: Number(tot[0]?.engagements ?? 0),
          leads: Number(tot[0]?.leads ?? 0),
        },
        reach30d: {
          reach: Number(reachRows[0]?.reach ?? 0),
          impressions: Number(reachRows[0]?.impressions ?? 0),
          profileViews: Number(reachRows[0]?.profile_views ?? 0),
          accountsEngaged: Number(reachRows[0]?.accounts_engaged ?? 0),
          websiteClicks: Number(reachRows[0]?.website_clicks ?? 0),
          reachDeltaPct: pctDelta(
            Number(reachRows[0]?.reach ?? 0), Number(reachRows[0]?.prev_reach ?? 0) || null),
          profileViewsDeltaPct: pctDelta(
            Number(reachRows[0]?.profile_views ?? 0), Number(reachRows[0]?.prev_views ?? 0) || null),
        },
        audience: aud.map((a) => ({
          dimension: a.dimension, bucket: a.bucket, value: Number(a.value),
        })),
        metaLastSyncAt: sync[0]?.last ?? null,
      };
    });
  }

  /** Takipçi anlık görüntüsü — aynı gün/platform varsa üzerine yazar. */
  async upsertFollowers(ctx: RequestContext, dto: UpsertFollowersDto): Promise<{ ok: true }> {
    await this.db.withContext(ctx, (c) =>
      c.query(
        `INSERT INTO social_follower_snapshots (tenant_id, platform, followers, snapshot_date, created_by)
         VALUES ($1,$2,$3,COALESCE($4::date, current_date),$5)
         ON CONFLICT (tenant_id, platform, snapshot_date)
         DO UPDATE SET followers = EXCLUDED.followers`,
        [ctx.tenantId, dto.platform, dto.followers, dto.snapshotDate ?? null, ctx.userId],
      ),
    );
    return { ok: true };
  }

  async createPost(ctx: RequestContext, dto: CreateSocialPostDto): Promise<SocialPostItem> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; platform: string; title: string; url: string | null;
        posted_at: string; impressions: string; engagements: string; leads: string;
      }>(
        `INSERT INTO social_posts (tenant_id, platform, title, url, posted_at, impressions, engagements, leads, created_by, updated_by)
         VALUES ($1,$2,$3,$4,COALESCE($5::date,current_date),$6,$7,$8,$9,$9)
         RETURNING id, platform, title, url, to_char(posted_at,'YYYY-MM-DD') AS posted_at, impressions, engagements, leads`,
        [ctx.tenantId, dto.platform, dto.title.trim(), dto.url?.trim() || null, dto.postedAt ?? null,
         dto.impressions ?? 0, dto.engagements ?? 0, dto.leads ?? 0, ctx.userId],
      );
      const r = rows[0];
      // Elle eklenen paylaşımda detay metrikler yok; Meta senkronu gelince dolar.
      return {
        id: r.id, platform: r.platform, title: r.title, url: r.url, postedAt: r.posted_at,
        impressions: Number(r.impressions), engagements: Number(r.engagements), leads: Number(r.leads),
        reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, videoViews: 0,
        engagementRate: null,
        source: 'manual' as const,
      };
    });
  }

  /** Paylaşımın lead sayısını günceller — otomatik senkronlanan (Meta) paylaşımlarda
   *  da kullanılır: atıf otomasyonu gelene dek "bu paylaşım kaç lead getirdi"
   *  bilgisini danışman girer; meta_sync bu alanı EZMEZ. */
  async updatePostLeads(ctx: RequestContext, id: string, leads: number): Promise<{ ok: true }> {
    const n = await this.db.withContext(ctx, async (c) => {
      const res = await c.query(
        `UPDATE social_posts SET leads = $2, updated_by = $3
          WHERE id = $1 AND deleted_at IS NULL`,
        [id, leads, ctx.userId],
      );
      return res.rowCount ?? 0;
    });
    if (n === 0) throw new NotFoundException('Paylaşım bulunamadı');
    return { ok: true };
  }

  async removePost(ctx: RequestContext, id: string): Promise<{ deleted: true }> {
    const n = await this.db.withContext(ctx, async (c) => {
      const res = await c.query(
        `UPDATE social_posts SET deleted_at = now(), updated_by = $2
          WHERE id = $1 AND deleted_at IS NULL`,
        [id, ctx.userId],
      );
      return res.rowCount ?? 0;
    });
    if (n === 0) throw new NotFoundException('Paylaşım bulunamadı');
    return { deleted: true };
  }
}
