// =====================================================================
// PREI | Ülke/bölge normalleştirme — saf (yan etkisiz).
//
// Sorun: yatırım hedefi serbest metin olarak geliyordu ("Dubai", "İngiltere",
// "Londra", "uae"). Aynı ülke üç farklı yazımla kaydolunca "İspanya'da kaç
// müşteri arıyor" sorusu cevaplanamıyordu.
//
// Çözüm: her şey ISO-3166-1 alpha-2 koduna indirgenir. Şehir adı verilse de
// ülkesi çıkarılır (Dubai → AE), böylece kayıt tek biçim olur.
//
// Türkçe tuzağı: 'İ' (U+0130) JS'in /i bayrağıyla 'i'ye KATLANMAZ ve
// "i̇spanya" (i + U+0307) ile "İspanya" farklı dizilerdir. Bu yüzden her
// karşılaştırma önce foldTr()'den geçer.
// =====================================================================

/** Türkçe metni ASCII'ye katlar (İ/ı/ş/ğ/ü/ö/ç → i/i/s/g/u/o/c), küçültür. */
export function foldTr(s: string): string {
  return s
    .normalize('NFD')
    // Birleşen aksanları at (ayrışan İ → I + U+0307 dahil)
    .replace(/[̀-ͯ]/g, '')
    .replace(/[İIı]/g, 'i')
    .replace(/[Çç]/g, 'c').replace(/[Ğğ]/g, 'g')
    .replace(/[Öö]/g, 'o').replace(/[Şş]/g, 's')
    .replace(/[Üü]/g, 'u')
    .toLowerCase();
}

export interface Country {
  code: string;   // ISO-3166-1 alpha-2
  tr: string;     // Türkçe ad (kayıtlarda ve arayüzde gösterilen)
  en: string;
}

/**
 * Tanınan ülkeler. Liste ProDuality'nin hizmet + rapor kapsamıyla sınırlı
 * tutuldu; dünyadaki her ülkeyi taşımak arama kalitesini artırmıyor,
 * yanlış eşleşme riskini artırıyor.
 */
export const COUNTRIES: Country[] = [
  { code: 'TR', tr: 'Türkiye', en: 'Türkiye' },
  { code: 'AE', tr: 'Birleşik Arap Emirlikleri', en: 'United Arab Emirates' },
  { code: 'ES', tr: 'İspanya', en: 'Spain' },
  { code: 'GB', tr: 'İngiltere', en: 'United Kingdom' },
  { code: 'DE', tr: 'Almanya', en: 'Germany' },
  { code: 'NL', tr: 'Hollanda', en: 'Netherlands' },
  { code: 'PT', tr: 'Portekiz', en: 'Portugal' },
  { code: 'GR', tr: 'Yunanistan', en: 'Greece' },
  { code: 'IT', tr: 'İtalya', en: 'Italy' },
  { code: 'FR', tr: 'Fransa', en: 'France' },
  { code: 'CY', tr: 'Kıbrıs', en: 'Cyprus' },
  { code: 'QA', tr: 'Katar', en: 'Qatar' },
  { code: 'SA', tr: 'Suudi Arabistan', en: 'Saudi Arabia' },
  { code: 'US', tr: 'ABD', en: 'United States' },
  { code: 'TH', tr: 'Tayland', en: 'Thailand' },
  { code: 'GE', tr: 'Gürcistan', en: 'Georgia' },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Ülke adı yazımları (katlanmış). Kısaltmalar ve yaygın hatalar dahil. */
const NAME_ALIASES: Record<string, string> = {
  // TR
  turkiye: 'TR', turkey: 'TR', turkiyye: 'TR', tr: 'TR', turkiyem: 'TR',
  // AE — "BAE"/"UAE"/"Emirlikler" hepsi aynı yere
  bae: 'AE', uae: 'AE', ae: 'AE', emirlikler: 'AE',
  'birlesik arap emirlikleri': 'AE', 'united arab emirates': 'AE',
  // ES
  ispanya: 'ES', spain: 'ES', espana: 'ES', es: 'ES',
  // GB
  ingiltere: 'GB', 'birlesik krallik': 'GB', uk: 'GB', gb: 'GB',
  'united kingdom': 'GB', england: 'GB', britanya: 'GB',
  // Diğer
  almanya: 'DE', germany: 'DE', de: 'DE',
  hollanda: 'NL', netherlands: 'NL', nl: 'NL',
  portekiz: 'PT', portugal: 'PT', pt: 'PT',
  yunanistan: 'GR', greece: 'GR', gr: 'GR',
  italya: 'IT', italy: 'IT', it: 'IT',
  fransa: 'FR', france: 'FR', fr: 'FR',
  kibris: 'CY', cyprus: 'CY', cy: 'CY', 'kuzey kibris': 'CY',
  katar: 'QA', qatar: 'QA', qa: 'QA',
  'suudi arabistan': 'SA', 'saudi arabia': 'SA', suudistan: 'SA', sa: 'SA',
  abd: 'US', usa: 'US', us: 'US', amerika: 'US', 'united states': 'US',
  tayland: 'TH', thailand: 'TH', th: 'TH',
  gurcistan: 'GE', georgia: 'GE', ge: 'GE',
};

/**
 * Şehir/bölge → ülke. Eylül'ün çıkardığı "market" alanına bazen şehir
 * düşüyor ("Dubai"); ülkesiz kayıt tutmaktansa buradan çözüyoruz.
 */
const CITY_TO_COUNTRY: Record<string, string> = {
  // AE
  dubai: 'AE', 'abu dabi': 'AE', 'abu dhabi': 'AE', sharjah: 'AE', sarja: 'AE',
  'dubai marina': 'AE', 'palm jumeirah': 'AE', 'downtown dubai': 'AE',
  'business bay': 'AE', jvc: 'AE', 'dubai hills': 'AE',
  // TR
  istanbul: 'TR', ankara: 'TR', izmir: 'TR', antalya: 'TR', bodrum: 'TR',
  bursa: 'TR', alanya: 'TR', fethiye: 'TR', trabzon: 'TR', mersin: 'TR',
  nisantasi: 'TR', kadikoy: 'TR', besiktas: 'TR', uskudar: 'TR',
  cengelkoy: 'TR', karakoy: 'TR', sisli: 'TR', bebek: 'TR',
  // ES
  barcelona: 'ES', madrid: 'ES', marbella: 'ES', malaga: 'ES', valencia: 'ES',
  alicante: 'ES', ibiza: 'ES', mallorca: 'ES', sevilla: 'ES', costa: 'ES',
  // GB
  londra: 'GB', london: 'GB', manchester: 'GB', birmingham: 'GB', liverpool: 'GB',
  // Diğer
  berlin: 'DE', munih: 'DE', munich: 'DE', frankfurt: 'DE', hamburg: 'DE',
  amsterdam: 'NL', rotterdam: 'NL',
  lizbon: 'PT', lisbon: 'PT', porto: 'PT', algarve: 'PT',
  atina: 'GR', athens: 'GR', selanik: 'GR',
  milano: 'IT', roma: 'IT', rome: 'IT',
  paris: 'FR', nice: 'FR',
  girne: 'CY', lefkosa: 'CY', magusa: 'CY',
  doha: 'QA', riyad: 'SA', riyadh: 'SA', cidde: 'SA', jeddah: 'SA',
  'new york': 'US', miami: 'US', 'los angeles': 'US',
  bangkok: 'TH', phuket: 'TH',
  tiflis: 'GE', batum: 'GE',
};

export interface NormalizedTarget {
  countryCode: string;
  countryName: string;
  /** Girdi bir şehirse burada döner (ülke adı verilmişse null). */
  region: string | null;
}

/** Kod → ülke kaydı. Bilinmeyen kod null. */
export function countryByCode(code: string | null | undefined): Country | null {
  if (!code) return null;
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

/**
 * Serbest metni ülkeye çevirir. Ülke adı, kod ya da şehir kabul eder.
 * Çözemezse null döner — TAHMİN ETMEZ (yanlış ülke, boş ülkeden kötüdür).
 */
export function normalizeCountry(input: string | null | undefined): Country | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  // ISO kodu doğrudan verilmiş olabilir.
  const upper = raw.toUpperCase();
  if (upper.length === 2 && BY_CODE.has(upper)) return BY_CODE.get(upper)!;

  const folded = foldTr(raw).replace(/\s+/g, ' ').trim();
  const byName = NAME_ALIASES[folded];
  if (byName) return BY_CODE.get(byName) ?? null;

  const byCity = CITY_TO_COUNTRY[folded];
  if (byCity) return BY_CODE.get(byCity) ?? null;

  return null;
}

/**
 * "Pazar" + "şehir" ikilisini tek bir hedefe indirger.
 *
 * Kural: ülke önce pazar alanından çözülür; pazar çözülemezse şehirden
 * çıkarılır. Bölge her zaman şehir alanından gelir (pazar alanına şehir
 * yazılmışsa o da bölge sayılır).
 */
export function normalizeTarget(
  market: string | null | undefined,
  city?: string | null,
): NormalizedTarget | null {
  const country = normalizeCountry(market) ?? normalizeCountry(city);
  if (!country) return null;

  const cleanCity = (city ?? '').trim();
  // Pazar alanına şehir yazılmışsa ("Dubai") ve şehir boşsa, onu bölge yap.
  const marketIsCity = !cleanCity && !!market
    && !NAME_ALIASES[foldTr(market).replace(/\s+/g, ' ').trim()]
    && !!CITY_TO_COUNTRY[foldTr(market).replace(/\s+/g, ' ').trim()];

  // Bölge = şehir; ilçe ayrı kolonda tutulur, burada birleştirilmez.
  return {
    countryCode: country.code,
    countryName: country.tr,
    region: cleanCity || (marketIsCity ? market!.trim() : null),
  };
}

/**
 * Şehrin ülkesiyle çelişip çelişmediğini söyler.
 *
 * Neden: mevcut veride "market: Almanya, city: Barcelona" gibi bir kayıt
 * var — Eylül yanlış çıkarmış. Sessizce kaydetmek yerine işaretliyoruz.
 * Null = çelişki yok ya da şehir tanınmıyor (tanınmayan şehre suçlama yok).
 */
export function countryCityConflict(
  countryCode: string, city: string | null | undefined,
): string | null {
  const c = (city ?? '').trim();
  if (!c) return null;
  const cityCountry = CITY_TO_COUNTRY[foldTr(c).replace(/\s+/g, ' ').trim()];
  if (!cityCountry || cityCountry === countryCode) return null;
  const expected = BY_CODE.get(cityCountry);
  return `"${c}" ${expected?.tr ?? cityCountry} şehri, kayıtlı ülke ${
    BY_CODE.get(countryCode)?.tr ?? countryCode}`;
}

/**
 * Serbest metinde geçen ülke/şehir adından ülke kodunu çıkarır.
 *
 * NEDEN VAR: Eylül'ün bilgi bankası araması ülkeden bağımsız yapılıyordu.
 * "İstanbul'da Boğaz manzarası" sorusuna İspanya ve BAE yatırımcı profili
 * tabloları dönüyordu (ölçüldü: skorlar 0,46-0,47, hepsi zayıf). Ülke
 * bilinince o gürültü tamamen elenebiliyor.
 *
 * Tek eşleşme kuralı: metinde BİRDEN ÇOK ülke geçiyorsa null döner —
 * "Türkiye mi Dubai mi" diye soran bir mesajda tek ülkeye daralmak
 * yanlış olur, filtresiz arama daha doğrudur.
 */
export function detectCountryInText(text: string | null | undefined): string | null {
  const folded = foldTr(text ?? '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!folded) return null;

  const words = folded.split(' ');
  const found = new Set<string>();
  // 1-3 kelimelik pencereler: "abu dabi", "dubai marina", "istanbul" hepsi yakalanır.
  for (let i = 0; i < words.length; i++) {
    for (let n = 3; n >= 1; n--) {
      if (i + n > words.length) continue;
      const gram = words.slice(i, i + n).join(' ');
      const code = NAME_ALIASES[gram] ?? CITY_TO_COUNTRY[gram];
      if (code) { found.add(code); break; }
    }
  }
  return found.size === 1 ? [...found][0] : null;
}
