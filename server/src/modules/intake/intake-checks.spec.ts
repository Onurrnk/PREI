// =====================================================================
// buildSubmissionChecks — onay öncesi deterministik ön-kontrol.
// Kurallar: komisyon (yok/yüksek), fiyat (yok/ters), konum yok, az görsel,
// daire tipi yok, kısa açıklama. warn = kritik, info = eksik olabilir.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { buildSubmissionChecks } from './intake.service';

type CheckInput = Parameters<typeof buildSubmissionChecks>[0];
const base: CheckInput = {
  commissionPct: 5, priceMin: 100, priceMax: 200, imageCount: 5,
  unitTypes: ['1+1', '2+1'], description: 'Yeterince uzun bir proje açıklaması metni burada.',
  city: 'Dubai', marketCode: 'AE',
};
const codes = (o: Partial<CheckInput>) =>
  buildSubmissionChecks({ ...base, ...o }).map((c) => c.code);

describe('buildSubmissionChecks', () => {
  it('eksiksiz gönderi → hiç bayrak yok', () => {
    expect(buildSubmissionChecks(base)).toEqual([]);
  });

  it('komisyon yok → no_commission (warn)', () => {
    const r = buildSubmissionChecks({ ...base, commissionPct: null });
    expect(r).toContainEqual({ code: 'no_commission', level: 'warn' });
  });

  it('komisyon %10 üstü → high_commission (warn)', () => {
    expect(codes({ commissionPct: 15 })).toContain('high_commission');
    expect(codes({ commissionPct: 10 })).not.toContain('high_commission'); // sınır dahil değil
  });

  it('fiyat yok → no_price; ters aralık → price_inverted', () => {
    expect(codes({ priceMin: null, priceMax: null })).toContain('no_price');
    expect(codes({ priceMin: 500, priceMax: 100 })).toContain('price_inverted');
  });

  it('konum yok (şehir + pazar) → no_location', () => {
    expect(codes({ city: null, marketCode: null })).toContain('no_location');
    expect(codes({ city: null, marketCode: 'AE' })).not.toContain('no_location');
  });

  it('az görsel / daire tipi yok / kısa açıklama → info bayrakları', () => {
    expect(codes({ imageCount: 2 })).toContain('few_images');
    expect(codes({ unitTypes: [] })).toContain('no_unit_types');
    expect(codes({ description: 'kısa' })).toContain('short_description');
    expect(codes({ description: null })).toContain('short_description');
  });

  it('warn ve info seviyeleri doğru işaretlenir', () => {
    const r = buildSubmissionChecks({ ...base, commissionPct: null, imageCount: 1 });
    expect(r.find((c) => c.code === 'no_commission')?.level).toBe('warn');
    expect(r.find((c) => c.code === 'few_images')?.level).toBe('info');
  });
});
