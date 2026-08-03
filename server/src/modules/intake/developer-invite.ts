// =====================================================================
// PREI | Geliştirici daveti — saf mantık (DB'siz, test edilebilir).
//
// info@'ya bir proje teklifi maili düştüğünde sistem kendiliğinden:
//   1) gönderen kişiyi + firmayı kaydeder (yetkili firma),
//   2) self-servis proje formu için davet linki üretir,
//   3) markalı bir mailde bu linki gönderir.
//
// Amaç: Onur hiçbir şey yapmasın. Geliştirici formu kendisi doldursun —
// daire tipleri, layout'lar, iç/dış görseller, broşür. Elle veri girişi
// PREI'nin en pahalı adımıydı; onu kaynağa devrediyoruz.
// =====================================================================

/** `"Ad Soyad" <mail@x>` / `Ad Soyad <mail@x>` / `mail@x` → ad + adres. */
export function parseSender(raw: string | null | undefined): { name: string | null; email: string | null } {
  const s = (raw ?? '').trim();
  if (!s) return { name: null, email: null };

  const angled = /^(.*?)<\s*([^>\s]+@[^>\s]+)\s*>$/.exec(s);
  if (angled) {
    const name = angled[1].trim().replace(/^["']|["']$/g, '').trim();
    return { name: name || null, email: angled[2].toLowerCase() };
  }
  // Düz adres
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { name: null, email: s.toLowerCase() };
  return { name: null, email: null };
}

/**
 * Firma adı zinciri: modelin çıkardığı ad → kişi adı → e-posta alan adı.
 * Hiçbiri yoksa null (firma kaydı açılmaz, davet de gönderilmez).
 */
export function firmName(
  developerName: string | null | undefined,
  sender: { name: string | null; email: string | null },
): string | null {
  const dev = (developerName ?? '').trim();
  if (dev) return dev;
  if (sender.name) return sender.name;
  const domain = sender.email?.split('@')[1] ?? '';
  // Serbest posta sağlayıcısından firma adı üretmek yanlış olur.
  const FREE = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'yandex.com']);
  if (!domain || FREE.has(domain)) return null;
  const base = domain.split('.')[0];
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : null;
}

/** Mailin dili — Türkçe karakter veya sık geçen TR kelimeleri. */
export function detectLang(...texts: Array<string | null | undefined>): 'tr' | 'en' {
  const t = texts.filter(Boolean).join(' ').toLowerCase();
  if (/[çğıöşü]/.test(t)) return 'tr';
  if (/\b(proje|daire|fiyat|merhaba|komisyon|teslim|konut|yatırım)\b/.test(t)) return 'tr';
  return 'en';
}

export interface InviteCopy {
  subject: string;
  greeting: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  paragraphsAfterCta: string[];
}

export interface InviteCopyInput {
  contactName: string | null;
  firm: string | null;
  projectTitle: string;
  url: string;
}

/**
 * Davet maili metni. İki dil, tek kaynak.
 *
 * Metnin özü bilinçli: neden eksiksiz doldurulması gerektiğini AÇIKÇA
 * söyler — sistem yapay zekâ ile çalıştığı için eksik alan, projenin
 * yatırımcı eşleştirmesine hiç girmemesi demek. Bu, "form doldurun"
 * ricasını karşı taraf için bir menfaate çevirir.
 */
export function buildInviteCopy(lang: 'tr' | 'en', input: InviteCopyInput): InviteCopy {
  const who = input.contactName?.trim() || null;
  const proje = input.projectTitle.trim();

  if (lang === 'en') {
    return {
      subject: `${proje} — project details form`,
      greeting: who ? `Dear ${who},` : 'Hello,',
      paragraphs: [
        `Thank you for introducing ${proje}. Congratulations on the new launch.`,
        'To present the project to our investors, we need the full details. We have prepared a form for you: unit types and layouts, interior and exterior visuals, amenities, payment plan and your brochure can all be entered in one place.',
        'One point worth explaining: our system runs entirely on AI automation. Projects are matched to investors by their stated budget, location and property preferences — automatically, and continuously. Every field you leave empty is a criterion the project cannot be matched on. A project with complete details reaches the right investor within minutes of a new enquiry; an incomplete one waits.',
      ],
      ctaLabel: 'Fill In Project Details',
      ctaUrl: input.url,
      paragraphsAfterCta: [
        'The link is personal to you and does not require a password. You can save and return to it later.',
        'If anything is unclear, simply reply to this email.',
      ],
    };
  }

  return {
    subject: `${proje} — proje bilgi formu`,
    greeting: who ? `Sayın ${who},` : 'Merhaba,',
    paragraphs: [
      `${proje} projesini bizimle paylaştığınız için teşekkür ederiz. Yeni projeniz hayırlı olsun.`,
      'Projeyi yatırımcılarımıza sunabilmemiz için detayların tamamına ihtiyacımız var. Bunun için size özel bir form hazırladık: daire tipleri ve kat planları, iç ve dış mekân görselleri, sosyal olanaklar, ödeme planı ve sunum dosyanız tek bir yerden girilebiliyor.',
      'Şunu açıkça belirtmek isteriz: sistemimiz baştan sona yapay zekâ otomasyonuyla çalışıyor. Projeler, yatırımcılarımızın bütçe, lokasyon ve mülk tercihlerine göre otomatik ve sürekli olarak eşleştiriliyor. Boş bıraktığınız her alan, projenin o kriterde hiç eşleşememesi anlamına geliyor. Bilgileri eksiksiz girilmiş bir proje, yeni bir yatırımcı talebi geldiğinde dakikalar içinde doğru kişiye ulaşıyor; eksik olan ise sırada bekliyor.',
    ],
    ctaLabel: 'Proje Bilgilerini Doldur',
    ctaUrl: input.url,
    paragraphsAfterCta: [
      'Link size özeldir ve şifre gerektirmez. Kaydedip daha sonra kaldığınız yerden devam edebilirsiniz.',
      'Takıldığınız bir yer olursa bu maili yanıtlamanız yeterli.',
    ],
  };
}

/** Self-servis form adresi. Token URL-güvenli üretiliyor (base64url). */
export const inviteUrl = (base: string, token: string): string =>
  `${base.replace(/\/+$/, '')}/submit/${token}`;
