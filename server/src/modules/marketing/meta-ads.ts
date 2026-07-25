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

// =====================================================================
// SOSYAL SENKRON (002w): Facebook sayfası + Instagram business hesabından
// takipçi sayısı ve son paylaşımlar. Sistem-kullanıcısı token'ı için sayfa
// keşfi iki yoldan denenir (me/accounts, me/businesses→owned_pages) — sayfa
// Business Manager'da sisteme ATANMAMIŞSA ikisi de boş döner ve senkron
// dürüstçe 'skipped' olur (hata değil).
// =====================================================================

export interface MetaSocialPage {
  pageId: string;
  pageName: string;
  fbFollowers: number | null;      // followers_count ?? fan_count
  igUsername: string | null;
  igId: string | null;
  igFollowers: number | null;
}

export interface MetaIgPost {
  postRef: string;                  // IG media id
  caption: string;
  permalink: string | null;
  timestamp: string;                // ISO
  likeCount: number;
  commentsCount: number;
}

interface PageRaw {
  id: string; name?: string; followers_count?: number; fan_count?: number;
  instagram_business_account?: { id?: string; username?: string; followers_count?: number };
}

const PAGE_FIELDS =
  'id,name,followers_count,fan_count,instagram_business_account{id,username,followers_count}';

/** Erişilebilir sayfaları keşfeder; atama yoksa boş liste (hata fırlatmaz). */
export async function fetchSocialPages(token: string, v: string): Promise<MetaSocialPage[]> {
  const found = new Map<string, PageRaw>();

  const tryList = async (url: string) => {
    try {
      const j = await graphGet<{ data?: PageRaw[] }>(url);
      for (const p of j.data ?? []) if (p?.id) found.set(p.id, p);
    } catch { /* yol kapalıysa sessizce diğerini dene */ }
  };

  await tryList(`${GRAPH}/${v}/me/accounts?fields=${PAGE_FIELDS}&access_token=${encodeURIComponent(token)}`);

  if (found.size === 0) {
    try {
      const b = await graphGet<{ data?: { id: string }[] }>(
        `${GRAPH}/${v}/me/businesses?access_token=${encodeURIComponent(token)}`);
      for (const biz of b.data ?? []) {
        await tryList(`${GRAPH}/${v}/${biz.id}/owned_pages?fields=${PAGE_FIELDS}&access_token=${encodeURIComponent(token)}`);
        await tryList(`${GRAPH}/${v}/${biz.id}/client_pages?fields=${PAGE_FIELDS}&access_token=${encodeURIComponent(token)}`);
      }
    } catch { /* business erişimi yoksa boş kalır */ }
  }

  return [...found.values()].map((p) => ({
    pageId: p.id,
    pageName: p.name ?? '',
    fbFollowers: p.followers_count ?? p.fan_count ?? null,
    igUsername: p.instagram_business_account?.username ?? null,
    igId: p.instagram_business_account?.id ?? null,
    igFollowers: p.instagram_business_account?.followers_count ?? null,
  }));
}

/** IG business hesabının son paylaşımları (beğeni+yorum sayılarıyla). */
export async function fetchIgPosts(token: string, v: string, igId: string, limit = 15): Promise<MetaIgPost[]> {
  const j = await graphGet<{ data?: Array<{
    id: string; caption?: string; permalink?: string; timestamp?: string;
    like_count?: number; comments_count?: number;
  }> }>(
    `${GRAPH}/${v}/${igId}/media?fields=id,caption,permalink,timestamp,like_count,comments_count` +
    `&limit=${limit}&access_token=${encodeURIComponent(token)}`);
  return (j.data ?? []).map((m) => ({
    postRef: m.id,
    caption: (m.caption ?? '').split('\n')[0].slice(0, 200) || '(başlıksız paylaşım)',
    permalink: m.permalink ?? null,
    timestamp: m.timestamp ?? new Date().toISOString(),
    likeCount: m.like_count ?? 0,
    commentsCount: m.comments_count ?? 0,
  }));
}

// =====================================================================
// TAM METRİK KATMANI — reklam harcaması dışındaki her şey.
// Meta'nın insights cevapları iki farklı biçimde gelir; ayrıştırma saf
// fonksiyonlarda tutulur (birim testle kilitli), fetch* yalnız HTTP yapar.
// Bir metrik erişilemezse SIFIR döner, akış çökmez — kısmi veri, veri
// yokluğundan iyidir; hangi metriğin gelmediği ayrıca raporlanır.
// =====================================================================

/** Hesap seviyesi günlük özet. */
export interface MetaIgDaily {
  reach: number;
  profileViews: number;
  accountsEngaged: number;
  websiteClicks: number;
}

/** Kitle kırılımı satırı (ülke/şehir/yaş/cinsiyet). */
export interface MetaAudienceRow {
  dimension: string;
  bucket: string;
  value: number;
}

/** Paylaşım başına performans. */
export interface MetaPostInsight {
  reach: number;
  impressions: number;
  saves: number;
  shares: number;
  videoViews: number;
  totalInteractions: number;
}

interface InsightNode {
  name?: string;
  total_value?: { value?: number; breakdowns?: Array<{
    dimension_keys?: string[];
    results?: Array<{ dimension_values?: string[]; value?: number }>;
  }> };
  values?: Array<{ value?: number }>;
}

/** Bir metriğin sayısal değeri: önce total_value, yoksa values[] toplamı. */
function metricValue(node: InsightNode | undefined): number {
  if (!node) return 0;
  const tv = node.total_value?.value;
  if (typeof tv === 'number') return tv;
  const sum = (node.values ?? []).reduce((a, v) => a + (Number(v?.value) || 0), 0);
  return Number.isFinite(sum) ? sum : 0;
}

/** Günlük hesap metriklerini ayrıştırır. Eksik metrik = 0. */
export function parseIgDailyInsights(json: { data?: InsightNode[] } | null | undefined): MetaIgDaily {
  const byName = new Map<string, InsightNode>();
  for (const n of json?.data ?? []) if (n?.name) byName.set(n.name, n);
  return {
    reach: metricValue(byName.get('reach')),
    profileViews: metricValue(byName.get('profile_views')),
    accountsEngaged: metricValue(byName.get('accounts_engaged')),
    websiteClicks: metricValue(byName.get('website_clicks')),
  };
}

/**
 * Demografi kırılımını düz satırlara çevirir.
 * Meta: total_value.breakdowns[].results[].dimension_values[] = value
 */
export function parseIgDemographics(
  json: { data?: InsightNode[] } | null | undefined,
  dimension: string,
): MetaAudienceRow[] {
  const out: MetaAudienceRow[] = [];
  for (const node of json?.data ?? []) {
    for (const b of node.total_value?.breakdowns ?? []) {
      for (const r of b.results ?? []) {
        const bucket = (r.dimension_values ?? []).join('|').trim();
        const value = Number(r.value) || 0;
        if (bucket) out.push({ dimension, bucket, value });
      }
    }
  }
  // Büyükten küçüğe: arayüz zaten ilk N'i gösteriyor.
  return out.sort((a, b) => b.value - a.value);
}

/** Paylaşım metriklerini ayrıştırır (medya tipine göre bazıları gelmez). */
export function parseIgPostInsights(json: { data?: InsightNode[] } | null | undefined): MetaPostInsight {
  const byName = new Map<string, InsightNode>();
  for (const n of json?.data ?? []) if (n?.name) byName.set(n.name, n);
  return {
    reach: metricValue(byName.get('reach')),
    impressions: metricValue(byName.get('impressions')),
    saves: metricValue(byName.get('saved')),
    shares: metricValue(byName.get('shares')),
    // Reels'te 'views', eski videolarda 'video_views' adıyla gelir.
    videoViews: metricValue(byName.get('views')) || metricValue(byName.get('video_views')),
    totalInteractions: metricValue(byName.get('total_interactions')),
  };
}

/** Hesap seviyesi günlük metrikler. Erişilemezse hepsi 0 döner. */
export async function fetchIgDaily(token: string, v: string, igId: string): Promise<MetaIgDaily> {
  try {
    const j = await graphGet<{ data?: InsightNode[] }>(
      `${GRAPH}/${v}/${igId}/insights?metric=reach,profile_views,accounts_engaged,website_clicks` +
      `&period=day&metric_type=total_value&access_token=${encodeURIComponent(token)}`);
    return parseIgDailyInsights(j);
  } catch {
    return { reach: 0, profileViews: 0, accountsEngaged: 0, websiteClicks: 0 };
  }
}

/**
 * Takipçi demografisi — ülke, şehir, yaş, cinsiyet.
 * Her kırılım ayrı istek ister (Meta tek istekte birden çok breakdown almaz).
 */
export async function fetchIgAudience(token: string, v: string, igId: string): Promise<MetaAudienceRow[]> {
  const dims: Array<[string, string]> = [
    ['country', 'country'], ['city', 'city'], ['age', 'age'], ['gender', 'gender'],
  ];
  const out: MetaAudienceRow[] = [];
  for (const [dim, breakdown] of dims) {
    try {
      const j = await graphGet<{ data?: InsightNode[] }>(
        `${GRAPH}/${v}/${igId}/insights?metric=follower_demographics&period=lifetime` +
        `&metric_type=total_value&breakdown=${breakdown}&access_token=${encodeURIComponent(token)}`);
      out.push(...parseIgDemographics(j, dim));
    } catch { /* bu kırılım kapalıysa diğerleri devam etsin */ }
  }
  return out;
}

/** Tek bir paylaşımın performansı. */
export async function fetchIgPostInsights(
  token: string, v: string, mediaId: string,
): Promise<MetaPostInsight> {
  const empty = { reach: 0, impressions: 0, saves: 0, shares: 0, videoViews: 0, totalInteractions: 0 };
  try {
    const j = await graphGet<{ data?: InsightNode[] }>(
      `${GRAPH}/${v}/${mediaId}/insights?metric=reach,saved,shares,views,total_interactions` +
      `&access_token=${encodeURIComponent(token)}`);
    return parseIgPostInsights(j);
  } catch {
    return empty;
  }
}

/** Sayfa takipçi sayısı (Page Insights metrikleri bu sürümde kapalı). */
export async function fetchPageFollowers(
  token: string, v: string, pageId: string,
): Promise<number | null> {
  try {
    const j = await graphGet<{ followers_count?: number; fan_count?: number }>(
      `${GRAPH}/${v}/${pageId}?fields=followers_count,fan_count&access_token=${encodeURIComponent(token)}`);
    return j.followers_count ?? j.fan_count ?? null;
  } catch {
    return null;
  }
}
