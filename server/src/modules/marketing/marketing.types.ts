// =====================================================================
// PREI | Marketing — çıktı DTO'ları (frontend sözleşmesi).
// Harcama/gösterim/tıklama ad_spend'den; funnel/CPL/ROAS gerçek CRM'den.
// Türetilemeyen (atıf yoksa) alanlar null döner → UI "—" gösterir.
// =====================================================================

export interface MarketingKpis {
  adSpendEur: number;
  adSpendDeltaPct: number | null;
  avgCplEur: number | null;
  avgCplDeltaPct: number | null;
  convQualifiedPct: number;
  convQualifiedDeltaPct: number | null;
  roas: number | null;
  roasDeltaPct: number | null;
  spendSpark: number[];
  cplSpark: number[];
  qualifiedSpark: number[];
  roasSpark: number[];
}

export interface MarketingFunnel {
  impressions: number;
  ctwaClicks: number;
  conversations: number;
  qualified: number;
  meetings: number;
  closedWon: number;
}

export interface MarketingWeeklyPoint {
  label: string;
  spendEur: number;
  cpl: number | null;
}

export interface MarketingMarketSpend {
  code: string;
  name: string;
  valueEur: number;
}

export interface MarketingCampaignRow {
  id: string;
  name: string;
  market: string | null;
  status: 'active' | 'paused';
  spendEur: number;
  /** Atıf (CTWA) yoksa null → UI "—". */
  leads: number | null;
  qualified: number | null;
  cpl: number | null;
  closed: number | null;
  roas: number | null;
  attributed: boolean;
}

export interface MarketingConversation {
  id: string;
  name: string;
  market: string | null;
  channel: string | null;
  snippet: string | null;
  score: number | null;
  lastActivityAt: string | null;
}

export interface MarketingSummary {
  /** ad_spend'de hiç kayıt yoksa false → UI "harcama gir" boş durumu. */
  hasSpendData: boolean;
  kpis: MarketingKpis;
  funnel: MarketingFunnel;
  weeklySpendCpl: MarketingWeeklyPoint[];
  spendByMarket: MarketingMarketSpend[];
  campaigns: MarketingCampaignRow[];
  conversations: MarketingConversation[];
}

export interface AdCampaign {
  id: string;
  name: string;
  campaignRef: string | null;
  marketCode: string | null;
  channel: string;
  status: 'active' | 'paused';
  periodStart: string;
  periodEnd: string;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
}
