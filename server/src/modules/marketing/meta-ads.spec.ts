// =====================================================================
// Meta Ads Insights eşleme — saf (HTTP'siz) test.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { mapInsightRow, inferMarket, normalizeAccountId, parseIgDailyInsights, parseIgDemographics, parseIgPostInsights } from './meta-ads';

describe('normalizeAccountId', () => {
  it('act_ ön ekini garanti eder', () => {
    expect(normalizeAccountId('1939524660100799')).toBe('act_1939524660100799');
    expect(normalizeAccountId('act_1939524660100799')).toBe('act_1939524660100799');
  });
});

describe('inferMarket', () => {
  it('kampanya adından pazar tahmini', () => {
    expect(inferMarket('Golden Visa · Dubai Off-Plan (TR)')).toBe('TR'); // "TR" etiketi
    expect(inferMarket('Downtown Dubai Rental Yield')).toBe('AE');
    expect(inferMarket('Marbella Golden Visa')).toBe('ES');
    expect(inferMarket('London Nine Elms')).toBe('GB');
    expect(inferMarket('Generic Awareness')).toBeNull();
    expect(inferMarket(undefined)).toBeNull();
  });
});

describe('mapInsightRow', () => {
  it('ham insights satırını ad_spend satırına eşler', () => {
    const row = mapInsightRow({
      campaign_id: '120210', campaign_name: 'Istanbul Yatirim (TR)',
      spend: '1250.55', impressions: '84000', clicks: '620',
      date_start: '2026-07-18', date_stop: '2026-07-18',
    });
    expect(row).toEqual({
      name: 'Istanbul Yatirim (TR)', campaignRef: '120210', marketCode: 'TR',
      periodStart: '2026-07-18', periodEnd: '2026-07-18',
      spend: 1250.55, impressions: 84000, clicks: 620,
    });
  });

  it('campaign_id veya tarih yoksa null (atlanır)', () => {
    expect(mapInsightRow({ campaign_name: 'x', date_start: '2026-07-18' })).toBeNull();
    expect(mapInsightRow({ campaign_id: '1', campaign_name: 'x' })).toBeNull();
  });

  it('eksik metrikler 0 olur; ad yoksa kampanya kimliğinden türetir', () => {
    const row = mapInsightRow({ campaign_id: '9', date_start: '2026-07-01', date_stop: '2026-07-01' });
    expect(row).toMatchObject({ name: 'Kampanya 9', spend: 0, impressions: 0, clicks: 0 });
  });
});

// =====================================================================
// Tam metrik ayrıştırıcıları — Meta'nın gerçek cevap biçimleriyle.
// =====================================================================
describe('parseIgDailyInsights', () => {
  it('total_value biçimini okur', () => {
    const j = { data: [
      { name: 'reach', total_value: { value: 1240 } },
      { name: 'profile_views', total_value: { value: 87 } },
      { name: 'accounts_engaged', total_value: { value: 43 } },
      { name: 'website_clicks', total_value: { value: 12 } },
    ] };
    expect(parseIgDailyInsights(j)).toEqual({
      reach: 1240, profileViews: 87, accountsEngaged: 43, websiteClicks: 12,
    });
  });

  it('values[] biçimini toplayarak okur', () => {
    const j = { data: [{ name: 'reach', values: [{ value: 100 }, { value: 50 }] }] };
    expect(parseIgDailyInsights(j).reach).toBe(150);
  });

  it('eksik metriği 0 sayar, çökmez', () => {
    expect(parseIgDailyInsights({ data: [{ name: 'reach', total_value: { value: 5 } }] }))
      .toEqual({ reach: 5, profileViews: 0, accountsEngaged: 0, websiteClicks: 0 });
  });

  it('boş / bozuk cevapta hepsi 0', () => {
    const zero = { reach: 0, profileViews: 0, accountsEngaged: 0, websiteClicks: 0 };
    expect(parseIgDailyInsights(null)).toEqual(zero);
    expect(parseIgDailyInsights({})).toEqual(zero);
    expect(parseIgDailyInsights({ data: [] })).toEqual(zero);
  });
});

describe('parseIgDemographics', () => {
  const j = { data: [{
    name: 'follower_demographics',
    total_value: { breakdowns: [{
      dimension_keys: ['country'],
      results: [
        { dimension_values: ['DE'], value: 6 },
        { dimension_values: ['TR'], value: 90 },
        { dimension_values: ['AE'], value: 12 },
      ],
    }] },
  }] };

  it('kırılımı düz satırlara çevirir ve büyükten küçüğe sıralar', () => {
    expect(parseIgDemographics(j, 'country')).toEqual([
      { dimension: 'country', bucket: 'TR', value: 90 },
      { dimension: 'country', bucket: 'AE', value: 12 },
      { dimension: 'country', bucket: 'DE', value: 6 },
    ]);
  });

  it('çok boyutlu kırılımı birleştirir', () => {
    const multi = { data: [{ total_value: { breakdowns: [{
      results: [{ dimension_values: ['F', '25-34'], value: 30 }],
    }] } }] };
    expect(parseIgDemographics(multi, 'gender_age')[0].bucket).toBe('F|25-34');
  });

  it('boş kova atlanır; bozuk cevapta boş liste', () => {
    const empty = { data: [{ total_value: { breakdowns: [{ results: [{ dimension_values: [''], value: 9 }] }] } }] };
    expect(parseIgDemographics(empty, 'country')).toEqual([]);
    expect(parseIgDemographics(null, 'country')).toEqual([]);
    expect(parseIgDemographics({ data: [{}] }, 'country')).toEqual([]);
  });
});

describe('parseIgPostInsights', () => {
  it('paylaşım metriklerini okur', () => {
    const j = { data: [
      { name: 'reach', total_value: { value: 800 } },
      { name: 'saved', total_value: { value: 14 } },
      { name: 'shares', total_value: { value: 7 } },
      { name: 'total_interactions', total_value: { value: 95 } },
    ] };
    const r = parseIgPostInsights(j);
    expect(r.reach).toBe(800);
    expect(r.saves).toBe(14);
    expect(r.shares).toBe(7);
    expect(r.totalInteractions).toBe(95);
  });

  it('Reels "views" ile eski "video_views" adını da karşılar', () => {
    expect(parseIgPostInsights({ data: [{ name: 'views', total_value: { value: 500 } }] }).videoViews).toBe(500);
    expect(parseIgPostInsights({ data: [{ name: 'video_views', total_value: { value: 300 } }] }).videoViews).toBe(300);
  });

  it('metrik gelmezse 0, çökmez', () => {
    expect(parseIgPostInsights({ data: [] })).toEqual({
      reach: 0, impressions: 0, saves: 0, shares: 0, videoViews: 0, totalInteractions: 0,
    });
  });
});
