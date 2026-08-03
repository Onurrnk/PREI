// =====================================================================
// PREI | Arama sorgusu kurma — saf mantık (DB'siz, test edilebilir).
//
// NEDEN VAR (ölçüldü 2026-08-04): Bilgi bankası araması kullanıcının HAM
// SOHBET CÜMLESİNİ gömüyordu. Sohbet cümlesi konu değil, o yüzden vektör
// araması "sohbet hakkındaki" metinlerle eşleşiyordu — buluşma yeri SSS'leri,
// e-kitap sayfa altbilgileri, editöryel banner'lar.
//
// Aynı mesajın konu anahtarlarına indirgenmiş hâliyle ölçüm:
//   ham  : 0,48-0,50 → "Nereden Konut Almalı" altbilgisi, Kemerburgaz
//   konu : 0,57-0,65 → "Bebek — İstanbul'un Tavan Katı",
//                      "Boğaz'ın Anadolu Yakası — Yatırımcı İçin Gerçek Harita"
// Altı sonucun altısı doğru belgeye döndü.
//
// Yaklaşım bilinçli olarak DETERMİNİSTİK: ek bir LLM çağrısı cevaba gecikme
// ve yeni bir hata yolu ekler. Doldurma sözcükleri atılır, alan terimleri ve
// özel adlar korunur.
// =====================================================================
import { foldTr } from '../../common/geo';

/**
 * Sohbet doldurması. Bunlar atılınca geriye konu kalır.
 * Liste kısa tutuldu: agresif eleme anlamı da götürür.
 */
const DOLGU = new Set([
  've', 'veya', 'ile', 'için', 'gibi', 'ama', 'fakat', 'ancak', 'de', 'da', 'ki',
  'bir', 'bu', 'su', 'o', 'her', 'cok', 'daha', 'en', 'ise', 'yani', 'zaten',
  'acik', 'konusmak', 'gerekirse', 'aslinda', 'sey', 'sekilde', 'konuda', 'konusunda',
  'olmazsa', 'olmazimiz', 'istiyoruz', 'istiyorum', 'ariyoruz', 'ariyorum',
  'bakiyoruz', 'dusunuyoruz', 'olabilir', 'olabilirmi', 'acigiz', 'lutfen',
  'tesekkurler', 'tesekkur', 'ederim', 'merhaba', 'selam', 'evet', 'hayir',
  'sagliyor', 'saglamali', 'olmali', 'var', 'yok', 'mi', 'mu', 'mı', 'mü',
  'nedir', 'nasil', 'hangi', 'kadar', 'kac', 'biraz', 'once', 'sonra',
  'benim', 'bizim', 'sizin', 'onun', 'bende', 'bizde', 'icin', 'diye',
  'toplanti', 'toplantidan', 'bilgi', 'almak', 'vermek', 'senden', 'sizden',
]);

/** Alan terimleri — geçtiğinde MUTLAKA sorguya girer. */
const ALAN_TERIMLERI = [
  'boğaz', 'manzara', 'deniz', 'orman', 'yalı', 'villa', 'daire', 'rezidans',
  'penthouse', 'dubleks', 'müstakil', 'arsa', 'ofis', 'dükkan',
  'kira', 'getiri', 'roi', 'değer', 'artış', 'prestij', 'lüks', 'yatırım',
  'otopark', 'park', 'havuz', 'site', 'güvenlik', 'metro', 'ulaşım',
  'vatandaşlık', 'oturum', 'vize', 'tapu', 'vergi', 'komisyon',
  'bütçe', 'peşin', 'taksit', 'kredi',
];

/** Sayı + para birimi kalıpları korunur (10m usd, 850.000 AED, %5). */
const SAYI = /(?:[€$₺]|\b)(?:\d[\d.,]*\s?(?:m|mn|milyon|bin|k)?)\s?(?:usd|eur|try|aed|gbp|dolar|euro|tl|₺|\$|€)?\b/gi;

export interface TopicQueryInput {
  /** Kullanıcının son mesajı. */
  message: string;
  /** Varsa önceki mesajlardan çıkarılmış bağlam (şehir, ilçe, mülk tipi). */
  context?: Array<string | null | undefined>;
}

/**
 * Sohbet mesajını arama sorgusuna çevirir.
 *
 * Boş kalırsa ham mesaja düşer: dar ama boş bir sorgu, geniş ve gürültülü
 * sorgudan da kötüdür — hiç sonuç dönmemesine yol açar.
 */
export function buildTopicQuery(input: TopicQueryInput): string {
  const ham = (input.message ?? '').trim();
  if (!ham) return '';

  const parcalar: string[] = [];
  const eklendi = new Set<string>();
  const ekle = (s: string) => {
    const k = foldTr(s);
    if (k.length < 2 || eklendi.has(k)) return;
    eklendi.add(k);
    parcalar.push(s);
  };

  // 1) Bağlam (önceki turlardan bilinen şehir/ilçe/tip) en başa.
  for (const c of input.context ?? []) if (c) ekle(c.trim());

  // 2) Alan terimleri — mesajda geçenler.
  const foldedMesaj = foldTr(ham);
  for (const t of ALAN_TERIMLERI) if (foldedMesaj.includes(foldTr(t))) ekle(t);

  // 3) Sayı + para birimi.
  for (const m of ham.match(SAYI) ?? []) {
    const s = m.trim();
    if (/\d/.test(s)) ekle(s);
  }

  // 4) Kalan içerik sözcükleri (doldurma değilse).
  for (const kelime of ham.split(/[^\p{L}\p{N}]+/u)) {
    if (kelime.length < 3) continue;
    const f = foldTr(kelime);
    if (DOLGU.has(f)) continue;
    if (/^\d+$/.test(kelime)) continue;
    ekle(kelime);
  }

  const sorgu = parcalar.join(' ').trim();
  // Çok kısaldıysa (ör. tek kelimelik mesaj) ham metin daha güvenli.
  return sorgu.split(/\s+/).filter(Boolean).length >= 2 ? sorgu : ham;
}
