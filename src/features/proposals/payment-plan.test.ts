import { describe, it, expect } from 'vitest';
import { buildPaymentPlan, planTotal, type BuildPlanInput } from './payment-plan';

const labels: BuildPlanInput['labels'] = {
  down: 'Peşinat',
  installment: '{{n}}. Taksit',
  remainder: 'Kalan',
  monthlyNote: '{{n}} ay · aylık %{{pct}}',
};

const build = (downPct: number, months: number) =>
  buildPaymentPlan({ downPct, months, labels });

describe('buildPaymentPlan', () => {
  // Onur'un verdiği örnek: %30 peşinat, kalan %70, 12 ay.
  it('%30 peşinat + 12 ay → peşinat + 12 taksit', () => {
    const rows = build(30, 12);
    expect(rows).toHaveLength(13);
    expect(rows[0].milestone).toBe('Peşinat');
    expect(rows[0].percentage).toBe('30');
    expect(rows[1].milestone).toBe('1. Taksit');
    expect(rows[12].milestone).toBe('12. Taksit');
  });

  // Asıl mesele: %70/12 = 5.8333… → satırlar yuvarlanınca toplam 99.96 çıkardı.
  it('yüzde toplamı TAM 100 olur (yuvarlama artığı son taksite eklenir)', () => {
    for (const [d, m] of [[30, 12], [25, 7], [40, 3], [33, 11], [15, 9]] as const) {
      expect(planTotal(build(d, m))).toBe(100);
    }
  });

  it('taksitler eşit, yalnız sonuncusu artıkla düzeltilir', () => {
    const rows = build(30, 12);
    const pcts = rows.slice(1).map((r) => Number(r.percentage));
    const firstEleven = pcts.slice(0, 11);
    expect(new Set(firstEleven).size).toBe(1);      // 11'i birebir aynı
    expect(firstEleven[0]).toBe(5.83);
    expect(pcts[11]).toBeCloseTo(5.87, 2);          // artık burada
  });

  it('peşinat yoksa peşinat satırı hiç yazılmaz', () => {
    const rows = build(0, 6);
    expect(rows).toHaveLength(6);
    expect(rows.some((r) => r.milestone === 'Peşinat')).toBe(false);
    expect(planTotal(rows)).toBe(100);
  });

  it('peşinat %100 ise taksit üretilmez', () => {
    const rows = build(100, 12);
    expect(rows).toHaveLength(1);
    expect(rows[0].percentage).toBe('100');
  });

  it('vade girilmemişse kalan tek kalemde durur', () => {
    const rows = build(30, 0);
    expect(rows).toHaveLength(2);
    expect(rows[1].milestone).toBe('Kalan');
    expect(rows[1].percentage).toBe('70');
  });

  // 36 satırlık form okunmaz olur.
  it('12 aydan uzun vade tek özet satıra iner, notunda aylık oran yazar', () => {
    const rows = build(20, 36);
    expect(rows).toHaveLength(2);
    expect(rows[1].milestone).toBe('36. Taksit');
    expect(rows[1].percentage).toBe('80');
    expect(rows[1].date).toContain('36 ay');
    expect(rows[1].date).toContain('2.22');
    expect(planTotal(rows)).toBe(100);
  });

  it('sınır dışı peşinat kırpılır', () => {
    expect(build(-10, 4)[0].milestone).toBe('1. Taksit');   // 0 kabul edildi
    expect(planTotal(build(150, 4))).toBe(100);
  });

  it('ondalıklı ay sayısı aşağı yuvarlanır', () => {
    expect(buildPaymentPlan({ downPct: 50, months: 4.9, labels })).toHaveLength(5);
  });

  it('geçersiz girdide çökmez', () => {
    expect(planTotal(buildPaymentPlan({
      downPct: NaN, months: NaN, labels,
    }))).toBe(100);
  });
});

describe('planTotal', () => {
  it('boş planda 0', () => {
    expect(planTotal([])).toBe(0);
  });

  it('sayıya çevrilemeyen yüzdeyi 0 sayar', () => {
    expect(planTotal([{ milestone: 'x', percentage: 'abc', date: '' }])).toBe(0);
  });

  it('iki basamağa yuvarlar', () => {
    expect(planTotal([
      { milestone: 'a', percentage: '33.333', date: '' },
      { milestone: 'b', percentage: '33.333', date: '' },
    ])).toBe(66.67);
  });
});
