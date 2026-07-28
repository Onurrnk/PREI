// =====================================================================
// PREI | Sunulan ürünler — saf mantık (DB'siz, test edilebilir).
//
// "Ne sunduk, ne sunmadık" kaydı. İki kaynak:
//   · İç proje  → property_id (kataloğumuzdan)
//   · Dış ilan  → başlık + ilan no + link + özellikler (katalogda yok)
//
// Aşama zinciri satış hunisini yansıtır: sunuldu → ilgilendi → teklif →
// rezerve → sözleşme → satıldı. "Beğenmedi" her aşamadan çıkılabilen yan yol.
// =====================================================================

export const PRESENTED_STAGES = [
  'presented', 'interested', 'rejected', 'offer', 'reserved', 'contract', 'sold',
] as const;

export type PresentedStage = typeof PRESENTED_STAGES[number];

/** Hunide ilerleme sırası — rozet rengi ve sıralama bunu kullanır. */
const STAGE_ORDER: Record<PresentedStage, number> = {
  presented: 1, interested: 2, offer: 3, reserved: 4, contract: 5, sold: 6,
  rejected: 0,
};

const LABELS: Record<PresentedStage, { tr: string; en: string }> = {
  presented:  { tr: 'Sunuldu',            en: 'Presented' },
  interested: { tr: 'İlgilendi',          en: 'Interested' },
  rejected:   { tr: 'Beğenmedi',          en: 'Not interested' },
  offer:      { tr: 'Teklif verildi',     en: 'Offer made' },
  reserved:   { tr: 'Rezerve edildi',     en: 'Reserved' },
  contract:   { tr: 'Sözleşme aşaması',   en: 'Contract stage' },
  sold:       { tr: 'Satış tamamlandı',   en: 'Sold' },
};

export const isPresentedStage = (v: unknown): v is PresentedStage =>
  typeof v === 'string' && (PRESENTED_STAGES as readonly string[]).includes(v);

export const stageLabel = (s: PresentedStage, lang: 'tr' | 'en' = 'tr'): string =>
  LABELS[s][lang];

export const stageOrder = (s: PresentedStage): number => STAGE_ORDER[s];

/** Satış tamamlandı mı — bu aşamada gerçek anlaşma (deal) kaydı doğar. */
export const isSold = (s: PresentedStage): boolean => s === 'sold';

/** Huniden düşmüş mü (kaybedilen). */
export const isLost = (s: PresentedStage): boolean => s === 'rejected';

export interface PresentedInput {
  propertyId?: string | null;
  externalTitle?: string | null;
  externalListingNo?: string | null;
  externalUrl?: string | null;
  externalSource?: string | null;
  location?: string | null;
  features?: string | null;
  price?: number | null;
  currency?: string | null;
  stage?: string | null;
  notes?: string | null;
  leadId?: string | null;
}

export interface NormalizedPresented {
  propertyId: string | null;
  externalTitle: string | null;
  externalListingNo: string | null;
  externalUrl: string | null;
  externalSource: string | null;
  location: string | null;
  features: string | null;
  price: number | null;
  currency: string;
  stage: PresentedStage;
  notes: string | null;
  leadId: string | null;
}

const trimOrNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/**
 * Girdiyi temizler ve doğrular. Hata mesajı döndürür (null = geçerli).
 *
 * Kural: iç proje YA DA dış ilan başlığı zorunlu — ikisi de boşsa kayıt
 * anlamsız. Link verildiyse http(s) olmalı (kullanıcı "sahibinden.com/..."
 * yazarsa tıklanabilir olmaz).
 */
export function normalizePresented(
  input: PresentedInput,
): { ok: true; value: NormalizedPresented } | { ok: false; error: string } {
  const propertyId = trimOrNull(input.propertyId);
  const externalTitle = trimOrNull(input.externalTitle);

  if (!propertyId && !externalTitle) {
    return { ok: false, error: 'Bir proje seçin ya da dış ilan başlığı yazın.' };
  }

  const url = trimOrNull(input.externalUrl);
  if (url && !/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'İlan linki http:// veya https:// ile başlamalı.' };
  }

  const stageRaw = trimOrNull(input.stage) ?? 'presented';
  if (!isPresentedStage(stageRaw)) {
    return { ok: false, error: `Geçersiz aşama: ${stageRaw}` };
  }

  const price = input.price == null || Number.isNaN(Number(input.price))
    ? null
    : Number(input.price);
  if (price != null && price < 0) {
    return { ok: false, error: 'Fiyat negatif olamaz.' };
  }

  return {
    ok: true,
    value: {
      propertyId,
      externalTitle,
      externalListingNo: trimOrNull(input.externalListingNo),
      externalUrl: url,
      externalSource: trimOrNull(input.externalSource),
      location: trimOrNull(input.location),
      features: trimOrNull(input.features),
      price,
      currency: (trimOrNull(input.currency) ?? 'EUR').toUpperCase().slice(0, 3),
      stage: stageRaw,
      notes: trimOrNull(input.notes),
      leadId: trimOrNull(input.leadId),
    },
  };
}

/** Müşteri kartı özeti: kaç sunum, kaçı elendi, kaçı satışa döndü. */
export function summarize(stages: PresentedStage[]): {
  total: number; active: number; rejected: number; sold: number;
} {
  return {
    total: stages.length,
    active: stages.filter((s) => !isLost(s) && !isSold(s)).length,
    rejected: stages.filter(isLost).length,
    sold: stages.filter(isSold).length,
  };
}
