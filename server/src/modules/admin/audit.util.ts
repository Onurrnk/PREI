// =====================================================================
// PREI | Denetim yardımcıları — saf (yan etkisiz) parçalar.
//
// audit_log.diff tüm satırın before/after halini tutar (yüzlerce alan).
// Bunu olduğu gibi arayüze göndermek kullanılamaz; burada NE DEĞİŞTİĞİ
// özetlenir. Gürültü alanları (updated_at, version...) elenir.
// =====================================================================

/** Değişiklik özetinde gösterilmeyen teknik alanlar. */
const NOISE_FIELDS = new Set([
  'id', 'tenant_id', 'organization_id', 'version',
  'created_at', 'updated_at', 'created_by', 'updated_by',
  'last_activity_at', 'stage_changed_at',
]);

/** Gösterilecek değer uzunluk sınırı — uzun metinler kırpılır. */
const MAX_VALUE_LEN = 120;

export interface DiffField {
  field: string;
  before: string | null;
  after: string | null;
}

/** Bir alan değerini okunabilir kısa metne çevirir. */
function render(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    return v.length > MAX_VALUE_LEN ? `${v.slice(0, MAX_VALUE_LEN)}…` : v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // Nesne/dizi: kısa JSON — derin fark göstermeye çalışmayız.
  const j = JSON.stringify(v);
  return j.length > MAX_VALUE_LEN ? `${j.slice(0, MAX_VALUE_LEN)}…` : j;
}

/**
 * before/after arasındaki GERÇEK değişiklikleri döndürür.
 * - Yalnız 'after' varsa (oluşturma): dolu alanlar listelenir.
 * - Gürültü alanları elenir, sonuç alan adına göre sıralanır.
 * - Bozuk/eksik diff'te boş dizi (çökmez).
 */
export function summarizeDiff(
  diff: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null } | null | undefined,
  limit = 12,
): DiffField[] {
  if (!diff || typeof diff !== 'object') return [];
  const before = diff.before ?? null;
  const after = diff.after ?? null;
  if (!before && !after) return [];

  // Oluşturma: 'before' yok → dolu alanları göster.
  if (!before && after) {
    return Object.entries(after)
      .filter(([k, v]) => !NOISE_FIELDS.has(k) && v !== null && v !== '' &&
        !(typeof v === 'object' && v !== null && Object.keys(v as object).length === 0))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, limit)
      .map(([field, v]) => ({ field, before: null, after: render(v) }));
  }

  // Silme: 'after' yok → neyin silindiğini göster.
  if (before && !after) {
    return Object.entries(before)
      .filter(([k, v]) => !NOISE_FIELDS.has(k) && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, limit)
      .map(([field, v]) => ({ field, before: render(v), after: null }));
  }

  // Güncelleme: iki tarafı karşılaştır.
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: DiffField[] = [];
  for (const k of [...keys].sort()) {
    if (NOISE_FIELDS.has(k)) continue;
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    // Derin karşılaştırma: JSON eşitliği yeterli (alanlar sade tiplerde).
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    out.push({ field: k, before: render(b), after: render(a) });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Varlık tipini frontend rotasına çevirir — "kaydın kendisine git" bağlantısı.
 * Rotası olmayan tipler null döner (bağlantı gösterilmez).
 */
export function entityRoute(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'contact':
    case 'client':
      return `/clients/${entityId}`;
    case 'lead':
      return `/leads/${entityId}`;
    case 'project':
    case 'property':
      return `/projects/${entityId}`;
    case 'developer':
      return `/developers/${entityId}`;
    case 'proposal':
      return `/proposals/${entityId}`;
    case 'task':
    case 'meeting':
      return '/tasks';
    case 'document':
      return '/documents';
    case 'project_submission':
    case 'project_invite':
      return '/projects/intake';
    default:
      // user, tenant, marketing, ad_proposal... — kendi sayfası yok
      return null;
  }
}

/** Eylem etiketleri — arayüz i18n anahtarı olarak da kullanılabilir. */
export const ACTION_LABELS: Record<string, string> = {
  'contact.created': 'Müşteri oluşturdu',
  'contact.updated': 'Müşteri güncelledi',
  'contact.deleted': 'Müşteri sildi',
  'client.updated': 'Müşteri kartını güncelledi',
  'client.note_created': 'Müşteriye not ekledi',
  'contact.welcome_email_sent': 'Hoş geldiniz e-postası gönderdi',
  'contact.welcome_follow_up_sent': 'Takip e-postası gönderdi',
  'lead.created': 'Müşteri adayı oluşturdu',
  'lead.updated': 'Müşteri adayını güncelledi',
  'lead.deleted': 'Müşteri adayını sildi',
  'lead.analysis_sent': 'Analiz e-postası gönderdi',
  'lead.web_form': 'Web formundan aday geldi',
  'lead.whatsapp_message': 'WhatsApp mesajı alındı',
  'lead.agent_reply': 'Eylül cevap verdi',
  'lead.profile_extracted': 'Eylül profil bilgisi çıkardı',
  'lead.scored': 'Eylül skor hesapladı',
  'deal.created': 'Anlaşma oluşturdu',
  'deal.updated': 'Anlaşmayı güncelledi',
  'proposal.created': 'Teklif oluşturdu',
  'proposal.sent': 'Teklif gönderdi',
  'proposal.follow_up_sent': 'Teklif takibi gönderdi',
  'document.uploaded': 'Belge yükledi',
  'document.deleted': 'Belge sildi',
  'knowledge.added': 'Bilgi bankasına ekledi',
  'task.created': 'Görev oluşturdu',
  'task.updated': 'Görevi güncelledi',
  'meeting.created': 'Toplantı oluşturdu',
  'meeting.updated': 'Toplantıyı güncelledi',
  'meeting.deleted': 'Toplantıyı sildi',
  'project_submission.approved': 'Proje başvurusunu onayladı',
  'project_submission.rejected': 'Proje başvurusunu reddetti',
  'project_invite.created': 'Proje davet linki oluşturdu',
  'branding.updated': 'Marka ayarlarını değiştirdi',
  'branding.logo_uploaded': 'Logo yükledi',
  'user.created': 'Kullanıcı oluşturdu',
  'user.updated': 'Kullanıcıyı güncelledi',
  'marketing.manager_run': 'Pazarlama yöneticisi çalıştı',
};

/** Eylemin ağırlığı — arayüzde önem rengi için. */
export function actionSeverity(action: string): 'normal' | 'notable' | 'critical' {
  if (/\.deleted$|\.rejected$/.test(action)) return 'critical';
  if (/\.created$|\.approved$|_sent$|\.uploaded$/.test(action)) return 'notable';
  return 'normal';
}
