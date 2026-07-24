// =====================================================================
// PREI | SocialService — sosyal medya istatistikleri (002w).
// Takipçi anlık görüntüleri + paylaşım performansı. Veri elle (Pazarlama
// sayfası) veya ileride n8n/API ile girilir — ad_spend ile aynı desen.
// Büyüme: platformun SON kaydı vs ~30 gün önceki en yakın kaydı.
// =====================================================================
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { CreateSocialPostDto, UpsertFollowersDto } from './dto/social.dto';

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
  constructor(private readonly db: DatabaseService) {}

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
