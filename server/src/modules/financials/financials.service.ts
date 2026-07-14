// =====================================================================
// PREI | FinancialsService — Financials modülü gerçek aggregate (Faz 1).
// Kaynak: deals(status='won') = ciro/satış; financials(type='commission',
// status='paid') = tahsil edilen komisyon (002a: "Financials modülü gerçek
// veri kaynağı"). Karışık para birimleri fx_to_eur ile EUR bazına çevrilir.
// Hedefler (targets) DB'de yok — sabit iş hedefleri olarak burada tutulur.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export type Timeframe = 'Q1' | 'Q2' | 'YTD' | '1Y';

const MARKET_NAME: Record<string, string> = {
  TR: 'Türkiye', AE: 'Dubai (UAE)', ES: 'Spain', GB: 'United Kingdom', TH: 'Thailand', DE: 'Germany',
};

const PURPOSE_NAME: Record<string, string> = {
  investment: 'Investment',
  golden_visa: 'Golden Visa',
  holiday_home: 'Holiday Home',
  cbi: 'CBI',
  lifestyle: 'Lifestyle',
};

const SALE_TYPE_NAME: Record<string, string> = {
  off_plan: 'Off-plan',
  resale: 'Resale',
};

// Faz 1: hedefler henüz admin tarafından düzenlenemiyor — temsili iş hedefi.
const TARGETS = {
  monthlyLeads: 25,
  monthlySales: 3,
  monthlyRevenueEur: 2_000_000,
  yearlyRevenueEur: 20_000_000,
};

export interface FinancialsSummary {
  kpis: {
    totalRevenueEur: number; totalRevenueDeltaPct: number | null;
    totalSales: number; totalSalesDeltaPct: number | null;
    conversionRatePct: number; conversionRateDeltaPct: number | null;
    avgDealSizeEur: number; avgDealSizeDeltaPct: number | null;
    commissionEarnedEur: number; commissionEarnedDeltaPct: number | null;
  };
  targets: {
    monthlyLeads: { actual: number; target: number };
    monthlySales: { actual: number; target: number };
    monthlyRevenueEur: { actual: number; target: number };
    yearlyRevenueEur: { actual: number; target: number };
  };
  monthlyRevenue: { month: string; valueEur: number }[];
  salesByMarket: { code: string; name: string; valueEur: number }[];
  salesByProject: { name: string; valueEur: number }[];
  saleTypeSplit: { code: string; name: string; valueEur: number }[];
  purposeSplit: { code: string; name: string; valueEur: number }[];
}

function timeframeRange(tf: Timeframe, now: Date): { from: string; to: string; prevFrom: string; prevTo: string } {
  const y = now.getUTCFullYear();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const range = (from: Date, to: Date) => ({ from: iso(from), to: iso(to) });

  let cur: { from: Date; to: Date };
  let prev: { from: Date; to: Date };
  switch (tf) {
    case 'Q1':
      cur = { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y, 3, 0)) };
      prev = { from: new Date(Date.UTC(y - 1, 0, 1)), to: new Date(Date.UTC(y - 1, 3, 0)) };
      break;
    case 'Q2':
      cur = { from: new Date(Date.UTC(y, 3, 1)), to: new Date(Date.UTC(y, 6, 0)) };
      prev = { from: new Date(Date.UTC(y - 1, 3, 1)), to: new Date(Date.UTC(y - 1, 6, 0)) };
      break;
    case '1Y':
      cur = { from: new Date(Date.UTC(y - 1, now.getUTCMonth(), now.getUTCDate() + 1)), to: now };
      prev = { from: new Date(Date.UTC(y - 2, now.getUTCMonth(), now.getUTCDate() + 1)), to: new Date(Date.UTC(y - 1, now.getUTCMonth(), now.getUTCDate())) };
      break;
    case 'YTD':
    default:
      cur = { from: new Date(Date.UTC(y, 0, 1)), to: now };
      prev = { from: new Date(Date.UTC(y - 1, 0, 1)), to: new Date(Date.UTC(y - 1, now.getUTCMonth(), now.getUTCDate())) };
      break;
  }
  return { ...range(cur.from, cur.to), prevFrom: range(prev.from, prev.to).from, prevTo: range(prev.from, prev.to).to };
}

const deltaPct = (actual: number, prev: number): number | null =>
  prev > 0 ? ((actual - prev) / prev) * 100 : null;

@Injectable()
export class FinancialsService {
  constructor(private readonly db: DatabaseService) {}

  async summary(ctx: RequestContext, timeframe: Timeframe = 'YTD'): Promise<FinancialsSummary> {
    const now = new Date();
    const { from, to, prevFrom, prevTo } = timeframeRange(timeframe, now);

    return this.db.withContext(ctx, async (c) => {
      const periodTotals = async (fromD: string, toD: string) => {
        const { rows } = await c.query<{
          revenue_eur: string; sales: string; leads_created: string; commission_eur: string;
        }>(
          `SELECT
             (SELECT COALESCE(SUM(fx.amount_eur),0) FROM deals d
                LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
               WHERE d.deleted_at IS NULL AND d.status = 'won'
                 AND d.closed_at::date BETWEEN $1 AND $2) AS revenue_eur,
             (SELECT count(*) FROM deals d
               WHERE d.deleted_at IS NULL AND d.status = 'won'
                 AND d.closed_at::date BETWEEN $1 AND $2) AS sales,
             (SELECT count(*) FROM leads l
               WHERE l.deleted_at IS NULL AND l.created_at::date BETWEEN $1 AND $2) AS leads_created,
             (SELECT COALESCE(SUM(fx.amount_eur),0) FROM financials f
                LEFT JOIN LATERAL fx_to_eur(f.amount, f.currency) fx ON true
               WHERE f.deleted_at IS NULL AND f.type = 'commission' AND f.status = 'paid'
                 AND f.paid_at::date BETWEEN $1 AND $2) AS commission_eur`,
          [fromD, toD],
        );
        const r = rows[0];
        const revenue = Number(r.revenue_eur);
        const sales = Number(r.sales);
        const leadsCreated = Number(r.leads_created);
        return {
          revenue, sales, commission: Number(r.commission_eur), leadsCreated,
          conversionRate: leadsCreated > 0 ? (sales / leadsCreated) * 100 : 0,
          avgDealSize: sales > 0 ? revenue / sales : 0,
        };
      };

      const [cur, prev] = await Promise.all([periodTotals(from, to), periodTotals(prevFrom, prevTo)]);

      const { rows: monthly } = await c.query<{ month: string; value_eur: string }>(
        `SELECT to_char(date_trunc('month', d.closed_at), 'YYYY-MM') AS month,
                COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM deals d
           LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
          WHERE d.deleted_at IS NULL AND d.status = 'won'
            AND d.closed_at >= date_trunc('month', now()) - interval '5 months'
          GROUP BY 1 ORDER BY 1`,
      );

      const { rows: byMarket } = await c.query<{ code: string; value_eur: string }>(
        `SELECT COALESCE(l.target_market_code, p.market_code) AS code,
                COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM deals d
           JOIN leads l ON l.id = d.lead_id
           LEFT JOIN properties p ON p.id = d.property_id
           LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
          WHERE d.deleted_at IS NULL AND d.status = 'won'
            AND d.closed_at::date BETWEEN $1 AND $2
            AND COALESCE(l.target_market_code, p.market_code) IS NOT NULL
          GROUP BY 1 ORDER BY value_eur DESC`,
        [from, to],
      );

      const { rows: byProject } = await c.query<{ name: string; value_eur: string }>(
        `SELECT p.title AS name, COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM deals d
           JOIN properties p ON p.id = d.property_id
           LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
          WHERE d.deleted_at IS NULL AND d.status = 'won'
            AND d.closed_at::date BETWEEN $1 AND $2
          GROUP BY p.title ORDER BY value_eur DESC LIMIT 6`,
        [from, to],
      );

      const { rows: bySaleType } = await c.query<{ code: string; value_eur: string }>(
        `SELECT COALESCE(d.metadata->>'saleType', 'other') AS code,
                COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM deals d
           LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
          WHERE d.deleted_at IS NULL AND d.status = 'won'
            AND d.closed_at::date BETWEEN $1 AND $2
          GROUP BY 1 ORDER BY value_eur DESC`,
        [from, to],
      );

      const { rows: byPurpose } = await c.query<{ code: string; value_eur: string }>(
        `SELECT l.investment_purpose AS code, COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM deals d
           JOIN leads l ON l.id = d.lead_id
           LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
          WHERE d.deleted_at IS NULL AND d.status = 'won'
            AND d.closed_at::date BETWEEN $1 AND $2
            AND l.investment_purpose IS NOT NULL
          GROUP BY l.investment_purpose ORDER BY value_eur DESC`,
        [from, to],
      );

      // Cari ay / cari yıl — hedef kartları her zaman bu iki sabit pencereyi gösterir (timeframe filtresinden bağımsız).
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const [monthTotals, yearTotals] = await Promise.all([
        periodTotals(monthStart, today),
        periodTotals(yearStart, today),
      ]);

      return {
        kpis: {
          totalRevenueEur: cur.revenue, totalRevenueDeltaPct: deltaPct(cur.revenue, prev.revenue),
          totalSales: cur.sales, totalSalesDeltaPct: deltaPct(cur.sales, prev.sales),
          conversionRatePct: cur.conversionRate, conversionRateDeltaPct: deltaPct(cur.conversionRate, prev.conversionRate),
          avgDealSizeEur: cur.avgDealSize, avgDealSizeDeltaPct: deltaPct(cur.avgDealSize, prev.avgDealSize),
          commissionEarnedEur: cur.commission, commissionEarnedDeltaPct: deltaPct(cur.commission, prev.commission),
        },
        targets: {
          monthlyLeads: { actual: monthTotals.leadsCreated, target: TARGETS.monthlyLeads },
          monthlySales: { actual: monthTotals.sales, target: TARGETS.monthlySales },
          monthlyRevenueEur: { actual: monthTotals.revenue, target: TARGETS.monthlyRevenueEur },
          yearlyRevenueEur: { actual: yearTotals.revenue, target: TARGETS.yearlyRevenueEur },
        },
        monthlyRevenue: monthly.map((m) => ({ month: m.month, valueEur: Number(m.value_eur) })),
        salesByMarket: byMarket.map((m) => ({ code: m.code, name: MARKET_NAME[m.code] ?? m.code, valueEur: Number(m.value_eur) })),
        salesByProject: byProject.map((p) => ({ name: p.name, valueEur: Number(p.value_eur) })),
        saleTypeSplit: bySaleType.map((s) => ({ code: s.code, name: SALE_TYPE_NAME[s.code] ?? s.code, valueEur: Number(s.value_eur) })),
        purposeSplit: byPurpose.map((p) => ({ code: p.code, name: PURPOSE_NAME[p.code] ?? p.code, valueEur: Number(p.value_eur) })),
      };
    });
  }
}
