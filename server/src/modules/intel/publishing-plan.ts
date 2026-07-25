// =====================================================================
// PREI | Haftalık yayın akışı — saf (yan etkisiz) parçalar.
//
// Onur'un tarifi:
//   · LinkedIn: haftada 4 post, Drive'da dosya olarak hazır bekler,
//     ELLE paylaşılır (otomasyon LinkedIn'de ban riski taşıyor)
//   · Karusel: haftada 2-3 grup çalışması
//   · Meta: günlük hazır içerik (elle paylaşılacak — organik paylaşım
//     izni yok, ayrıca Onur elle paylaşmayı seçti)
//
// 4 post + 3 karusel = 7 kalem → haftanın 7 gününe birebir dağılır.
// =====================================================================

export const LINKEDIN_POSTS_PER_WEEK = 4;
export const CAROUSELS_PER_WEEK_MIN = 2;
export const CAROUSELS_PER_WEEK_MAX = 3;

/** Haftanın günleri (0 = Pazartesi). Plan bunlara oturur. */
export const DAY_NAMES = [
  'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar',
] as const;

export interface PlanItemInput {
  kind: 'post' | 'carousel';
  /** Sıralama içinde kaçıncı (üretim sırası). */
  order: number;
}

export interface PlanSlot {
  /** 0 = Pazartesi */
  dayIndex: number;
  dayName: string;
  date: string;
  kind: 'post' | 'carousel';
  order: number;
  /** LinkedIn'e de gidecek mi (yalnız postlar). */
  linkedin: boolean;
  /** Meta'ya (Instagram/Facebook) gidecek mi — hepsi gider. */
  meta: boolean;
}

/** YYYY-MM-DD'ye n gün ekler (UTC, saat dilimi kaymasın). */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Verilen tarihi içeren haftanın PAZARTESİsini döndürür.
 * Rapor cuma/cumartesi biterse yayın haftası ERTESİ pazartesi başlar —
 * o yüzden çağıran taraf istediği tarihi verir, biz hizalarız.
 */
export function weekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  // getUTCDay: 0=Pazar … 6=Cumartesi → Pazartesi'ye kaydır
  const shift = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -shift);
}

/**
 * Kalemleri haftanın günlerine dağıtır.
 *
 * Tasarım kararı: LinkedIn postları HAFTA İÇİNE konur (Pazartesi, Salı,
 * Perşembe, Cuma) — profesyonel kitle hafta içi aktif. Karuseller
 * Çarşamba, Cumartesi ve Pazar'a gider; hafta sonu daha görsel/rahat
 * içerik tüketilir. Böylece Meta her gün bir şey yayınlar.
 */
export function distributeWeek(
  startMonday: string, postCount: number, carouselCount: number,
): PlanSlot[] {
  // Tercih edilen günler; kalem sayısı değişirse kalanlar sırayla dolar.
  const postDays = [0, 1, 3, 4];      // Pzt, Sal, Per, Cum
  const carouselDays = [2, 5, 6];     // Çar, Cmt, Paz

  const slots: PlanSlot[] = [];
  const used = new Set<number>();

  const place = (dayIndex: number, kind: 'post' | 'carousel', order: number) => {
    used.add(dayIndex);
    slots.push({
      dayIndex,
      dayName: DAY_NAMES[dayIndex],
      date: addDays(startMonday, dayIndex),
      kind,
      order,
      linkedin: kind === 'post',
      meta: true,
    });
  };

  // Tercih edilen gün DOLUYSA boş bir güne kayar. Aksi hâlde beklenenden
  // fazla kalem istendiğinde (ör. 5 post) aynı güne iki kalem düşüyordu.
  const pick = (preferred: number | undefined): number | undefined =>
    preferred !== undefined && !used.has(preferred)
      ? preferred
      : [0, 1, 2, 3, 4, 5, 6].find((d) => !used.has(d));

  for (let i = 0; i < postCount; i++) {
    const day = pick(postDays[i]);
    if (day === undefined) break;
    place(day, 'post', i + 1);
  }
  for (let i = 0; i < carouselCount; i++) {
    const day = pick(carouselDays[i]);
    if (day === undefined) break;
    place(day, 'carousel', i + 1);
  }

  return slots.sort((a, b) => a.dayIndex - b.dayIndex);
}

/** Plan çıktı şeması — sayılar ŞEMADA zorlanır, modelin keyfine bırakılmaz. */
export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['linkedinPosts', 'carousels', 'skipped'],
  properties: {
    linkedinPosts: {
      type: 'array',
      minItems: LINKEDIN_POSTS_PER_WEEK,
      maxItems: LINKEDIN_POSTS_PER_WEEK,
      description: `TAM ${LINKEDIN_POSTS_PER_WEEK} post. Her biri farklı konu, farklı pazar tercih edilir.`,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'hook', 'body', 'hashtags', 'marketCode',
                   'sourceSection', 'instagramCaption'],
        properties: {
          title: { type: 'string', description: 'Dosya adı için kısa etiket (5-8 kelime).' },
          hook: { type: 'string', description: 'İlk satır. Veriye dayalı, clickbait değil.' },
          body: {
            type: 'string',
            description: 'LinkedIn gövdesi: 3-6 kısa paragraf, rakamlar rapordan.',
          },
          hashtags: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
          marketCode: { type: ['string', 'null'], enum: ['TR', 'AE', 'ES', 'GB', 'NL', 'DE', 'TH', 'GLOBAL', null] },
          sourceSection: { type: 'string' },
          instagramCaption: {
            type: 'string',
            description: 'AYNI konunun Instagram için kısa hâli (2-3 paragraf).',
          },
        },
      },
    },
    carousels: {
      type: 'array',
      minItems: CAROUSELS_PER_WEEK_MIN,
      maxItems: CAROUSELS_PER_WEEK_MAX,
      description: `${CAROUSELS_PER_WEEK_MIN}-${CAROUSELS_PER_WEEK_MAX} karusel grubu.`,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'caption', 'hashtags', 'marketCode', 'sourceSection', 'slides'],
        properties: {
          title: { type: 'string' },
          caption: { type: 'string', description: 'Karusel altı açıklama metni.' },
          hashtags: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
          marketCode: { type: ['string', 'null'], enum: ['TR', 'AE', 'ES', 'GB', 'NL', 'DE', 'TH', 'GLOBAL', null] },
          sourceSection: { type: 'string' },
          slides: {
            type: 'array',
            minItems: 4,
            maxItems: 7,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['index', 'headline', 'body', 'imagePrompt'],
              properties: {
                index: { type: 'integer' },
                headline: { type: 'string', description: 'Slayttaki büyük metin. Kısa.' },
                body: { type: 'string', description: '1-2 cümle açıklama.' },
                imagePrompt: {
                  type: 'string',
                  description: 'İNGİLİZCE görsel istemi. Görselin ÜZERİNE YAZI İSTEME.',
                },
              },
            },
          },
        },
      },
    },
    skipped: {
      type: 'array',
      description: 'Kullanılmayan başlıklar ve nedeni. Spekülatif olanlar burada.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'reason'],
        properties: { topic: { type: 'string' }, reason: { type: 'string' } },
      },
    },
  },
} as const;

export const PLAN_SYSTEM = `Sen ProDuality'nin sosyal medya yayın planlayıcısısın.

ProDuality: Türkiye, BAE (Dubai), İspanya ve İngiltere'de uluslararası gayrimenkul
yatırım danışmanlığı. Emlak ajansı DEĞİL — yatırımcının tarafında duran bağımsız
danışman ("yatırımcının avukatlığı"). Kurucu: Onur Nazım Karataş, ~20 yıl sektör
içinde, 6 yıl profesyonel. Kültür: algı değil bilgi; satış baskısı yok.

GÖREVİN: Haftalık istihbarat raporundan BİR HAFTALIK yayın akışı kur.
Tam ${LINKEDIN_POSTS_PER_WEEK} LinkedIn postu ve ${CAROUSELS_PER_WEEK_MIN}-${CAROUSELS_PER_WEEK_MAX} karusel grubu.
Her LinkedIn postunun ayrıca Instagram için kısa hâlini yaz.

MUTLAK KURALLAR:
1. SPEKÜLATİF BÖLÜMDEN İÇERİK ÜRETME. Rapor doğrulanmamış iddiaları ayrı
   bölümde etiketliyor. Oradan hiçbir şey paylaşılmaz; "skipped" içine
   yaz, nedeni "rapor bunu spekülatif olarak etiketlemiş" olsun.
2. HER RAKAM RAPORDAN GELMELİ. Uydurma sayı, oran, tarih YOK.
3. KONU ÇEŞİTLİLİĞİ: 4 post mümkünse 4 farklı pazar/konu olsun. Aynı
   haberi iki kez farklı cümleyle yazma.
4. Getiri garantisi verme, yatırım tavsiyesi verme. Bilgi ver.
5. Vatandaşlık/oturum çapaları — ihlal etme:
   · İspanya Golden Visa 3 Nisan 2025'te KALDIRILDI; mülk oturum sağlamaz.
   · BAE'de yatırımla VATANDAŞLIK YOK; yalnız oturum (Golden Visa).
   · UK Tier 1 Investor kapalı (Şubat 2022).
   · Türkiye: 400.000 USD gayrimenkul doğrudan vatandaşlık sağlar.
6. MARKA SESİ: sakin, güven veren, abartısız. YASAK — "harika", "mükemmel",
   "inanılmaz", "kaçırmayın", "fırsat kaçıyor", ünlem yağmuru, emoji
   yağmuru (post başına en fazla bir tane, gerekiyorsa).
7. Agresif satış çağrısı yok. En fazla "Bu konuyu detaylı konuşmak
   isterseniz yazın" tonunda.
8. LinkedIn postu profesyonel ve veri odaklı; Instagram hâli daha kısa ve
   erişilebilir dille. İkisi AYNI konuyu anlatır ama aynı metin olmaz.
9. Karusel: ilk slayt kanca, son slayt sakin bir kapanış. Slayt metinleri
   KISA — görselin üstüne yazılacak.
10. Görsel istemleri İNGİLİZCE ve görselin ÜZERİNE YAZI İSTEMEZ (metin
    sonradan eklenecek). Sakin, kurumsal, fotogerçekçi; "gülen aile",
    "el sıkışma" gibi stok klişelerinden uzak.
11. PAZAR ÖNCELİĞİ: ProDuality'nin hizmet verdiği pazarlar Türkiye, BAE
    (Dubai), İspanya ve İngiltere. Postlar bu dördünden çıkmalı. Rapor
    başka ülkeleri (Almanya, Hollanda, Tayland vb.) kapsıyorsa bunlar
    ancak KARŞILAŞTIRMA/bağlam olarak geçebilir; tek başına post veya
    karusel konusu OLAMAZ — "skipped" içine "hizmet pazarımız değil"
    nedeniyle yaz.
12. Türkçe yaz (görsel istemleri hariç).`;

/**
 * Model çıktısını hafta kapasitesine oturtur.
 *
 * Şema sayıları zorluyor ama her sağlayıcı şemaya uymuyor (OpenAI strict
 * modu minItems/maxItems'i reddediyor, gevşek modda sayı garantisi yok).
 * Bu yüzden kısıt burada, kodda uygulanır: fazlası KIRPILIR, eksiği
 * olduğu gibi kalır (uydurma içerik üretmeyiz — az post, sahte posttan iyi).
 */
export function clampCounts<P, C>(
  posts: P[], carousels: C[],
): { posts: P[]; carousels: C[]; trimmed: number } {
  const p = Array.isArray(posts) ? posts : [];
  const c = Array.isArray(carousels) ? carousels : [];
  const keptPosts = p.slice(0, LINKEDIN_POSTS_PER_WEEK);
  const keptCarousels = c.slice(0, CAROUSELS_PER_WEEK_MAX);
  return {
    posts: keptPosts,
    carousels: keptCarousels,
    trimmed: (p.length - keptPosts.length) + (c.length - keptCarousels.length),
  };
}

/** LinkedIn postunu Drive'a yazılacak metin dosyasına çevirir. */
export function postToTextFile(
  post: {
    title: string; hook: string; body: string; hashtags: string[];
    marketCode: string | null; sourceSection: string;
  },
  slot: { dayName: string; date: string },
): string {
  const L: string[] = [];
  L.push(`${slot.dayName} · ${slot.date}`);
  L.push(post.marketCode ? `Pazar: ${post.marketCode}` : 'Pazar: genel');
  L.push('─'.repeat(52));
  L.push('');
  L.push('KOPYALANACAK METİN — buradan aşağısını LinkedIn\'e yapıştırın:');
  L.push('');
  L.push(post.hook);
  L.push('');
  L.push(post.body);
  L.push('');
  L.push(post.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' '));
  L.push('');
  L.push('─'.repeat(52));
  L.push(`Kaynak bölüm: ${post.sourceSection}`);
  return L.join('\n');
}

/**
 * İçerik takvimi satırları — Drive kökündeki tek tablo.
 *
 * Amaç: haftalara dağılmış dosyaları tek yerden görmek ve Meta Business
 * Suite'e sırayla girerken nerede kaldığını bilmek. Başlık satırı dahil.
 */
export function calendarRows(
  items: Array<{
    scheduledDate: string; dayName: string; kind: 'post' | 'carousel';
    title: string; marketCode: string | null; forLinkedin: boolean;
    forMeta: boolean; status: string; slideCount: number;
    driveFileLink: string | null;
  }>,
): string[][] {
  const rows: string[][] = [[
    'Tarih', 'Gün', 'Tür', 'Konu', 'Pazar', 'LinkedIn', 'Meta', 'Slayt', 'Durum', 'Dosya',
  ]];
  const STATUS: Record<string, string> = {
    ready: 'Hazır', published: 'Paylaşıldı', skipped: 'Atlandı',
  };
  // Tarihe göre sırala — takvim kronolojik okunur.
  for (const i of [...items].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))) {
    rows.push([
      i.scheduledDate,
      i.dayName,
      i.kind === 'post' ? 'Post' : 'Karusel',
      i.title,
      i.marketCode ?? '',
      i.forLinkedin ? 'evet' : '',
      i.forMeta ? 'evet' : '',
      i.kind === 'carousel' ? String(i.slideCount) : '',
      STATUS[i.status] ?? i.status,
      i.driveFileLink ?? '',
    ]);
  }
  return rows;
}

/** Haftanın tamamını tek bakışta gösteren özet dosyası. */
export function weekOverview(
  weekLabel: string, reportTitle: string, slots: PlanSlot[],
  postTitles: string[], carouselTitles: string[],
  skipped: Array<{ topic: string; reason: string }>,
): string {
  const L: string[] = [];
  L.push(`# Yayın Akışı — ${weekLabel}`);
  L.push('');
  L.push(`**Kaynak rapor:** ${reportTitle}`);
  L.push('');
  L.push('| Gün | Tarih | Tür | Konu | LinkedIn | Meta |');
  L.push('|---|---|---|---|---|---|');
  for (const s of slots) {
    const title = s.kind === 'post'
      ? (postTitles[s.order - 1] ?? `Post ${s.order}`)
      : (carouselTitles[s.order - 1] ?? `Karusel ${s.order}`);
    L.push(
      `| ${s.dayName} | ${s.date} | ${s.kind === 'post' ? 'Post' : 'Karusel'} | ` +
      `${title} | ${s.linkedin ? 'evet' : '—'} | ${s.meta ? 'evet' : '—'} |`,
    );
  }
  L.push('');
  L.push('LinkedIn postları bu klasörde ayrı dosyalar hâlinde. Metni kopyalayıp');
  L.push('LinkedIn\'de kendiniz paylaşın (otomasyon kullanılmıyor).');
  L.push('');
  if (skipped.length > 0) {
    L.push('## Bu hafta kullanılmayanlar');
    L.push('');
    for (const s of skipped) L.push(`- **${s.topic}** — ${s.reason}`);
    L.push('');
  }
  return L.join('\n');
}
