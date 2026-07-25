// =====================================================================
// PREI | Proje olanakları — kanonik liste.
//
// Sorun: davet formunda olanak alanı hiç yoktu; proje onaylanınca
// ProjectProfile'daki "Olanaklar" bölümü boş kalıyordu.
//
// Neden serbest metin değil de liste: geliştirici "kapalı havuz",
// "Kapalı Havuz", "iç mekan havuz" yazsa üçü ayrı olanak sayılırdı ve
// "havuzu olan projeler" filtrelenemezdi. Kod sabit, etiket görünür.
// =====================================================================

export interface Amenity {
  code: string;
  tr: string;
  en: string;
  /** Formda gruplama başlığı. */
  group: 'social' | 'security' | 'technical' | 'comfort' | 'outdoor';
}

export const AMENITY_GROUPS: Array<{ key: Amenity['group']; tr: string; en: string }> = [
  { key: 'social',    tr: 'Sosyal Olanaklar',   en: 'Social' },
  { key: 'outdoor',   tr: 'Dış Mekân',          en: 'Outdoor' },
  { key: 'security',  tr: 'Güvenlik',           en: 'Security' },
  { key: 'technical', tr: 'Teknik Altyapı',     en: 'Technical' },
  { key: 'comfort',   tr: 'Konfor & Donanım',   en: 'Comfort' },
];

export const AMENITIES: Amenity[] = [
  // Sosyal
  { code: 'indoor_pool',   tr: 'Kapalı havuz',            en: 'Indoor pool',          group: 'social' },
  { code: 'outdoor_pool',  tr: 'Açık havuz',              en: 'Outdoor pool',         group: 'social' },
  { code: 'kids_pool',     tr: 'Çocuk havuzu',            en: 'Kids pool',            group: 'social' },
  { code: 'gym',           tr: 'Spor salonu',             en: 'Gym',                  group: 'social' },
  { code: 'spa',           tr: 'SPA / hamam / sauna',     en: 'Spa / sauna',          group: 'social' },
  { code: 'cinema',        tr: 'Sinema salonu',           en: 'Cinema room',          group: 'social' },
  { code: 'kids_club',     tr: 'Çocuk kulübü',            en: 'Kids club',            group: 'social' },
  { code: 'meeting_room',  tr: 'Toplantı / çalışma alanı', en: 'Meeting / co-work',   group: 'social' },
  { code: 'cafe',          tr: 'Kafe / restoran',         en: 'Café / restaurant',    group: 'social' },
  { code: 'market',        tr: 'Market / AVM',            en: 'Market / mall',        group: 'social' },

  // Dış mekân
  { code: 'landscape',     tr: 'Peyzaj / yeşil alan',     en: 'Landscaped gardens',   group: 'outdoor' },
  { code: 'playground',    tr: 'Çocuk oyun alanı',        en: 'Playground',           group: 'outdoor' },
  { code: 'walking_track', tr: 'Yürüyüş parkuru',         en: 'Walking track',        group: 'outdoor' },
  { code: 'sports_court',  tr: 'Spor sahası',             en: 'Sports court',         group: 'outdoor' },
  { code: 'bbq',           tr: 'Mangal / piknik alanı',   en: 'BBQ area',             group: 'outdoor' },
  { code: 'pet_area',      tr: 'Evcil hayvan alanı',      en: 'Pet area',             group: 'outdoor' },
  { code: 'sea_view',      tr: 'Deniz manzarası',         en: 'Sea view',             group: 'outdoor' },
  { code: 'beach_access',  tr: 'Plaja erişim',            en: 'Beach access',         group: 'outdoor' },

  // Güvenlik
  { code: 'security_24_7', tr: '7/24 güvenlik',           en: '24/7 security',        group: 'security' },
  { code: 'cctv',          tr: 'Kamera sistemi (CCTV)',   en: 'CCTV',                 group: 'security' },
  { code: 'gated',         tr: 'Kapalı site',             en: 'Gated community',      group: 'security' },
  { code: 'fire_alarm',    tr: 'Yangın alarmı',           en: 'Fire alarm',           group: 'security' },
  { code: 'intercom',      tr: 'Görüntülü diafon',        en: 'Video intercom',       group: 'security' },
  { code: 'concierge',     tr: 'Resepsiyon / concierge',  en: 'Concierge',            group: 'security' },

  // Teknik
  { code: 'smart_home',    tr: 'Akıllı ev sistemi',       en: 'Smart home system',    group: 'technical' },
  { code: 'fiber',         tr: 'Fiber altyapı',           en: 'Fibre internet',       group: 'technical' },
  { code: 'generator',     tr: 'Jeneratör',               en: 'Generator',            group: 'technical' },
  { code: 'earthquake',    tr: 'Deprem yönetmeliğine uygun', en: 'Seismic compliant', group: 'technical' },
  { code: 'ev_charger',    tr: 'Elektrikli araç şarjı',   en: 'EV charging',          group: 'technical' },
  { code: 'water_tank',    tr: 'Su deposu / hidrofor',    en: 'Water tank',           group: 'technical' },
  { code: 'solar',         tr: 'Güneş enerjisi',          en: 'Solar energy',         group: 'technical' },

  // Konfor
  { code: 'built_in',      tr: 'Ankastre seti',           en: 'Built-in appliances',  group: 'comfort' },
  { code: 'underfloor',    tr: 'Yerden ısıtma',           en: 'Underfloor heating',   group: 'comfort' },
  { code: 'ac',            tr: 'Klima / VRF',             en: 'Air conditioning',     group: 'comfort' },
  { code: 'elevator',      tr: 'Asansör',                 en: 'Elevator',             group: 'comfort' },
  { code: 'closed_parking', tr: 'Kapalı otopark',         en: 'Covered parking',      group: 'comfort' },
  { code: 'open_parking',  tr: 'Açık otopark',            en: 'Open parking',         group: 'comfort' },
  { code: 'balcony',       tr: 'Balkon / teras',          en: 'Balcony / terrace',    group: 'comfort' },
  { code: 'ensuite',       tr: 'Ebeveyn banyosu',         en: 'En-suite bathroom',    group: 'comfort' },
  { code: 'laundry',       tr: 'Çamaşır odası',           en: 'Laundry room',         group: 'comfort' },
  { code: 'furnished',     tr: 'Eşyalı teslim',           en: 'Furnished',            group: 'comfort' },
];

const BY_CODE = new Map(AMENITIES.map((a) => [a.code, a]));

/**
 * Serbest girdiyi kanonik kodlara çevirir.
 *
 * Kabul edilen: kod ("indoor_pool") ya da tam etiket ("Kapalı havuz").
 * Tanınmayan girdi ATILIR — çöp olanak listeye girmesin. Sıra korunur,
 * tekrarlar temizlenir.
 */
export function normalizeAmenities(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input)
    ? input
    : String(input ?? '').split(',');

  const out: string[] = [];
  for (const item of raw) {
    const t = item.trim();
    if (!t) continue;
    if (BY_CODE.has(t)) {
      if (!out.includes(t)) out.push(t);
      continue;
    }
    // Etiketle gelmiş olabilir (TR ya da EN) — küçük harfe indirip ara.
    const lower = t.toLocaleLowerCase('tr');
    const match = AMENITIES.find(
      (a) => a.tr.toLocaleLowerCase('tr') === lower || a.en.toLowerCase() === t.toLowerCase(),
    );
    if (match && !out.includes(match.code)) out.push(match.code);
  }
  return out;
}

/** Kodları görünen etiketlere çevirir (ProjectProfile "Olanaklar" bölümü). */
export function amenityLabels(codes: string[], lang: 'tr' | 'en' = 'tr'): string[] {
  return codes
    .map((c) => BY_CODE.get(c))
    .filter((a): a is Amenity => !!a)
    .map((a) => (lang === 'en' ? a.en : a.tr));
}

/** Forma verilecek gruplu liste. */
export function amenityCatalog(): Array<{
  group: string; groupTr: string; groupEn: string;
  items: Array<{ code: string; tr: string; en: string }>;
}> {
  return AMENITY_GROUPS.map((g) => ({
    group: g.key,
    groupTr: g.tr,
    groupEn: g.en,
    items: AMENITIES.filter((a) => a.group === g.key)
      .map((a) => ({ code: a.code, tr: a.tr, en: a.en })),
  }));
}
