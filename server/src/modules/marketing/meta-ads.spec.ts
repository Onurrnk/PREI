// =====================================================================
// Meta Ads Insights eşleme — saf (HTTP'siz) test.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { mapInsightRow, inferMarket, normalizeAccountId } from './meta-ads';

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
