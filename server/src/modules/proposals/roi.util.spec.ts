import { describe, it, expect } from 'vitest';
import { computeRoi, fxRate } from './roi.util';

// Yıllık-odaklı model: brüt/net getiri, yıllık değer artışı, yıllık toplam getiri.
describe('computeRoi (yıllık model)', () => {
  it('uzun dönemde doluluk uygulanmaz (100%)', () => {
    const r = computeRoi(
      { rentalType: 'longterm', monthlyRent: 2000, appreciationPercent: 5,
        maintenancePercent: 0, mgmtFeePercent: 0, aidatMonthly: 0 },
      300000, 'USD',
    );
    // 2000×12 = 24.000 (doluluk yok)
    expect(r.annualGrossRent).toBe(24000);
    expect(r.grossYieldPct).toBe(8);
    // Gider yok → net = brüt
    expect(r.annualNetRent).toBe(24000);
    expect(r.netYieldPct).toBe(8);
    // Yıllık değer artışı = 300000×5% = 15.000
    expect(r.annualAppreciation).toBe(15000);
    // Toplam getiri = net getiri + değer artışı = 8 + 5 = 13
    expect(r.annualTotalReturnPct).toBe(13);
  });

  it('kısa dönemde doluluk brüt kirayı düşürür', () => {
    const r = computeRoi(
      { rentalType: 'shortterm', monthlyRent: 2000, occupancyRate: 50,
        appreciationPercent: 0, maintenancePercent: 0, mgmtFeePercent: 0, aidatMonthly: 0 },
      300000, 'USD',
    );
    // 2000×12×0.5 = 12.000
    expect(r.annualGrossRent).toBe(12000);
  });

  it('bakım + aidat + yönetim giderleri net getiriyi düşürür', () => {
    const r = computeRoi(
      { rentalType: 'longterm', monthlyRent: 1000, maintenancePercent: 1,
        mgmtFeePercent: 10, aidatMonthly: 100, appreciationPercent: 0 },
      200000, 'USD',
    );
    // brüt = 12.000; bakım = 2.000; aidat = 1.200; yönetim = 1.200 → gider 4.400
    expect(r.annualGrossRent).toBe(12000);
    expect(r.annualCosts).toBe(4400);
    expect(r.annualNetRent).toBe(7600);
    expect(r.netYieldPct).toBeLessThan(r.grossYieldPct);
  });

  it('kira para birimi farklıysa çapraz kurla fiyat para birimine çevrilir', () => {
    // TRY kira, USD fiyat: monthlyRent 100.000 TRY → USD'ye çevrilir.
    const r = computeRoi(
      { rentalType: 'longterm', monthlyRent: 100000, rentCurrency: 'TRY',
        maintenancePercent: 0, mgmtFeePercent: 0, aidatMonthly: 0 },
      1000000, 'USD',
    );
    const expectedMonthlyUsd = 100000 * fxRate('TRY', 'USD');
    expect(r.monthlyRentInPriceCcy).toBeCloseTo(Math.round(expectedMonthlyUsd * 100) / 100, 0);
    expect(r.annualGrossRent).toBeGreaterThan(0);
  });

  it('aidat kendi para biriminde girilip fiyat para birimine çevrilir', () => {
    // Fiyat USD, aidat TRY: aidat gideri USD karşılığına çevrilir.
    const usdAidat = computeRoi(
      { rentalType: 'longterm', monthlyRent: 1000, maintenancePercent: 0, mgmtFeePercent: 0,
        aidatMonthly: 30000, aidatCurrency: 'TRY', appreciationPercent: 0 },
      200000, 'USD',
    );
    const sameCcy = computeRoi(
      { rentalType: 'longterm', monthlyRent: 1000, maintenancePercent: 0, mgmtFeePercent: 0,
        aidatMonthly: 30000, appreciationPercent: 0 },
      200000, 'USD',
    );
    // TRY aidat çok daha küçük USD gideri → net kira daha yüksek olmalı.
    expect(usdAidat.annualNetRent).toBeGreaterThan(sameCcy.annualNetRent);
    expect(usdAidat.annualCosts).toBeLessThan(sameCcy.annualCosts);
  });

  it('sıfır fiyatta bölme hatası vermez', () => {
    const r = computeRoi({ monthlyRent: 1000 }, 0, 'USD');
    expect(Number.isFinite(r.netYieldPct)).toBe(true);
    expect(r.grossYieldPct).toBe(0);
  });
});
