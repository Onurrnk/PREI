// =====================================================================
// PREI | Marketing — saf yardımcılar (test edilebilir, DB'den bağımsız).
// Zaman pencereleri, ISO hafta ekseni, oran hesapları. Meta yerine
// ad_spend (elle/CSV) + gerçek CRM aggregate'ini birleştiren katman bunları
// kullanır.
// =====================================================================

export type MarketingTimeframe = '30D' | '90D' | 'YTD' | '1Y';
export const MARKETING_TIMEFRAMES: MarketingTimeframe[] = ['30D', '90D', 'YTD', '1Y'];

export const MARKET_NAME: Record<string, string> = {
  TR: 'Türkiye', AE: 'Dubai (UAE)', ES: 'Spain', GB: 'United Kingdom', TH: 'Thailand', DE: 'Germany',
};

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86_400_000);

export interface Window { from: string; to: string; prevFrom: string; prevTo: string }

/** Cari + önceki karşılaştırma penceresi (delta hesabı için). UTC bazlı. */
export function timeframeRange(tf: MarketingTimeframe, now: Date): Window {
  const y = now.getUTCFullYear();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  switch (tf) {
    case '90D': {
      const from = addDays(today, -89);
      return { from: iso(from), to: iso(today), prevFrom: iso(addDays(today, -179)), prevTo: iso(addDays(today, -90)) };
    }
    case 'YTD': {
      const from = new Date(Date.UTC(y, 0, 1));
      const prevFrom = new Date(Date.UTC(y - 1, 0, 1));
      const prevTo = new Date(Date.UTC(y - 1, now.getUTCMonth(), now.getUTCDate()));
      return { from: iso(from), to: iso(today), prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
    }
    case '1Y': {
      const from = addDays(new Date(Date.UTC(y - 1, now.getUTCMonth(), now.getUTCDate())), 1);
      const prevFrom = addDays(new Date(Date.UTC(y - 2, now.getUTCMonth(), now.getUTCDate())), 1);
      const prevTo = new Date(Date.UTC(y - 1, now.getUTCMonth(), now.getUTCDate()));
      return { from: iso(from), to: iso(today), prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
    }
    case '30D':
    default: {
      const from = addDays(today, -29);
      return { from: iso(from), to: iso(today), prevFrom: iso(addDays(today, -59)), prevTo: iso(addDays(today, -30)) };
    }
  }
}

/** Verilen tarihin ait olduğu ISO haftasının Pazartesi'si (UTC, 00:00). */
export function mondayOf(d: Date): Date {
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = base.getUTCDay(); // 0=Paz ... 6=Cmt
  const shift = dow === 0 ? -6 : 1 - dow; // Pazartesi'ye kaydır
  return addDays(base, shift);
}

/** ISO 8601 hafta numarası (1..53). */
export function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow); // haftanın Perşembe'si
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Son n ISO haftası (eskiden yeniye). key = Pazartesi ISO tarihi; label = 'W##'. */
export function lastNWeeks(now: Date, n: number): { key: string; label: string }[] {
  const thisMonday = mondayOf(now);
  const weeks: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const monday = addDays(thisMonday, -i * 7);
    weeks.push({ key: iso(monday), label: `W${isoWeekNumber(monday)}` });
  }
  return weeks;
}

/** Yüzde değişim; önceki 0/negatifse anlamlı değil → null. */
export function pctDelta(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

/** Lead başına maliyet; lead yoksa tanımsız → null. */
export function safeCpl(spendEur: number, leads: number): number | null {
  return leads > 0 ? spendEur / leads : null;
}

/** ROAS = komisyon / harcama; harcama yoksa tanımsız → null. */
export function safeRoas(commissionEur: number, spendEur: number): number | null {
  return spendEur > 0 ? commissionEur / spendEur : null;
}
