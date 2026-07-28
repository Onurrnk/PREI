// =====================================================================
// PREI | Bilgi bankası künyesi — pasajın kaynağını ve tazeliğini modele
// görünür kılar.
//
// Sorun: RAG'dan yalnız metin geliyordu. Eylül bir getiri oranının 8 ay mı
// 8 gün mü önce doğrulandığını bilemiyordu ve eski veriyi tam güvenle
// söylüyordu. Fiyat/vergi/vize yılda değişen bir işte bu, bilgi vermemekten
// daha risklidir.
//
// Çözüm: her pasajın başına tek satırlık künye. Model böylece
// (a) kaynağı belirtebilir, (b) eski veride ihtiyatlı konuşabilir.
// =====================================================================

/** Kaç aydan eski doğrulama "eski" sayılır — üstünde model uyarılır. */
export const STALE_AFTER_MONTHS = 6;

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/** '2026-07-15' → 'Temmuz 2026'. Çözülemezse ham değeri döndürür. */
export function humanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mi = Number(m[2]) - 1;
  return mi >= 0 && mi < 12 ? `${MONTHS_TR[mi]} ${m[1]}` : iso;
}

/** İki tarih arasındaki tam ay farkı (now verilmezse bugün). */
export function monthsSince(iso: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return null;
  return (now.getFullYear() - y) * 12 + (now.getMonth() - mo);
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/**
 * Pasajın başına künye satırı ekler.
 *
 * Örnek çıktı:
 *   [Kaynak: ProDuality Bilgi Bankası · Doğrulama: Kasım 2025
 *    · ⚠ 8 ay önce doğrulandı, teyit et · Güvenilirlik: editöryel görüş]
 *   <pasaj metni>
 *
 * Künye alanı yoksa satır kısalır; hiçbiri yoksa metin olduğu gibi döner
 * (eski kayıtlar ve dış kaynaklar bozulmaz).
 */
export function withProvenance(
  content: string,
  metadata: Record<string, unknown> | null | undefined,
  now: Date = new Date(),
): string {
  if (!metadata) return content;

  const parts: string[] = [];

  const title = str(metadata.title);
  const source = str(metadata.source);
  if (source) parts.push(`Kaynak: ${source}${title ? ` — ${title}` : ''}`);
  else if (title) parts.push(`Belge: ${title}`);

  const verified = str(metadata.last_verified);
  if (verified) {
    parts.push(`Doğrulama: ${humanDate(verified)}`);
    const age = monthsSince(verified, now);
    if (age !== null && age >= STALE_AFTER_MONTHS) {
      // Modelin ihtiyatlı konuşması için AÇIK uyarı — sessizce eski veri
      // vermektense "teyit gerekir" demesi yeğdir.
      parts.push(`⚠ ${age} ay önce doğrulandı, güncelliğini teyit et`);
    }
  }

  const conf = str(metadata.confidence);
  if (conf === 'editorial_opinion') parts.push('Güvenilirlik: editöryel görüş (kesin veri değil)');
  else if (conf === 'high') parts.push('Güvenilirlik: yüksek');

  const note = str(metadata.freshness_note);
  if (note) parts.push(`Not: ${note}`);

  if (parts.length === 0) return content;
  return `[${parts.join(' · ')}]\n${content}`;
}
