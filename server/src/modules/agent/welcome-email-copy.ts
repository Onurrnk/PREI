// =====================================================================
// PREI | Hoş geldiniz e-postası metinleri — web sitesinden gelen yeni
// yatırımcıya (iletişim formu / ROI Calculator) gönderilen İLK temas.
// Metin KURUCU KİMLİĞİYLE yazılmıştır (Onur'un onayladığı nihai sürüm,
// 2026-07-17) — imza bloğu Gmail gönderen profilinden gelir
// (Onur Nazım Karataş · Founder & Independent Investment Advisor).
// Ses: .claude/brand-voice-guidelines.md. Her zaman isimle hitap edilir.
// Sonraki temaslar Eylül/danışman akışında kullanıcı onayıyla ilerler.
// =====================================================================

export type WelcomeLang = 'tr' | 'en';
export type WelcomeSource = 'contact' | 'roi_report';

export interface WelcomeEmailCopy {
  subject: string;
  greeting: string;
  paragraphs: string[];
  /** CTA butonunun altında devam eden kapanış paragrafları. */
  paragraphsAfterCta: string[];
  ctaLabel: string;
  ctaUrl: string;
}

// Playbook'un tekil randevu kanalı — kişi zamanı kendi seçer, plana biz uyarız.
const CALENDLY_URL = 'https://calendly.com/produality-info/30min';

export function buildWelcomeCopy(
  lang: WelcomeLang,
  recipientName: string,
  source: WelcomeSource,
): WelcomeEmailCopy {
  if (lang === 'en') {
    const paragraphs = [
      'The message you sent today may well be one of the most important steps in your international investment journey.',
      'Because the right investment does not begin with finding the right property alone; it begins with the right information, the right strategy, and the right people you can trust.',
      'Welcome to ProDuality.',
      'We are not an estate agency. We are an independent international real-estate investment advisory. We do not sell property; we help our investors make the right decision. Our side of the table is always clear: yours.',
      'That is why we assess every recommendation against current market data, financial analysis and long-term investment criteria. If an opportunity is strong, we explain exactly why; if it carries risk, we share that with the same transparency. And if we believe an investment is not right for you, we will not hesitate to tell you.',
    ];
    if (source === 'roi_report') {
      paragraphs.push(
        'Your requested ROI report has been sent to your inbox separately. When we meet, we can walk through those numbers together.',
      );
    }
    paragraphs.push(
      'The next step is simple.',
      'We would like to get to know you. We will plan a short introductory call to understand your goals, your expectations and your investment vision — so that we only consider the opportunities that are genuinely right for you.',
      'You can choose a convenient time through the link below, or simply reply to this email. Your message will reach me and my team directly.',
    );
    return {
      subject: 'Welcome to ProDuality',
      greeting: `Dear ${recipientName},`,
      paragraphs,
      paragraphsAfterCta: [
        'When I founded ProDuality, my aim was to build a place where investors could experience advisory based on trust and transparency, free of any pressure. I hope we can give you that same confidence throughout this journey.',
        'I look forward to meeting you soon.',
        'Sincerely,',
      ],
      ctaLabel: 'Choose a Time That Suits You',
      ctaUrl: CALENDLY_URL,
    };
  }

  const paragraphs = [
    'Bugün attığınız bu mesaj, belki de uluslararası yatırım yolculuğunuzdaki en önemli adımlardan biri olabilir.',
    'Çünkü doğru yatırım, yalnızca doğru mülkü bulmakla değil; doğru bilgiye, doğru stratejiye ve güvenebileceğiniz doğru insanlara sahip olmakla başlar.',
    "ProDuality'ye hoş geldiniz.",
    'Biz bir emlak ajansı değiliz. Bağımsız bir uluslararası gayrimenkul yatırım danışmanlığı şirketiyiz. Mülk satmayız; yatırımcılarımızın doğru kararı vermesine yardımcı oluruz. Masada tarafımız her zaman bellidir: Sizin tarafınız.',
    'Bu nedenle her önerimizi güncel pazar verileri, finansal analizler ve uzun vadeli yatırım kriterleri doğrultusunda değerlendiririz. Bir fırsat güçlü görünüyorsa nedenini açıkça anlatırız; risk taşıyorsa bunu da aynı şeffaflıkla paylaşırız. Eğer bir yatırımın sizin için doğru olmadığını düşünüyorsak, bunu size söylemekten çekinmeyiz.',
  ];
  if (source === 'roi_report') {
    paragraphs.push(
      'Talep ettiğiniz ROI raporu kutunuza ayrıca iletildi. Görüşmemizde bu rakamların üzerinden birlikte geçebiliriz.',
    );
  }
  paragraphs.push(
    'Önümüzdeki adım oldukça basit.',
    'Sizi tanımak istiyoruz. Hedeflerinizi, beklentilerinizi ve yatırım vizyonunuzu anlamak için kısa bir tanışma görüşmesi planlayacağız. Böylece size yalnızca gerçekten uygun fırsatları değerlendirebiliriz.',
    'Aşağıdaki bağlantıdan size uygun bir görüşme zamanı seçebilir veya bu e-postayı doğrudan yanıtlayabilirsiniz. Mesajınız bana ve ekibime doğrudan ulaşacaktır.',
  );
  return {
    subject: "ProDuality'ye Hoş Geldiniz",
    greeting: `Sayın ${recipientName},`,
    paragraphs,
    paragraphsAfterCta: [
      "ProDuality'yi kurarken amacım, yatırımcıların kendilerini baskı altında hissetmeden, güvene dayalı ve şeffaf bir danışmanlık deneyimi yaşayabilecekleri bir yapı oluşturmaktı. Umarım bu yolculuk boyunca size de aynı güveni hissettirebiliriz.",
      'En yakın zamanda tanışmak dileğiyle.',
      'Saygılarımla,',
    ],
    ctaLabel: 'Size Uygun Zamanı Seçin',
    ctaUrl: CALENDLY_URL,
  };
}
