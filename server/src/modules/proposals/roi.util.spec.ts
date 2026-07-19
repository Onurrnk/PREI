import { describe, it, expect } from 'vitest';
import { computeRoi } from './roi.util';

// Web sitesi roi-calculator.html özet modeliyle aynı çekirdek. Bilinen
// girdilerle beklenen büyüklükleri (yön + oran) doğrular.
describe('computeRoi', () => {
  it('uzun dönem kira + değer artışını doğru toplar', () => {
    const r = computeRoi(
      {
        rentalType: 'longterm', monthlyRent: 2000, occupancyRate: 100, years: 1,
        appreciationPercent: 10, rentGrowthPercent: 0, maintenancePercent: 0,
        mgmtFeePercent: 0, purchaseTaxPercent: 0, annualTaxPercent: 0,
      },
      300000,
    );
    expect(r.annualGrossRentY1).toBe(24000);
    expect(r.annualNetCashflowY1).toBe(24000);
    expect(r.grossYieldPct).toBe(8);
    expect(r.capitalAppreciation).toBe(30000);
    expect(r.totalProfit).toBe(54000);
    expect(r.totalRoiPct).toBe(18);
  });

  it('giderler net getiriyi brütün altına indirir', () => {
    const r = computeRoi(
      {
        rentalType: 'longterm', monthlyRent: 1000, occupancyRate: 100, years: 5,
        maintenancePercent: 1, mgmtFeePercent: 10, annualTaxPercent: 0,
        appreciationPercent: 5, rentGrowthPercent: 0, purchaseTaxPercent: 4,
      },
      200000,
    );
    expect(r.netYieldPct).toBeLessThan(r.grossYieldPct);
    expect(r.investedCapital).toBe(208000);
    expect(r.equityMultiple).toBeGreaterThan(1);
  });

  it('airbnb modu ADR × 365 × doluluk kullanır', () => {
    const r = computeRoi(
      {
        rentalType: 'airbnb', adr: 100, airbnbOccupancy: 50, airbnbExpensesPercent: 0,
        years: 1, maintenancePercent: 0, annualTaxPercent: 0,
        appreciationPercent: 0, purchaseTaxPercent: 0,
      },
      500000,
    );
    expect(r.annualGrossRentY1).toBe(18250);
  });

  it('sıfır fiyatta bölme hatası vermez', () => {
    const r = computeRoi({ monthlyRent: 1000, years: 3 }, 0);
    expect(Number.isFinite(r.totalRoiPct)).toBe(true);
    expect(r.grossYieldPct).toBe(0);
  });
});
