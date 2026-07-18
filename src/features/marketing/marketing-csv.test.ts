// =====================================================================
// parseAdSpendCsv — Meta Ads Manager dışa aktarımı + sade başlıklar.
// =====================================================================
import { describe, it, expect } from 'vitest';
import {
  parseCsvLine, normalizeMarket, normalizeDate, normalizeStatus, normalizeChannel, parseAdSpendCsv,
} from './marketing-csv';

describe('parseCsvLine', () => {
  it('tırnaklı alan içindeki virgülü bölmez', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });
  it('çift tırnak kaçışını çözer', () => {
    expect(parseCsvLine('"He said ""hi""",x')).toEqual(['He said "hi"', 'x']);
  });
});

describe('normalize yardımcıları', () => {
  it('market eş anlamlıları', () => {
    expect(normalizeMarket('Dubai')).toBe('AE');
    expect(normalizeMarket('UAE')).toBe('AE');
    expect(normalizeMarket('Türkiye')).toBe('TR');
    expect(normalizeMarket('United Kingdom')).toBe('GB');
    expect(normalizeMarket('atlantis')).toBeUndefined();
  });
  it('tarih formatları', () => {
    expect(normalizeDate('2026-07-19')).toBe('2026-07-19');
    expect(normalizeDate('2026/7/1')).toBe('2026-07-01');
    expect(normalizeDate('07/01/2026')).toBe('2026-07-01'); // MM/DD/YYYY (Meta/US)
    expect(normalizeDate('01.07.2026')).toBe('2026-07-01'); // DD.MM.YYYY (TR)
    expect(normalizeDate('bogus')).toBeUndefined();
  });
  it('durum ve kanal', () => {
    expect(normalizeStatus('Paused')).toBe('paused');
    expect(normalizeStatus('aktif')).toBe('active');
    expect(normalizeChannel('Facebook')).toBe('meta');
    expect(normalizeChannel('IG')).toBe('instagram');
  });
});

describe('parseAdSpendCsv — Meta dışa aktarımı', () => {
  const csv = [
    'Campaign name,Amount spent (EUR),Impressions,Link clicks,Reporting starts,Reporting ends',
    'Golden Visa Dubai,"2,840.50",184200,1620,06/20/2026,07/19/2026',
    'İstanbul Yatırım,1620,96400,880,06/20/2026,07/19/2026',
  ].join('\n');

  it('başlıkları eşler, para birimini başlıktan çıkarır, sayıyı ayrıştırır', () => {
    const { rows, errors } = parseAdSpendCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'Golden Visa Dubai', spend: 2840.5, currency: 'EUR',
      impressions: 184200, clicks: 1620, periodStart: '2026-06-20', periodEnd: '2026-07-19',
      channel: 'meta', status: 'active',
    });
  });

  it('tarihsiz satırı atlar ve gerekçe toplar', () => {
    const bad = 'Campaign name,Reporting starts,Reporting ends\nNoDate,,';
    const { rows, errors } = parseAdSpendCsv(bad);
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('sade başlıklar + market eşleme', () => {
    const simple = 'name,market,spend,period_start,period_end\nBodrum Villas,Türkiye,1060,2026-06-01,2026-06-30';
    const { rows } = parseAdSpendCsv(simple);
    expect(rows[0]).toMatchObject({ name: 'Bodrum Villas', marketCode: 'TR', spend: 1060 });
  });
});
