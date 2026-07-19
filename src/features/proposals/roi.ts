// =====================================================================
// PREI | ROI hesap motoru (frontend) — yıllık-odaklı. Backend
// server/src/modules/proposals/roi.util.ts ile BİREBİR aynı formül;
// kaydedince yetkili çıktı backend'de yeniden hesaplanır. İki taraf
// eşit kalmalı (değişiklik ikisine birden uygulanmalı).
// Aylık kira kendi para biriminde girilir; hesapta statik USD-bazlı
// çapraz kurla fiyat para birimine çevrilir (web calc yedek kurları).
// =====================================================================
import type { ProposalRoiInputs, ProposalRoiReport } from '../../core/types';

const n = (v: number | undefined, d = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

// 1 birim = x USD (web roi-calculator.html statik yedek kurları).
const USD_RATES: Record<string, number> = { USD: 1.0, AED: 0.2723, EUR: 1.16, GBP: 1.34, TRY: 0.0233 };
export function fxRate(from: string, to: string): number {
  if (from === to) return 1;
  const f = USD_RATES[from], t = USD_RATES[to];
  return f && t ? f / t : 1;
}

export function computeRoi(
  inputs: ProposalRoiInputs,
  price: number,
  priceCurrency = 'USD',
): ProposalRoiReport {
  const p = Math.max(0, n(price));
  const rentalType = inputs.rentalType === 'shortterm' ? 'shortterm' : 'longterm';
  const rentCurrency = inputs.rentCurrency || priceCurrency;

  const apprPct = n(inputs.appreciationPercent, 5);
  const maintPct = n(inputs.maintenancePercent, 1);
  const mgmtPct = n(inputs.mgmtFeePercent, 5);
  const aidatMonthly = n(inputs.aidatMonthly); // fiyat para biriminde

  // Aylık kirayı fiyat para birimine çevir.
  const monthlyRentInPriceCcy = n(inputs.monthlyRent) * fxRate(rentCurrency, priceCurrency);
  // Kısa dönem: doluluk uygulanır; uzun dönem: 100%.
  const occ = rentalType === 'shortterm'
    ? Math.min(100, Math.max(0, n(inputs.occupancyRate, 60))) / 100
    : 1;

  const annualGrossRent = monthlyRentInPriceCcy * 12 * occ;
  const maintenanceCost = p * (maintPct / 100);
  const aidatAnnual = aidatMonthly * 12;
  const mgmtCost = annualGrossRent * (mgmtPct / 100);
  const annualCosts = maintenanceCost + aidatAnnual + mgmtCost;
  const annualNetRent = annualGrossRent - annualCosts;

  const grossYieldPct = p > 0 ? (annualGrossRent / p) * 100 : 0;
  const netYieldPct = p > 0 ? (annualNetRent / p) * 100 : 0;
  const annualAppreciation = p * (apprPct / 100);
  const annualTotalReturnPct = netYieldPct + apprPct;

  const round = (v: number, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  };

  return {
    price: round(p),
    currency: priceCurrency,
    rentalType,
    rentCurrency,
    monthlyRentInPriceCcy: round(monthlyRentInPriceCcy),
    annualGrossRent: round(annualGrossRent),
    annualCosts: round(annualCosts),
    annualNetRent: round(annualNetRent),
    grossYieldPct: round(grossYieldPct),
    netYieldPct: round(netYieldPct),
    annualAppreciation: round(annualAppreciation),
    appreciationPct: round(apprPct),
    annualTotalReturnPct: round(annualTotalReturnPct),
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
