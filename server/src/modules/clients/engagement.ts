// =====================================================================
// PREI | Müşteri ilgi durumu (sıcak / normal / dondurulmuş).
//
// Neden yeni bir kolon değil: leads tablosunda zaten `status` (frozen
// dahil) ve `priority` var. Üçüncü bir eksen eklemek Kanban, skorlama ve
// bildirim sorgularını ikiye bölerdi. Bunun yerine tek bir kontrol iki
// mevcut alana eşleniyor.
//
// Dondurulmuş = daha önce görüşülmüş ama iletişim kesilmiş müşteri.
// Peşine düşülmez; YALNIZ kriterine uyan yeni proje çıkınca haber verilir
// (madde 25). Bu politika notifyCandidates sorgusunda uygulanıyor.
// =====================================================================

export type Engagement = 'hot' | 'normal' | 'frozen';

export const ENGAGEMENTS: Engagement[] = ['hot', 'normal', 'frozen'];

export interface LeadState {
  status: string;
  priority: string;
}

/** Mevcut lead alanlarından ilgi durumunu okur. */
export function readEngagement(lead: LeadState | null | undefined): Engagement {
  if (!lead) return 'normal';
  if (lead.status === 'frozen') return 'frozen';
  if (lead.priority === 'urgent' || lead.priority === 'high') return 'hot';
  return 'normal';
}

/**
 * İstenen ilgi durumunu lead alanlarına çevirir.
 *
 * Kurallar:
 * - Sıcak/normal seçilince donmuş kayıt ÇÖZÜLÜR ('contacted'a döner) —
 *   aksi hâlde "sıcak" dediğiniz müşteri Kanban'da donmuş görünürdü.
 * - Dondurulurken öncelik korunur: çözülünce eski önceliğine döner.
 * - Kazanılmış/kaybedilmiş kayıtların durumu DEĞİŞTİRİLMEZ; ticari
 *   sonucu bir arayüz düğmesi geri alamaz.
 */
export function applyEngagement(
  current: LeadState, next: Engagement,
): Partial<LeadState> {
  const terminal = current.status === 'converted' || current.status === 'lost';

  if (next === 'frozen') {
    return terminal ? {} : { status: 'frozen' };
  }

  const patch: Partial<LeadState> = {};
  if (current.status === 'frozen') patch.status = 'contacted';
  patch.priority = next === 'hot' ? 'urgent' : 'medium';
  return patch;
}

/** Arayüz etiketi. */
export function engagementLabel(e: Engagement, lang: 'tr' | 'en' = 'tr'): string {
  const tr: Record<Engagement, string> = {
    hot: 'Sıcak', normal: 'Normal', frozen: 'Dondurulmuş',
  };
  const en: Record<Engagement, string> = {
    hot: 'Hot', normal: 'Normal', frozen: 'Frozen',
  };
  return (lang === 'en' ? en : tr)[e];
}
