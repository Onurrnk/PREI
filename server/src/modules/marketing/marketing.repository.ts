// =====================================================================
// PREI | MarketingRepository — ad_spend (harcama) + gerçek CRM aggregate.
// RLS: ad_spend yalnız app_is_privileged'e görünür/yazılır (002m).
// Harcama/gösterim/tıklama ad_spend'den; funnel/CPL/ROAS leads / lead_scores
// (leads.score önbelleği) / tasks(meeting) / deals / lead_attributions'dan.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { CreateAdSpendDto, UpdateAdSpendDto } from './dto/ad-spend.dto';
import type { AdCampaign } from './marketing.types';
import type { MetaSpendRow } from './meta-ads';

const QUALIFIED_SCORE = 50; // "nitelikli" eşiği (skor önbelleği)

export interface PeriodTotals {
  spendEur: number; impressions: number; clicks: number;
  leads: number; qualified: number; meetings: number; closed: number; commissionEur: number;
}

export interface WeeklyRow {
  wk: string; spendEur: number; leads: number; qualified: number;
  closed: number; commissionEur: number;
}

const CAMPAIGN_COLS = `id, name, campaign_ref, market_code, channel, status,
  to_char(period_start,'YYYY-MM-DD') AS period_start,
  to_char(period_end,'YYYY-MM-DD') AS period_end,
  spend, currency, impressions, clicks`;

function mapCampaign(r: Record<string, unknown>): AdCampaign {
  return {
    id: r.id as string,
    name: r.name as string,
    campaignRef: (r.campaign_ref as string) ?? null,
    marketCode: (r.market_code as string) ?? null,
    channel: r.channel as string,
    status: r.status as 'active' | 'paused',
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    spend: Number(r.spend),
    currency: r.currency as string,
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
  };
}

@Injectable()
export class MarketingRepository {
  constructor(private readonly db: DatabaseService) {}

  async hasSpend(ctx: RequestContext): Promise<boolean> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM ad_spend WHERE deleted_at IS NULL) AS exists`,
      );
      return rows[0]?.exists ?? false;
    });
  }

  /** Bir zaman penceresi için toplamlar (harcama + CRM). period_start pencerede. */
  async periodTotals(ctx: RequestContext, from: string, to: string): Promise<PeriodTotals> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Record<string, string>>(
        `SELECT
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM ad_spend a
              LEFT JOIN LATERAL fx_to_eur(a.spend, a.currency) fx ON true
             WHERE a.deleted_at IS NULL AND a.period_start BETWEEN $1 AND $2) AS spend_eur,
           (SELECT COALESCE(SUM(a.impressions),0) FROM ad_spend a
             WHERE a.deleted_at IS NULL AND a.period_start BETWEEN $1 AND $2) AS impressions,
           (SELECT COALESCE(SUM(a.clicks),0) FROM ad_spend a
             WHERE a.deleted_at IS NULL AND a.period_start BETWEEN $1 AND $2) AS clicks,
           (SELECT count(*) FROM leads l
             WHERE l.deleted_at IS NULL AND l.created_at::date BETWEEN $1 AND $2) AS leads,
           (SELECT count(*) FROM leads l
             WHERE l.deleted_at IS NULL AND l.score >= ${QUALIFIED_SCORE}
               AND l.created_at::date BETWEEN $1 AND $2) AS qualified,
           (SELECT count(*) FROM tasks t
             WHERE t.deleted_at IS NULL AND t.task_type = 'meeting'
               AND t.created_at::date BETWEEN $1 AND $2) AS meetings,
           (SELECT count(*) FROM deals d
             WHERE d.deleted_at IS NULL AND d.status = 'won'
               AND d.closed_at::date BETWEEN $1 AND $2) AS closed,
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM deals d
              LEFT JOIN LATERAL fx_to_eur(d.commission_amount, d.currency) fx ON true
             WHERE d.deleted_at IS NULL AND d.status = 'won'
               AND d.closed_at::date BETWEEN $1 AND $2) AS commission_eur`,
        [from, to],
      );
      const r = rows[0];
      return {
        spendEur: Number(r.spend_eur), impressions: Number(r.impressions), clicks: Number(r.clicks),
        leads: Number(r.leads), qualified: Number(r.qualified), meetings: Number(r.meetings),
        closed: Number(r.closed), commissionEur: Number(r.commission_eur),
      };
    });
  }

  /** ISO haftası bazında harcama + CRM (son N hafta; sinceMonday'den itibaren). */
  async weekly(ctx: RequestContext, sinceMonday: string): Promise<WeeklyRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const [spend, crm, deals] = await Promise.all([
        c.query<{ wk: string; spend_eur: string }>(
          `SELECT to_char(date_trunc('week', a.period_start),'YYYY-MM-DD') AS wk,
                  COALESCE(SUM(fx.amount_eur),0) AS spend_eur
             FROM ad_spend a
             LEFT JOIN LATERAL fx_to_eur(a.spend, a.currency) fx ON true
            WHERE a.deleted_at IS NULL AND a.period_start >= $1
            GROUP BY 1`,
          [sinceMonday],
        ),
        c.query<{ wk: string; leads: string; qualified: string }>(
          `SELECT to_char(date_trunc('week', l.created_at),'YYYY-MM-DD') AS wk,
                  count(*) AS leads,
                  count(*) FILTER (WHERE l.score >= ${QUALIFIED_SCORE}) AS qualified
             FROM leads l
            WHERE l.deleted_at IS NULL AND l.created_at >= $1
            GROUP BY 1`,
          [sinceMonday],
        ),
        c.query<{ wk: string; closed: string; commission_eur: string }>(
          `SELECT to_char(date_trunc('week', d.closed_at),'YYYY-MM-DD') AS wk,
                  count(*) AS closed,
                  COALESCE(SUM(fx.amount_eur),0) AS commission_eur
             FROM deals d
             LEFT JOIN LATERAL fx_to_eur(d.commission_amount, d.currency) fx ON true
            WHERE d.deleted_at IS NULL AND d.status = 'won' AND d.closed_at >= $1
            GROUP BY 1`,
          [sinceMonday],
        ),
      ]);

      const byWeek = new Map<string, WeeklyRow>();
      const ensure = (wk: string): WeeklyRow => {
        let row = byWeek.get(wk);
        if (!row) { row = { wk, spendEur: 0, leads: 0, qualified: 0, closed: 0, commissionEur: 0 }; byWeek.set(wk, row); }
        return row;
      };
      spend.rows.forEach((r) => { ensure(r.wk).spendEur = Number(r.spend_eur); });
      crm.rows.forEach((r) => { const w = ensure(r.wk); w.leads = Number(r.leads); w.qualified = Number(r.qualified); });
      deals.rows.forEach((r) => { const w = ensure(r.wk); w.closed = Number(r.closed); w.commissionEur = Number(r.commission_eur); });
      return [...byWeek.values()];
    });
  }

  async spendByMarket(ctx: RequestContext, from: string, to: string): Promise<{ code: string; valueEur: number }[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ code: string; value_eur: string }>(
        `SELECT COALESCE(a.market_code,'??') AS code, COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM ad_spend a
           LEFT JOIN LATERAL fx_to_eur(a.spend, a.currency) fx ON true
          WHERE a.deleted_at IS NULL AND a.period_start BETWEEN $1 AND $2
          GROUP BY 1 ORDER BY value_eur DESC`,
        [from, to],
      );
      return rows.map((r) => ({ code: r.code, valueEur: Number(r.value_eur) }));
    });
  }

  /** Kampanya satırları — harcama ad_spend'den; lead/qualified/closed/komisyon
   *  campaign_ref = lead_attributions.campaign_id atıfından (yoksa 0/atıfsız). */
  async campaigns(ctx: RequestContext, from: string, to: string): Promise<{
    id: string; name: string; market: string | null; status: 'active' | 'paused';
    spendEur: number; leads: number; qualified: number; closed: number; commissionEur: number; hasRef: boolean;
  }[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Record<string, unknown>>(
        `SELECT a.id, a.name, a.market_code AS market, a.status, a.campaign_ref,
                COALESCE(fx.amount_eur,0) AS spend_eur,
                (SELECT count(DISTINCT la.lead_id) FROM lead_attributions la
                   WHERE la.tenant_id = a.tenant_id AND la.campaign_id = a.campaign_ref) AS leads,
                (SELECT count(*) FROM leads l
                   WHERE l.deleted_at IS NULL AND l.score >= ${QUALIFIED_SCORE}
                     AND l.id IN (SELECT lead_id FROM lead_attributions
                                   WHERE tenant_id = a.tenant_id AND campaign_id = a.campaign_ref)) AS qualified,
                (SELECT count(*) FROM deals d
                   WHERE d.deleted_at IS NULL AND d.status = 'won'
                     AND d.lead_id IN (SELECT lead_id FROM lead_attributions
                                        WHERE tenant_id = a.tenant_id AND campaign_id = a.campaign_ref)) AS closed,
                (SELECT COALESCE(SUM(fx2.amount_eur),0) FROM deals d
                   LEFT JOIN LATERAL fx_to_eur(d.commission_amount, d.currency) fx2 ON true
                   WHERE d.deleted_at IS NULL AND d.status = 'won'
                     AND d.lead_id IN (SELECT lead_id FROM lead_attributions
                                        WHERE tenant_id = a.tenant_id AND campaign_id = a.campaign_ref)) AS commission_eur
           FROM ad_spend a
           LEFT JOIN LATERAL fx_to_eur(a.spend, a.currency) fx ON true
          WHERE a.deleted_at IS NULL AND a.period_start BETWEEN $1 AND $2
          ORDER BY spend_eur DESC`,
        [from, to],
      );
      return rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        market: (r.market as string) ?? null,
        status: r.status as 'active' | 'paused',
        spendEur: Number(r.spend_eur),
        leads: Number(r.leads),
        qualified: Number(r.qualified),
        closed: Number(r.closed),
        commissionEur: Number(r.commission_eur),
        hasRef: !!r.campaign_ref,
      }));
    });
  }

  /** Eylül'ün son konuşmaları — gerçek leads + son mesaj snippet'i. */
  async recentConversations(ctx: RequestContext, limit = 8): Promise<{
    id: string; name: string; market: string | null; channel: string | null;
    snippet: string | null; score: number | null; lastActivityAt: string | null;
  }[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Record<string, unknown>>(
        `SELECT l.id,
                trim(co.first_name || ' ' || COALESCE(co.last_name,'')) AS name,
                l.target_market_code AS market,
                l.score,
                l.last_activity_at,
                cm.channel::text AS channel,
                cm.body AS snippet
           FROM leads l
           JOIN contacts co ON co.id = l.contact_id
           LEFT JOIN LATERAL (
             SELECT channel, body FROM communications
              WHERE lead_id = l.id AND body IS NOT NULL
              ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1
           ) cm ON true
          WHERE l.deleted_at IS NULL
          ORDER BY l.last_activity_at DESC NULLS LAST, l.created_at DESC
          LIMIT $1`,
        [limit],
      );
      return rows.map((r) => ({
        id: r.id as string,
        name: (r.name as string)?.trim() || '—',
        market: (r.market as string) ?? null,
        channel: (r.channel as string) ?? null,
        snippet: (r.snippet as string) ?? null,
        score: r.score == null ? null : Number(r.score),
        lastActivityAt: r.last_activity_at ? new Date(r.last_activity_at as string).toISOString() : null,
      }));
    });
  }

  // --- CRUD ------------------------------------------------------------

  async list(ctx: RequestContext): Promise<AdCampaign[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Record<string, unknown>>(
        `SELECT ${CAMPAIGN_COLS} FROM ad_spend WHERE deleted_at IS NULL ORDER BY period_start DESC, created_at DESC`,
      );
      return rows.map(mapCampaign);
    });
  }

  async insert(ctx: RequestContext, input: CreateAdSpendDto): Promise<AdCampaign> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Record<string, unknown>>(
        `INSERT INTO ad_spend
           (tenant_id, name, campaign_ref, market_code, channel, status,
            period_start, period_end, spend, currency, impressions, clicks, created_by, updated_by)
         VALUES ($1,$2,$3,$4,COALESCE($5,'meta'),COALESCE($6,'active'),
                 $7,$8,$9,COALESCE($10,'EUR'),COALESCE($11,0),COALESCE($12,0),$13,$13)
         RETURNING ${CAMPAIGN_COLS}`,
        [ctx.tenantId, input.name, input.campaignRef ?? null, input.marketCode ?? null,
          input.channel ?? null, input.status ?? null, input.periodStart, input.periodEnd,
          input.spend, input.currency ?? null, input.impressions ?? null, input.clicks ?? null, ctx.userId],
      );
      const row = mapCampaign(rows[0]);
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'ad_spend.created','ad_spend',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, row.id, JSON.stringify({ name: input.name, spend: input.spend, currency: input.currency ?? 'EUR' }), ctx.correlationId],
      );
      return row;
    });
  }

  async insertMany(ctx: RequestContext, rows: CreateAdSpendDto[]): Promise<number> {
    let count = 0;
    for (const r of rows) { await this.insert(ctx, r); count++; }
    return count;
  }

  async update(ctx: RequestContext, id: string, patch: UpdateAdSpendDto): Promise<AdCampaign | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Record<string, unknown>>(
        `UPDATE ad_spend SET
           name         = COALESCE($2, name),
           campaign_ref = COALESCE($3, campaign_ref),
           market_code  = COALESCE($4, market_code),
           channel      = COALESCE($5, channel),
           status       = COALESCE($6, status),
           period_start = COALESCE($7, period_start),
           period_end   = COALESCE($8, period_end),
           spend        = COALESCE($9, spend),
           currency     = COALESCE($10, currency),
           impressions  = COALESCE($11, impressions),
           clicks       = COALESCE($12, clicks),
           updated_by   = $13
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING ${CAMPAIGN_COLS}`,
        [id, patch.name ?? null, patch.campaignRef ?? null, patch.marketCode ?? null,
          patch.channel ?? null, patch.status ?? null, patch.periodStart ?? null, patch.periodEnd ?? null,
          patch.spend ?? null, patch.currency ?? null, patch.impressions ?? null, patch.clicks ?? null, ctx.userId],
      );
      return rows[0] ? mapCampaign(rows[0]) : null;
    });
  }

  /** Meta Insights günlük satırlarını idempotent upsert eder (kaynak='meta').
   *  Çakışma anahtarı: (tenant_id, campaign_ref, period_start) — 002n indeksi. */
  async upsertMetaDaily(ctx: RequestContext, rows: MetaSpendRow[], currency: string): Promise<number> {
    if (rows.length === 0) return 0;
    return this.db.withContext(ctx, async (c) => {
      let n = 0;
      for (const r of rows) {
        await c.query(
          `INSERT INTO ad_spend
             (tenant_id, name, campaign_ref, market_code, channel, status,
              period_start, period_end, spend, currency, impressions, clicks,
              metadata, created_by, updated_by)
           VALUES ($1,$2,$3,$4,'meta','active',$5,$6,$7,$8,$9,$10,
                   '{"source":"meta"}'::jsonb,$11,$11)
           ON CONFLICT (tenant_id, campaign_ref, period_start)
             WHERE deleted_at IS NULL AND campaign_ref IS NOT NULL
               AND (metadata->>'source') = 'meta'
           DO UPDATE SET
             name        = EXCLUDED.name,
             market_code = COALESCE(EXCLUDED.market_code, ad_spend.market_code),
             spend       = EXCLUDED.spend,
             currency    = EXCLUDED.currency,
             impressions = EXCLUDED.impressions,
             clicks      = EXCLUDED.clicks,
             period_end  = EXCLUDED.period_end,
             updated_by  = EXCLUDED.updated_by`,
          [ctx.tenantId, r.name, r.campaignRef, r.marketCode, r.periodStart, r.periodEnd,
            r.spend, currency, r.impressions, r.clicks, ctx.userId],
        );
        n++;
      }
      return n;
    });
  }

  async remove(ctx: RequestContext, id: string): Promise<boolean> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `UPDATE ad_spend SET deleted_at = now(), updated_by = $2
          WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [id, ctx.userId],
      );
      if (rows[0]) {
        await c.query(
          `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
           VALUES ($1,$2,'ad_spend.deleted','ad_spend',$3,'{}',$4)`,
          [ctx.tenantId, ctx.userId, id, ctx.correlationId],
        );
      }
      return !!rows[0];
    });
  }
}
