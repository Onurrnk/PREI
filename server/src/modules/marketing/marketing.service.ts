// =====================================================================
// PREI | MarketingService — Marketing modülü gerçek aggregate.
// Meta Ads API (ads_read) App Review beklerken harcama ad_spend'e elle/CSV
// girilir; funnel/CPL/ROAS/pazar dağılımı GERÇEK CRM verisinden hesaplanır.
// Meta bağlanınca aynı ad_spend tablosu otomatik beslenir (şema değişmez).
// =====================================================================
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '../../common/request-context';
import { MarketingRepository } from './marketing.repository';
import type { CreateAdSpendDto, UpdateAdSpendDto } from './dto/ad-spend.dto';
import type { AdCampaign, MarketingSummary, MarketingWeeklyPoint } from './marketing.types';
import {
  MARKET_NAME, lastNWeeks, mondayOf, pctDelta, safeCpl, safeRoas, timeframeRange,
  type MarketingTimeframe,
} from './marketing.util';

const WEEKS = 12;

@Injectable()
export class MarketingService {
  constructor(private readonly repo: MarketingRepository) {}

  async summary(ctx: RequestContext, timeframe: MarketingTimeframe): Promise<MarketingSummary> {
    const now = new Date();
    const { from, to, prevFrom, prevTo } = timeframeRange(timeframe, now);
    const weeksAxis = lastNWeeks(now, WEEKS);
    const sinceMonday = mondayOf(new Date(now.getTime() - (WEEKS - 1) * 7 * 86_400_000)).toISOString().slice(0, 10);

    const [hasSpendData, cur, prev, weeklyRows, byMarket, campaignRows, conversations] = await Promise.all([
      this.repo.hasSpend(ctx),
      this.repo.periodTotals(ctx, from, to),
      this.repo.periodTotals(ctx, prevFrom, prevTo),
      this.repo.weekly(ctx, sinceMonday),
      this.repo.spendByMarket(ctx, from, to),
      this.repo.campaigns(ctx, from, to),
      this.repo.recentConversations(ctx, 8),
    ]);

    // Haftalık ekseni doldur (veri olmayan hafta = 0/null).
    const weekMap = new Map(weeklyRows.map((w) => [w.wk, w]));
    const weeklySpendCpl: MarketingWeeklyPoint[] = [];
    const spendSpark: number[] = [];
    const cplSpark: number[] = [];
    const qualifiedSpark: number[] = [];
    const roasSpark: number[] = [];
    for (const wk of weeksAxis) {
      const w = weekMap.get(wk.key);
      const spendEur = w?.spendEur ?? 0;
      const leads = w?.leads ?? 0;
      const qualified = w?.qualified ?? 0;
      const commissionEur = w?.commissionEur ?? 0;
      const cpl = safeCpl(spendEur, leads);
      weeklySpendCpl.push({ label: wk.label, spendEur, cpl });
      spendSpark.push(Math.round(spendEur));
      cplSpark.push(cpl == null ? 0 : Math.round(cpl * 10) / 10);
      qualifiedSpark.push(leads > 0 ? Math.round((qualified / leads) * 1000) / 10 : 0);
      roasSpark.push(safeRoas(commissionEur, spendEur) ?? 0);
    }

    const curCpl = safeCpl(cur.spendEur, cur.leads);
    const prevCpl = safeCpl(prev.spendEur, prev.leads);
    const curConv = cur.leads > 0 ? (cur.qualified / cur.leads) * 100 : 0;
    const prevConv = prev.leads > 0 ? (prev.qualified / prev.leads) * 100 : 0;
    const curRoas = safeRoas(cur.commissionEur, cur.spendEur);
    const prevRoas = safeRoas(prev.commissionEur, prev.spendEur);

    return {
      hasSpendData,
      kpis: {
        adSpendEur: cur.spendEur,
        adSpendDeltaPct: pctDelta(cur.spendEur, prev.spendEur),
        avgCplEur: curCpl,
        avgCplDeltaPct: curCpl != null && prevCpl != null ? pctDelta(curCpl, prevCpl) : null,
        convQualifiedPct: curConv,
        convQualifiedDeltaPct: pctDelta(curConv, prevConv),
        roas: curRoas,
        roasDeltaPct: curRoas != null && prevRoas != null ? pctDelta(curRoas, prevRoas) : null,
        spendSpark, cplSpark, qualifiedSpark, roasSpark,
      },
      funnel: {
        impressions: cur.impressions,
        ctwaClicks: cur.clicks,
        conversations: cur.leads,
        qualified: cur.qualified,
        meetings: cur.meetings,
        closedWon: cur.closed,
      },
      weeklySpendCpl,
      spendByMarket: byMarket.map((m) => ({
        code: m.code,
        name: MARKET_NAME[m.code] ?? m.code,
        valueEur: m.valueEur,
      })),
      campaigns: campaignRows.map((c) => {
        const attributed = c.hasRef && c.leads > 0;
        return {
          id: c.id,
          name: c.name,
          market: c.market,
          status: c.status,
          spendEur: c.spendEur,
          leads: attributed ? c.leads : null,
          qualified: attributed ? c.qualified : null,
          cpl: attributed ? safeCpl(c.spendEur, c.leads) : null,
          closed: attributed ? c.closed : null,
          roas: attributed ? safeRoas(c.commissionEur, c.spendEur) : null,
          attributed,
        };
      }),
      conversations,
    };
  }

  listCampaigns(ctx: RequestContext): Promise<AdCampaign[]> {
    return this.repo.list(ctx);
  }

  createCampaign(ctx: RequestContext, input: CreateAdSpendDto): Promise<AdCampaign> {
    return this.repo.insert(ctx, input);
  }

  async importCampaigns(ctx: RequestContext, rows: CreateAdSpendDto[]): Promise<{ imported: number }> {
    const imported = await this.repo.insertMany(ctx, rows);
    return { imported };
  }

  updateCampaign(ctx: RequestContext, id: string, patch: UpdateAdSpendDto): Promise<AdCampaign | null> {
    return this.repo.update(ctx, id, patch);
  }

  removeCampaign(ctx: RequestContext, id: string): Promise<boolean> {
    return this.repo.remove(ctx, id);
  }
}
