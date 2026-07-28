// =====================================================================
// PREI | "Bu proje kimlere sunuldu" — saf dönüşüm (DB'siz, test edilebilir).
//
// Sunulan Ürünler kaydının ters yönü: müşteri kartından projeye
// bakabiliyorduk, burada projeden müşteriye bakıyoruz. Aynı aşama
// sözlüğünü kullanır — iki ekranda farklı etiket görünmesin.
// =====================================================================
import {
  isPresentedStage, stageLabel, isSold, type PresentedStage,
} from '../clients/presented/presented.model';
import type { AudienceRow } from './catalog.repository';

export interface AudienceEntry {
  presentedId: string;
  contactId: string;
  name: string;
  /** Müşteri mi yoksa hâlâ aday mı — listede rozetle ayrılır. */
  isCustomer: boolean;
  stage: PresentedStage;
  stageLabel: string;
  price: number | null;
  currency: string;
  presentedAt: string;
  dealId: string | null;
}

export interface AudienceSummary {
  /** Kaç kişiye sunuldu. */
  total: number;
  /** Satışla sonuçlanan sunum sayısı. */
  sold: number;
  /** Beğenmeyip huniden düşen sayısı. */
  rejected: number;
  people: AudienceEntry[];
}

export function toAudience(rows: AudienceRow[], lang: 'tr' | 'en' = 'tr'): AudienceSummary {
  const people = rows.map((r) => {
    // Veri bozulmuşsa (elle SQL, eski kayıt) aşamayı uydurmak yerine
    // 'presented'a düşürürüz — ekran çökmesin, yanlış rozet de olmasın.
    const stage: PresentedStage = isPresentedStage(r.stage) ? r.stage : 'presented';
    return {
      presentedId: r.id,
      contactId: r.contact_id,
      name: r.contact_name ?? 'İsimsiz kişi',
      isCustomer: r.lifecycle_stage === 'customer',
      stage,
      stageLabel: stageLabel(stage, lang),
      price: r.price == null ? null : Number(r.price),
      currency: r.currency,
      presentedAt: r.presented_at,
      dealId: r.deal_id,
    };
  });

  return {
    total: people.length,
    sold: people.filter((p) => isSold(p.stage)).length,
    rejected: people.filter((p) => p.stage === 'rejected').length,
    people,
  };
}
