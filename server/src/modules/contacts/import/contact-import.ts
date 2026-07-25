// =====================================================================
// PREI | Toplu kişi içe aktarımı — saf dönüşüm katmanı (DB'siz, test edilebilir).
//
// Amaç: ProDuality'nin gerçek defteri (Excel, Google Kişiler dışa aktarımı,
// rehber dökümü) PREI'ye girsin. Sistemde 9 kişi var; defter içeri girmeden
// PREI'yi açmak WhatsApp'ı açmaktan yavaş.
//
// Tasarım kararları:
// · Kolon adları SABİT DEĞİL. Aynı bilgi "Ad", "İsim", "First Name", "Adı"
//   diye gelir. Kullanıcıyı dosyasını yeniden düzenlemeye zorlamak yerine
//   başlıkları tanıyoruz. Tanınmayan kolon sessizce yutulmaz — raporlanır.
// · Ülke/telefon çözümü ZATEN VAR: geo.ts ve phone-country.ts. Burada
//   yeniden yazılmıyor, çağrılıyor.
// · Mükerrer kontrolü İKİ KATMANLI: dosya içi (aynı kişi iki satırda) burada,
//   sisteme karşı (kişi zaten kayıtlı) repository'de. İkisi farklı sorun.
// · Bu katman HİÇBİR ŞEY YAZMAZ. Önizleme ve gerçek aktarım aynı taslakları
//   üretir — kullanıcı önizlemede ne gördüyse onu alır.
//
// Kayıp veri politikası: contacts tablosunda firma/unvan/bütçe/kaynak kolonu
// yok. Bu alanlar ATILMAZ, etiketlenip nota eklenir. Veri kaybetmektense
// notta taşımak yeğdir; ileride kolon açılırsa nottan çıkarılabilir.
// =====================================================================
import { foldTr, normalizeTarget, type NormalizedTarget } from '../../../common/geo';
import { countryFromPhone } from '../../../common/phone-country';
import { parseCsv, type ParsedCsv } from './csv-parse';

export type Field =
  | 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'whatsapp'
  | 'notes' | 'countries' | 'city' | 'lang' | 'source' | 'company'
  | 'title' | 'budget' | 'consent';

/**
 * Başlık eşleşmeleri. Anahtarlar foldTr'den geçmiş hâlleriyle yazılır
 * ('İsim' → 'isim'). Sıra önemli: TAM eşleşme önce denenir, sonra "içerir".
 * Bu yüzden 'telefon ulkesi' gibi bir kolon 'telefon'a kaymaz.
 */
const EXACT: Record<string, Field> = {
  // Ad / soyad
  ad: 'firstName', adi: 'firstName', isim: 'firstName',
  'first name': 'firstName', firstname: 'firstName', 'given name': 'firstName',
  soyad: 'lastName', soyadi: 'lastName', 'last name': 'lastName',
  lastname: 'lastName', surname: 'lastName', 'family name': 'lastName',
  'ad soyad': 'fullName', 'adi soyadi': 'fullName', 'ad-soyad': 'fullName',
  'isim soyisim': 'fullName', 'full name': 'fullName', fullname: 'fullName',
  'display name': 'fullName', name: 'fullName', kisi: 'fullName',
  musteri: 'fullName', 'musteri adi': 'fullName', 'ad ve soyad': 'fullName',
  // İletişim
  'e-posta': 'email', eposta: 'email', email: 'email', 'e-mail': 'email',
  mail: 'email', 'e mail': 'email', 'e-posta adresi': 'email',
  'e-mail address': 'email', 'email address': 'email',
  telefon: 'phone', tel: 'phone', gsm: 'phone', cep: 'phone',
  'cep telefonu': 'phone', phone: 'phone', mobile: 'phone',
  'phone number': 'phone', 'telefon numarasi': 'phone', 'telefon no': 'phone',
  whatsapp: 'whatsapp', wa: 'whatsapp', 'whatsapp no': 'whatsapp',
  // Segmentasyon
  ulke: 'countries', ulkeler: 'countries', country: 'countries',
  countries: 'countries', 'hedef ulke': 'countries', 'yatirim ulkesi': 'countries',
  'ilgilendigi ulkeler': 'countries', pazar: 'countries', market: 'countries',
  sehir: 'city', il: 'city', city: 'city', bolge: 'city', region: 'city',
  dil: 'lang', language: 'lang', 'tercih edilen dil': 'lang',
  kaynak: 'source', source: 'source', kanal: 'source', channel: 'source',
  // Nota katlanacaklar
  firma: 'company', sirket: 'company', company: 'company', kurum: 'company',
  organization: 'company',
  unvan: 'title', title: 'title', pozisyon: 'title', position: 'title',
  gorev: 'title',
  butce: 'budget', budget: 'budget', tutar: 'budget',
  not: 'notes', notlar: 'notes', note: 'notes', notes: 'notes',
  aciklama: 'notes', description: 'notes', comment: 'notes', yorum: 'notes',
  izin: 'consent', onay: 'consent', consent: 'consent',
  'pazarlama izni': 'consent', 'marketing consent': 'consent',
};

/** Tam eşleşme tutmazsa: başlık bu parçayı İÇERİYORSA alan budur. */
const CONTAINS: Array<[string, Field]> = [
  ['e-posta', 'email'], ['eposta', 'email'], ['email', 'email'], ['e-mail', 'email'],
  ['telefon', 'phone'], ['phone', 'phone'], ['mobile', 'phone'], ['gsm', 'phone'],
  ['whatsapp', 'whatsapp'],
  ['soyad', 'lastName'], ['surname', 'lastName'],
  ['ad soyad', 'fullName'], ['full name', 'fullName'],
  ['ulke', 'countries'], ['country', 'countries'],
  ['sehir', 'city'], ['city', 'city'],
  ['firma', 'company'], ['company', 'company'],
  ['unvan', 'title'],
  ['butce', 'budget'], ['budget', 'budget'],
  ['kaynak', 'source'], ['source', 'source'],
  ['not', 'notes'], ['note', 'notes'],
];

/**
 * Bilerek içe aktarılmayan kolonlar. "İçerir" kuralından ÖNCE elenirler:
 * "Telefon Ülkesi" içinde 'telefon' geçtiği için, telefon kolonundan önce
 * gelirse gerçek telefonun yuvasını çalardı. (PREI'nin kendi dışa
 * aktarımında bu kolon var — dışa aktarıp geri yüklemek yaygın olacak.)
 */
const IGNORED = new Set([
  'telefon ulkesi', 'phone country', 'id', 'uuid',
  'kayit tarihi', 'olusturma tarihi', 'created at', 'updated at',
  'guncelleme tarihi',
]);

const norm = (s: string): string => foldTr(s).replace(/\s+/g, ' ').trim();

/**
 * Başlık satırını alanlara eşler. Her alan YALNIZ İLK eşleşen kolonu alır —
 * Google Kişiler dışa aktarımı "Phone 1 - Value", "Phone 2 - Value" diye
 * gider; ikincisi telefonu ezmesin.
 */
export function mapHeader(header: string[]): Array<Field | null> {
  const used = new Set<Field>();
  return header.map((raw) => {
    const h = norm(raw);
    if (!h || IGNORED.has(h)) return null;

    let field: Field | undefined = EXACT[h];
    if (!field) {
      field = CONTAINS.find(([needle]) => h.includes(needle))?.[1];
    }
    if (!field || used.has(field)) return null;
    used.add(field);
    return field;
  });
}

/**
 * "Mehmet Ali Kaya" → ad "Mehmet Ali", soyad "Kaya".
 *
 * SON kelime soyad, kalanı ad. Türkçe'de çok parçalı ÖN AD yaygındır
 * (Mehmet Ali, Ayşe Nur, Hasan Hüseyin); çok parçalı soyad değil.
 * Bu kural uygulamanın geri kalanıyla aynı olmak zorunda — aksi hâlde
 * içe aktarılan kayıt elle açılandan farklı bölünür ve mükerrer görünür
 * (clients.repository.ts:126 ve ClientsList.tsx:43 aynı kuralı kullanır).
 */
export function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  const lastName = parts.pop()!;
  return { firstName: parts.join(' '), lastName };
}

const TRUTHY = new Set([
  'evet', 'var', 'true', '1', 'x', 'yes', 'y', 'e', 'onayli', 'onay',
  'izinli', 'aktif', 'checked',
]);

/** İzin kolonunu okur. Boş/anlaşılmaz → false (izinsiz varsayılır, KVKK). */
export function parseConsent(raw: string | null | undefined): boolean {
  return TRUTHY.has(norm(raw ?? ''));
}

/**
 * Ülke hücresini hedeflere çevirir. "Dubai, İngiltere" / "BAE; UK" gibi
 * çoklu değer kabul edilir; çözülemeyen parça sessizce düşmez, döner.
 */
export function parseTargets(
  raw: string | null | undefined, city?: string | null,
): { targets: NormalizedTarget[]; unresolved: string[] } {
  const cell = (raw ?? '').trim();
  const cityCell = (city ?? '').trim();
  if (!cell && !cityCell) return { targets: [], unresolved: [] };

  const parts = cell ? cell.split(/[,;/|]|\bve\b|\band\b/i).map((p) => p.trim()).filter(Boolean) : [''];
  const targets: NormalizedTarget[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();

  for (const p of parts) {
    // Şehir yalnız TEK ülkeye iliştirilir: "Dubai, İngiltere" satırında
    // şehri her ikisine de yazmak yanlış bölge üretir.
    const t = normalizeTarget(p, targets.length === 0 ? cityCell : null);
    if (!t) { if (p) unresolved.push(p); continue; }
    const key = `${t.countryCode}|${t.region ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(t);
  }
  return { targets, unresolved };
}

export interface ContactDraft {
  /** 1 tabanlı VERİ satırı numarası (başlık hariç) — hata mesajlarında kullanılır. */
  rowNumber: number;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  /** Telefon alan kodundan çıkan ülke (ipucu; kesin değil). */
  phoneCountry: string | null;
  whatsapp: string | null;
  notes: string | null;
  lang: string | null;
  targets: NormalizedTarget[];
  consent: boolean;
  /** Dikkat edilmesi gerekenler — satır atlanmasa da gösterilir. */
  issues: string[];
  /** true ise bu satır yazılmayacak. Nedeni issues'ta. */
  skip: boolean;
}

export interface ImportOptions {
  /**
   * Ülke kodsuz yerel numaralar ("0532…") için varsayılan alan kodu ("90").
   * Verilmezse yerel numara ülkesiz kalır — UYDURULMAZ.
   */
  defaultDialCode?: string;
  /** CSV ayırıcısı; verilmezse ölçülerek seçilir. */
  delimiter?: string;
}

const LANGS = new Set(['tr', 'en', 'nl', 'es', 'ar', 'de']);

/** Dil hücresini DTO'nun kabul ettiği koda indirger. Tanımazsa null. */
export function parseLang(raw: string | null | undefined): string | null {
  const v = norm(raw ?? '');
  if (!v) return null;
  if (LANGS.has(v)) return v;
  const map: Record<string, string> = {
    turkce: 'tr', turkish: 'tr', ingilizce: 'en', english: 'en',
    hollandaca: 'nl', dutch: 'nl', ispanyolca: 'es', spanish: 'es',
    arapca: 'ar', arabic: 'ar', almanca: 'de', german: 'de',
  };
  return map[v] ?? null;
}

/**
 * Yerel numaraya ülke kodu ekler. Zaten uluslararasıysa dokunmaz.
 * "0532 123 45 67" + "90" → "+905321234567"
 */
function applyDialCode(phone: string, dial: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+') || digits.startsWith('00')) return phone;
  const local = digits.replace(/^0+/, '');
  if (local.length < 6) return phone;
  return `+${dial.replace(/\D/g, '')}${local}`;
}

/**
 * Ayrıştırılmış CSV'yi taslaklara çevirir.
 *
 * Atlama kuralları (skip=true):
 * · Ne isim, ne e-posta, ne telefon → boş satır.
 * · Aynı dosyada e-posta veya telefonla daha önce geçmiş → dosya içi mükerrer.
 *
 * İsimsiz ama e-postalı satır ATLANMAZ: e-posta yerel kısmından ad türetilir
 * ve işaretlenir. Gerçek bir müşteriyi ismi yazılmamış diye kaybetmek,
 * düzeltilebilir bir isim taşımaktan kötüdür.
 */
export function buildDrafts(parsed: ParsedCsv, opts: ImportOptions = {}): {
  drafts: ContactDraft[];
  /** Hiçbir alana eşlenemeyen başlıklar — kullanıcı yazım hatasını görsün. */
  unmappedHeaders: string[];
  mapping: Array<{ header: string; field: Field | null }>;
} {
  const fields = mapHeader(parsed.header);
  const mapping = parsed.header.map((h, i) => ({ header: h, field: fields[i] }));
  // Bilerek yok sayılanlar "tanınmadı" uyarısı üretmez — gürültü olurdu.
  const unmappedHeaders = mapping
    .filter((m) => !m.field && m.header && !IGNORED.has(norm(m.header)))
    .map((m) => m.header);

  const get = (row: string[], f: Field): string => {
    const i = fields.indexOf(f);
    return i === -1 ? '' : (row[i] ?? '').trim();
  };

  const drafts: ContactDraft[] = [];
  const seenEmail = new Map<string, number>();
  const seenPhone = new Map<string, number>();

  parsed.rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const issues: string[] = [];

    const email = get(row, 'email').toLowerCase() || null;
    let phone = get(row, 'phone') || null;
    const whatsapp = get(row, 'whatsapp') || null;

    // Ad çözümü: ayrı ad/soyad varsa onlar; yoksa tam ad kolonu; o da
    // yoksa ad kolonunda boşluk varsa oradan bölünür.
    let firstName = get(row, 'firstName');
    let lastName = get(row, 'lastName') || null;
    const fullName = get(row, 'fullName');

    if (!firstName && fullName) {
      const s = splitName(fullName);
      firstName = s.firstName; lastName = lastName ?? s.lastName;
    } else if (firstName && !lastName && firstName.includes(' ')) {
      // Tek "Ad" kolonuna tam isim yazılmış — yaygın.
      const s = splitName(firstName);
      firstName = s.firstName; lastName = s.lastName;
    }

    if (!firstName && !email && !phone && !whatsapp) {
      drafts.push(emptyDraft(rowNumber, ['Boş satır — isim, e-posta ve telefon yok.']));
      return;
    }

    if (!firstName) {
      const local = (email ?? '').split('@')[0].replace(/[._-]+/g, ' ').trim();
      firstName = local || 'İsimsiz';
      issues.push(`İsim yok — "${firstName}" olarak türetildi, elle düzeltin.`);
    }

    // Telefon: yerel formatı varsayılan alan koduyla tamamla, sonra çöz.
    if (phone && opts.defaultDialCode) phone = applyDialCode(phone, opts.defaultDialCode);
    const pc = phone ? countryFromPhone(phone) : null;
    if (phone && !pc) issues.push(`Telefon ülkesi çözülemedi: "${phone}"`);

    const { targets, unresolved } = parseTargets(get(row, 'countries'), get(row, 'city'));
    if (unresolved.length > 0) {
      issues.push(`Ülke tanınmadı: ${unresolved.join(', ')} — kaydedilmeyecek.`);
    }

    // contacts'ta kolonu olmayan alanlar nota katlanır (veri kaybı olmasın).
    const extras: string[] = [];
    for (const [f, label] of [['company', 'Firma'], ['title', 'Unvan'],
      ['budget', 'Bütçe'], ['source', 'Kaynak']] as Array<[Field, string]>) {
      const v = get(row, f);
      if (v) extras.push(`${label}: ${v}`);
    }
    const baseNote = get(row, 'notes');
    const notes = [baseNote, extras.join(' · ')].filter(Boolean).join('\n') || null;

    const draft: ContactDraft = {
      rowNumber,
      firstName,
      lastName,
      email,
      phone: pc?.normalized ?? phone,
      phoneCountry: pc?.countryCode ?? null,
      whatsapp,
      notes,
      lang: parseLang(get(row, 'lang')),
      targets,
      consent: parseConsent(get(row, 'consent')),
      issues,
      skip: false,
    };

    // Dosya içi mükerrer — sisteme karşı kontrol repository'de ayrıca yapılır.
    const phoneKey = (draft.phone ?? '').replace(/\D/g, '');
    const firstAt = (email ? seenEmail.get(email) : undefined)
      ?? (phoneKey ? seenPhone.get(phoneKey) : undefined);
    if (firstAt !== undefined) {
      draft.skip = true;
      draft.issues.push(`Aynı dosyada mükerrer — ${firstAt}. satırla eşleşti.`);
    } else {
      if (email) seenEmail.set(email, rowNumber);
      if (phoneKey) seenPhone.set(phoneKey, rowNumber);
    }

    drafts.push(draft);
  });

  return { drafts, unmappedHeaders, mapping };
}

function emptyDraft(rowNumber: number, issues: string[]): ContactDraft {
  return {
    rowNumber, firstName: '', lastName: null, email: null, phone: null,
    phoneCountry: null, whatsapp: null, notes: null, lang: null,
    targets: [], consent: false, issues, skip: true,
  };
}

/** Metinden doğrudan taslak üretir (controller'ın kullandığı giriş noktası). */
export function draftsFromCsv(text: string, opts: ImportOptions = {}): {
  parsed: ParsedCsv;
  drafts: ContactDraft[];
  unmappedHeaders: string[];
  mapping: Array<{ header: string; field: Field | null }>;
} {
  const parsed = parseCsv(text, opts.delimiter);
  return { parsed, ...buildDrafts(parsed, opts) };
}
