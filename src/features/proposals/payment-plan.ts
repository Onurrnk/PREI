// =====================================================================
// PREI | Ödeme planı üretimi — saf (yan etkisiz).
//
// Onur'un tarifi: peşinat yüzdesini gir, kalanı vade ayına böl.
// Örnek: %30 peşinat, kalan %70 → 12 ay = her ay %5,83.
//
// Kritik: yüzdeler TOPLAMI 100 olmalı. Ondalık bölmede kalan kuruş
// kaybolmasın diye artık SON taksite eklenir; aksi hâlde toplam %99,96
// çıkıp teklifte tutarsızlık görünüyordu.
// =====================================================================

export interface PaymentPlanRow {
  milestone: string;
  percentage: string;
  date: string;
}

export interface BuildPlanInput {
  /** Peşinat yüzdesi (0-100). */
  downPct: number;
  /** Vade (ay). 0/negatif → kalan tek kalemde durur. */
  months: number;
  /** Etiketler — arayüz dili. */
  labels: {
    down: string;
    /** "{{n}}. Taksit" gibi; {{n}} ay sırası. */
    installment: string;
    remainder: string;
    /** "Aylık {{n}} ay" açıklaması için. */
    monthlyNote: string;
  };
}

/** İki basamağa yuvarlar (yüzde alanı bu hassasiyette gösteriliyor). */
const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Peşinat + vadeye göre plan satırlarını üretir.
 *
 * Vade büyükse (36 ay gibi) 36 satır üretmek formu okunmaz hâle getirir;
 * bu yüzden 12'den fazla ayda TEK bir "aylık taksit" satırı yazılır ve
 * notunda ay sayısı ile aylık oran belirtilir.
 */
export function buildPaymentPlan(input: BuildPlanInput): PaymentPlanRow[] {
  const down = Math.max(0, Math.min(100, Number(input.downPct) || 0));
  const months = Math.max(0, Math.floor(Number(input.months) || 0));
  const remaining = r2(100 - down);

  const rows: PaymentPlanRow[] = [];
  if (down > 0) {
    rows.push({ milestone: input.labels.down, percentage: String(r2(down)), date: '' });
  }
  if (remaining <= 0) return rows;

  // Vade yoksa kalan tek kalem.
  if (months <= 0) {
    rows.push({ milestone: input.labels.remainder, percentage: String(remaining), date: '' });
    return rows;
  }

  const per = r2(remaining / months);

  // Uzun vadede satır satır yazmak yerine tek özet satır.
  if (months > 12) {
    rows.push({
      milestone: input.labels.installment.replace('{{n}}', String(months)),
      percentage: String(remaining),
      date: input.labels.monthlyNote
        .replace('{{n}}', String(months))
        .replace('{{pct}}', String(per)),
    });
    return rows;
  }

  for (let i = 1; i <= months; i++) {
    rows.push({
      milestone: input.labels.installment.replace('{{n}}', String(i)),
      percentage: String(per),
      date: '',
    });
  }

  // Yuvarlama artığı son taksite: toplam tam 100 olsun.
  const sum = r2(rows.reduce((s, r) => s + Number(r.percentage), 0));
  const drift = r2(100 - sum);
  if (drift !== 0) {
    const last = rows[rows.length - 1];
    last.percentage = String(r2(Number(last.percentage) + drift));
  }
  return rows;
}

/** Satırların yüzde toplamı (arayüzde "Toplam: %100" göstergesi). */
export function planTotal(rows: PaymentPlanRow[]): number {
  return r2(rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0));
}
