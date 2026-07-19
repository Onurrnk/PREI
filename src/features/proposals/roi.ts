// =====================================================================
// PREI | ROI hesap motoru (frontend) — canlı önizleme için. Backend
// server/src/modules/proposals/roi.util.ts ile BİREBİR aynı formül;
// kaydedince yetkili çıktı backend'de yeniden hesaplanır. İki tarafın
// eşit kalması şart (değişiklik ikisine birden uygulanmalı).
// =====================================================================
import type { ProposalRoiInputs, ProposalRoiReport } from '../../core/types';

const n = (v: number | undefined, d = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

export function computeRoi(inputs: ProposalRoiInputs, price: number): ProposalRoiReport {
  const p = Math.max(0, n(price));
  const years = Math.max(1, Math.min(40, n(inputs.years, 8)));
  const rentalType = inputs.rentalType === 'airbnb' ? 'airbnb' : 'longterm';

  const apprPct = n(inputs.appreciationPercent, 5);
  const rentGrowthPct = n(inputs.rentGrowthPercent, 2.5);
  const maintPct = n(inputs.maintenancePercent, 1);
  const mgmtPct = n(inputs.mgmtFeePercent, rentalType === 'airbnb' ? 0 : 5);
  const purchaseTaxPct = n(inputs.purchaseTaxPercent, 4);
  const annualTaxPct = n(inputs.annualTaxPercent, 0);

  let grossY1: number;
  if (rentalType === 'airbnb') {
    const adr = n(inputs.adr);
    const occ = Math.min(100, Math.max(0, n(inputs.airbnbOccupancy, 65))) / 100;
    grossY1 = adr * 365 * occ;
  } else {
    const rent = n(inputs.monthlyRent);
    const occ = Math.min(100, Math.max(0, n(inputs.occupancyRate, 92))) / 100;
    grossY1 = rent * 12 * occ;
  }

  const expenseOnRentPct =
    rentalType === 'airbnb' ? n(inputs.airbnbExpensesPercent, 25) : mgmtPct;
  const annualPropertyCost = p * (maintPct / 100) + p * (annualTaxPct / 100);

  let totalNetCashflow = 0;
  let netY1 = 0;
  for (let y = 1; y <= years; y++) {
    const gross = grossY1 * Math.pow(1 + rentGrowthPct / 100, y - 1);
    const rentExpense = gross * (expenseOnRentPct / 100);
    const net = gross - rentExpense - annualPropertyCost;
    if (y === 1) netY1 = net;
    totalNetCashflow += net;
  }

  const futureValue = p * Math.pow(1 + apprPct / 100, years);
  const capitalAppreciation = futureValue - p;
  const investedCapital = p + p * (purchaseTaxPct / 100);
  const totalProfit = totalNetCashflow + capitalAppreciation;

  const totalRoiPct = investedCapital > 0 ? (totalProfit / investedCapital) * 100 : 0;
  const equityMultiple =
    investedCapital > 0 ? (investedCapital + totalProfit) / investedCapital : 0;
  const annualizedRoiPct =
    investedCapital > 0 && equityMultiple > 0
      ? (Math.pow(equityMultiple, 1 / years) - 1) * 100
      : 0;

  const round = (v: number, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  };

  return {
    price: round(p),
    years,
    rentalType,
    investedCapital: round(investedCapital),
    annualGrossRentY1: round(grossY1),
    annualNetCashflowY1: round(netY1),
    grossYieldPct: round(p > 0 ? (grossY1 / p) * 100 : 0),
    netYieldPct: round(p > 0 ? (netY1 / p) * 100 : 0),
    totalNetCashflow: round(totalNetCashflow),
    futureValue: round(futureValue),
    capitalAppreciation: round(capitalAppreciation),
    totalProfit: round(totalProfit),
    totalRoiPct: round(totalRoiPct),
    annualizedRoiPct: round(annualizedRoiPct),
    equityMultiple: round(equityMultiple, 2),
  };
}

/** Binlik ayraçlı para formatı (Türkçe: 1.250.000 USD). */
export function formatMoney(v: number, currency: string): string {
  return `${Math.round(v).toLocaleString('tr-TR')} ${currency}`;
}
/** "1.250.000" → 1250000 (sadece rakam). */
export function parseNumeric(s: string): number | undefined {
  const digits = s.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}
export function groupThousands(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '';
  return v.toLocaleString('tr-TR');
}
