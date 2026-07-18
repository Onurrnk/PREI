// =====================================================================
// Marketing saf yardımcılar — zaman pencereleri, ISO hafta ekseni, oranlar.
// =====================================================================
import { describe, it, expect } from 'vitest';
import {
  timeframeRange, mondayOf, isoWeekNumber, lastNWeeks, pctDelta, safeCpl, safeRoas,
} from './marketing.util';

describe('timeframeRange', () => {
  const now = new Date('2026-07-19T12:00:00Z'); // Pazar

  it('30D: cari 30 günlük pencere + hemen öncesi', () => {
    const w = timeframeRange('30D', now);
    expect(w.to).toBe('2026-07-19');
    expect(w.from).toBe('2026-06-20'); // 29 gün geri
    expect(w.prevTo).toBe('2026-06-19');
    expect(w.prevFrom).toBe('2026-05-21');
  });

  it('YTD: yıl başından bugüne + geçen yıl aynı dönem', () => {
    const w = timeframeRange('YTD', now);
    expect(w.from).toBe('2026-01-01');
    expect(w.to).toBe('2026-07-19');
    expect(w.prevFrom).toBe('2025-01-01');
    expect(w.prevTo).toBe('2025-07-19');
  });

  it('1Y: son 12 ay', () => {
    const w = timeframeRange('1Y', now);
    expect(w.from).toBe('2025-07-20');
    expect(w.to).toBe('2026-07-19');
    expect(w.prevFrom).toBe('2024-07-20');
    expect(w.prevTo).toBe('2025-07-19');
  });
});

describe('mondayOf / isoWeekNumber', () => {
  it('Pazar (2026-07-19) → o ISO haftasının Pazartesi (2026-07-13)', () => {
    expect(mondayOf(new Date('2026-07-19T12:00:00Z')).toISOString().slice(0, 10)).toBe('2026-07-13');
  });
  it('Pazartesi kendini verir', () => {
    expect(mondayOf(new Date('2026-07-13T00:00:00Z')).toISOString().slice(0, 10)).toBe('2026-07-13');
  });
  it('ISO hafta numarası — 2026-01-01 (Perşembe) = W1', () => {
    expect(isoWeekNumber(new Date('2026-01-01T00:00:00Z'))).toBe(1);
  });
});

describe('lastNWeeks', () => {
  const now = new Date('2026-07-19T12:00:00Z');
  it('N hafta, eskiden yeniye, son hafta cari Pazartesi', () => {
    const weeks = lastNWeeks(now, 12);
    expect(weeks).toHaveLength(12);
    expect(weeks[11].key).toBe('2026-07-13');
    expect(weeks[0].key).toBe('2026-04-27'); // 11 hafta geri
    expect(weeks[11].label).toMatch(/^W\d+$/);
  });
});

describe('oran hesapları', () => {
  it('pctDelta: önceki 0 → null (bölme yok)', () => {
    expect(pctDelta(10, 0)).toBeNull();
    expect(pctDelta(120, 100)).toBe(20);
  });
  it('safeCpl: lead yoksa null', () => {
    expect(safeCpl(1000, 0)).toBeNull();
    expect(safeCpl(1000, 10)).toBe(100);
  });
  it('safeRoas: harcama yoksa null', () => {
    expect(safeRoas(4000, 0)).toBeNull();
    expect(safeRoas(4000, 1000)).toBe(4);
  });
});
