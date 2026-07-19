// =====================================================================
// PREI | Meta (Facebook/Instagram) Ads — Marketing API Insights istemcisi.
// Graph API'den kampanya bazında GÜNLÜK (time_increment=1) harcama/gösterim/
// tıklama çeker; ad_spend'e upsert edilecek satırlara eşler. Saf eşleme
// (mapInsightRow/inferMarket) test edilebilir; fetch* fonksiyonları HTTP.
// Token yalnız sunucu env'inde; asla loglanmaz.
// =====================================================================

export interface MetaInsightRaw {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  date_start?: string;
  date_stop?: string;
}

export interface MetaSpendRow {
  name: string;
  campaignRef: string;
  marketCode: string | null;
  periodStart: string;
  periodEnd: string;
  spend: number;
  impressions: number;
  clicks: number;
}

const MARKET_HINTS: [RegExp, string][] = [
  [/\b(tr|turkey|türkiye|turkiye|istanbul|i̇stanbul|antalya|bodrum|ankara|izmir)\b/i, 'TR'],
  [/\b(ae|uae|bae|dubai|abu ?dhabi|emirates)\b/i, 'AE'],
  [/\b(es|spain|españa|ispanya|i̇spanya|marbella|madrid|barcelona|malaga)\b/i, 'ES'],
  [/\b(gb|uk|united kingdom|england|london|londra|manchester)\b/i, 'GB'],
];

/** Kampanya adından pazar kodu tahmin eder (yoksa null). */
export function inferMarket(name: string | undefined): string | null {
  if (!name) return null;
  for (const [re, code] of MARKET_HINTS) if (re.test(name)) return code;
  return null;
}

/** Ham Insights satırını ad_spend upsert satırına eşler. */
export function mapInsightRow(raw: MetaInsightRaw): MetaSpendRow | null {
  const campaignRef = raw.campaign_id;
  const periodStart = raw.date_start;
  const periodEnd = raw.date_stop ?? raw.date_start;
  if (!campaignRef || !periodStart || !periodEnd) return null;
  return {
    name: raw.campaign_name?.trim() || `Kampanya ${campaignRef}`,
    campaignRef,
    marketCode: inferMarket(raw.campaign_name),
    periodStart,
    periodEnd,
    spend: Number(raw.spend ?? 0) || 0,
    impressions: Math.round(Number(raw.impressions ?? 0) || 0),
    clicks: Math.round(Number(raw.clicks ?? 0) || 0),
  };
}

/** 'act_123' / '123' → 'act_123'. */
export function normalizeAccountId(id: string): string {
  const s = id.trim();
  return s.startsWith('act_') ? s : `act_${s}`;
}

const GRAPH = 'https://graph.facebook.com';

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T & { error?: { message?: string; type?: string; code?: number } };
  if (!res.ok || (json as { error?: unknown }).error) {
    const e = (json as { error?: { message?: string } }).error;
    throw new Error(`Meta Graph API hatası: ${e?.message ?? res.status}`);
  }
  return json;
}

/** Reklam hesabının para birimini döndürür (ör. 'TRY'). */
export async function fetchAccountCurrency(token: string, accountId: string, v: string): Promise<string> {
  const act = normalizeAccountId(accountId);
  const url = `${GRAPH}/${v}/${act}?fields=currency&access_token=${encodeURIComponent(token)}`;
  const j = await graphGet<{ currency?: string }>(url);
  return (j.currency ?? 'EUR').toUpperCase();
}

/** Kampanya bazında GÜNLÜK insights (sayfalama takip edilir). */
export async function fetchInsights(
  token: string, accountId: string, v: string, datePreset = 'last_30d',
): Promise<MetaSpendRow[]> {
  const act = normalizeAccountId(accountId);
  const fields = 'campaign_id,campaign_name,spend,impressions,clicks';
  let url =
    `${GRAPH}/${v}/${act}/insights?level=campaign&time_increment=1` +
    `&fields=${fields}&date_preset=${datePreset}&limit=500&access_token=${encodeURIComponent(token)}`;

  const rows: MetaSpendRow[] = [];
  // Sayfalama: paging.next tam URL döndürür. Sonsuz döngü koruması: 50 sayfa.
  for (let page = 0; page < 50 && url; page++) {
    const j: { data?: MetaInsightRaw[]; paging?: { next?: string } } = await graphGet(url);
    for (const raw of j.data ?? []) {
      const mapped = mapInsightRow(raw);
      if (mapped) rows.push(mapped);
    }
    url = j.paging?.next ?? '';
  }
  return rows;
}
