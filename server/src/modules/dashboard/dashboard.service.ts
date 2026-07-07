// =====================================================================
// PREI | DashboardService — Command Center özeti (gerçek aggregate).
// Karışık para birimleri fx_to_eur ile EUR bazına çevrilir (K-6/B-7).
// Zaman-serisi/trend geçmiş veri ister → bu uçta yok (frontend temsili tutar).
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

const ACTIVE_STATUSES = "('new','contacted','qualified','nurturing')";

const MARKET_NAME: Record<string, string> = {
  TR: 'Türkiye', AE: 'Dubai (UAE)', ES: 'Spain', GB: 'United Kingdom', TH: 'Thailand', DE: 'Germany',
};

export interface MarketSplitItem { code: string; name: string; valueEur: number }

export interface DashboardSummary {
  activeLeads: number;
  pipelineValueEur: number;
  closedWonEur: number;
  proposalsActive: number;
  meetingsThisWeek: number;
  marketSplit: MarketSplitItem[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async summary(ctx: RequestContext): Promise<DashboardSummary> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: kpi } = await c.query<{
        active_leads: string; pipeline_eur: string; closed_won_eur: string;
        proposals_active: string; meetings_week: string;
      }>(
        `SELECT
           (SELECT count(*) FROM leads
              WHERE deleted_at IS NULL AND status IN ${ACTIVE_STATUSES}) AS active_leads,
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM leads l
              LEFT JOIN LATERAL fx_to_eur(l.budget_max, l.currency) fx ON true
              WHERE l.deleted_at IS NULL AND l.status IN ${ACTIVE_STATUSES}) AS pipeline_eur,
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM leads l
              LEFT JOIN LATERAL fx_to_eur(l.budget_max, l.currency) fx ON true
              WHERE l.deleted_at IS NULL AND l.status = 'converted') AS closed_won_eur,
           (SELECT count(*) FROM proposals
              WHERE deleted_at IS NULL AND status IN ('sent','viewed','accepted')) AS proposals_active,
           (SELECT count(*) FROM tasks
              WHERE deleted_at IS NULL AND task_type = 'meeting'
                AND due_date >= date_trunc('week', now())
                AND due_date <  date_trunc('week', now()) + interval '7 days') AS meetings_week`,
      );

      const { rows: markets } = await c.query<{ code: string; value_eur: string }>(
        `SELECT l.target_market_code AS code, COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM leads l
           LEFT JOIN LATERAL fx_to_eur(l.budget_max, l.currency) fx ON true
          WHERE l.deleted_at IS NULL AND l.status IN ${ACTIVE_STATUSES}
            AND l.target_market_code IS NOT NULL
          GROUP BY l.target_market_code
          ORDER BY value_eur DESC`,
      );

      const k = kpi[0];
      return {
        activeLeads: Number(k.active_leads),
        pipelineValueEur: Number(k.pipeline_eur),
        closedWonEur: Number(k.closed_won_eur),
        proposalsActive: Number(k.proposals_active),
        meetingsThisWeek: Number(k.meetings_week),
        marketSplit: markets.map((m) => ({
          code: m.code,
          name: MARKET_NAME[m.code] ?? m.code,
          valueEur: Number(m.value_eur),
        })),
      };
    });
  }
}
