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
import { fetchSocialPages, fetchIgPosts } from './meta-ads';

export interface SocialMetaSyncResult {
  ok: boolean;
  configured: boolean;
  pagesFound: number;
  snapshots: number;          // yazılan takipçi kaydı sayısı
  postsUpserted: number;
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
}

export interface SocialSummary {
  hasData: boolean;
  totalFollowers: number;
  totalDeltaPct: number | null;
  platforms: SocialPlatformStat[];
  topPosts: SocialPostItem[];         // etkileşime göre ilk 5 (son 90 gün)
  totals30d: { posts: number; engagements: number; leads: number };
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
      return { ok: false, configured: false, pagesFound: 0, snapshots: 0, postsUpserted: 0, message: 'META_ADS_ACCESS_TOKEN tanımlı değil' };
    }

    const pages = await fetchSocialPages(meta.accessToken, meta.apiVersion);
    if (pages.length === 0) {
      return {
        ok: true, configured: true, pagesFound: 0, snapshots: 0, postsUpserted: 0,
        message: 'Erişilebilir sayfa yok — Business Manager > Sistem Kullanıcıları > PREI CRM altına Facebook sayfasını atayın.',
      };
    }

    let snapshots = 0;
    let postsUpserted = 0;

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

        // Son IG paylaşımları — post_ref ile upsert; elle girilen leads korunur.
        if (p.igId) {
          const posts = await fetchIgPosts(meta.accessToken, meta.apiVersion, p.igId).catch((e) => {
            this.logger.warn(`IG media çekilemedi (${p.igUsername ?? p.igId}): ${(e as Error).message}`);
            return [];
          });
          for (const m of posts) {
            const res = await c.query(
              `UPDATE social_posts SET
                 title = $3, url = $4, impressions = GREATEST(impressions, $5),
                 engagements = $6, updated_by = $7, metadata = metadata || $8::jsonb
               WHERE tenant_id = $1 AND post_ref = $2 AND deleted_at IS NULL`,
              [ctx.tenantId, m.postRef, m.caption, m.permalink,
               0, m.likeCount + m.commentsCount, ctx.userId,
               JSON.stringify({ source: 'meta_sync', likes: m.likeCount, comments: m.commentsCount })],
            );
            if ((res.rowCount ?? 0) === 0) {
              await c.query(
                `INSERT INTO social_posts (tenant_id, platform, title, url, post_ref, posted_at, impressions, engagements, leads, metadata, created_by, updated_by)
                 VALUES ($1,'instagram',$2,$3,$4,$5::date,0,$6,0,$7,$8,$8)`,
                [ctx.tenantId, m.caption, m.permalink, m.postRef, m.timestamp.slice(0, 10),
                 m.likeCount + m.commentsCount,
                 JSON.stringify({ source: 'meta_sync', likes: m.likeCount, comments: m.commentsCount }), ctx.userId],
              );
            }
            postsUpserted++;
          }
        }
      }
    });

    this.logger.log(`Sosyal senkron: ${pages.length} sayfa, ${snapshots} snapshot, ${postsUpserted} paylaşım`);
    return { ok: true, configured: true, pagesFound: pages.length, snapshots, postsUpserted };
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
        posted_at: string; impressions: string; engagements: string; leads: string;
      }>(
        `SELECT id, platform, title, url, to_char(posted_at,'YYYY-MM-DD') AS posted_at,
                impressions, engagements, leads
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
        topPosts: posts.map((p) => ({
          id: p.id, platform: p.platform, title: p.title, url: p.url,
          postedAt: p.posted_at,
          impressions: Number(p.impressions), engagements: Number(p.engagements), leads: Number(p.leads),
        })),
        totals30d: {
          posts: Number(tot[0]?.posts ?? 0),
          engagements: Number(tot[0]?.engagements ?? 0),
          leads: Number(tot[0]?.leads ?? 0),
        },
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
      return {
        id: r.id, platform: r.platform, title: r.title, url: r.url, postedAt: r.posted_at,
        impressions: Number(r.impressions), engagements: Number(r.engagements), leads: Number(r.leads),
      };
    });
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
