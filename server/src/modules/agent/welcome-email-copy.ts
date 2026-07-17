// =====================================================================
// PREI | Hoş geldiniz e-postası metinleri — web sitesinden gelen yeni
// yatırımcıya (iletişim formu / ROI Calculator) gönderilen İLK temas.
// Marka + değer önerisi; her zaman isimle hitap edilir (greeting).
// Sonraki temaslar Eylül/danışman akışında kullanıcı onayıyla ilerler.
// =====================================================================

export type WelcomeLang = 'tr' | 'en';
export type WelcomeSource = 'contact' | 'roi_report';

export interface WelcomeEmailCopy {
  subject: string;
  greeting: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
}

const CTA_URL = 'https://produality.com';

export function buildWelcomeCopy(
  lang: WelcomeLang,
  recipientName: string,
  source: WelcomeSource,
): WelcomeEmailCopy {
  if (lang === 'en') {
    const paragraphs = [
      'Welcome to ProDuality Property & Investment — and thank you for reaching out. From this point on, you have a dedicated team following international property markets on your behalf.',
      'ProDuality is an investment advisory house active across Dubai, Istanbul, the Turkish Riviera, Spain and the United Kingdom. We work for the investor, not the developer: every recommendation we make is grounded in current market data, realistic rental yields and verified project fundamentals.',
      'What you can expect from us: curated opportunities matched to your goals rather than listings, transparent return projections before any commitment, and end-to-end execution — from payment plan negotiation to title deed, and on to rental management. Where residency or Golden Visa eligibility matters, we structure the investment accordingly and manage the process for you.',
    ];
    if (source === 'roi_report') {
      paragraphs.push(
        'Your requested ROI report has been sent to your inbox separately. When we speak, we would be glad to walk through its assumptions with you and tailor the scenario to your situation.',
      );
    }
    paragraphs.push(
      'One of our consultants will contact you shortly to understand your objectives and prepare a personal assessment. You can also simply reply to this email — it reaches us directly.',
    );
    return {
      subject: 'Welcome to ProDuality — Your Investment Journey Begins',
      greeting: `Dear ${recipientName},`,
      paragraphs,
      ctaLabel: 'Explore Current Opportunities',
      ctaUrl: CTA_URL,
    };
  }

  const paragraphs = [
    "ProDuality Property & Investment'a hoş geldiniz — bize ulaştığınız için teşekkür ederiz. Bu andan itibaren uluslararası gayrimenkul piyasalarını sizin adınıza takip eden bir ekibiniz var.",
    "ProDuality; Dubai, İstanbul, Türk Rivierası, İspanya ve İngiltere pazarlarında faaliyet gösteren bir yatırım danışmanlık evidir. Geliştirici için değil, yatırımcı için çalışırız: her önerimiz güncel pazar verisine, gerçekçi kira getirilerine ve doğrulanmış proje temellerine dayanır.",
    'Bizden bekleyebilecekleriniz: ilan listeleri değil, hedeflerinize göre seçilmiş fırsatlar; herhangi bir taahhütten önce şeffaf getiri projeksiyonları; ödeme planı müzakeresinden tapuya ve kiralama yönetimine kadar uçtan uca süreç yürütme. Oturum izni veya Golden Visa hedefi olan yatırımlarda ise yapıyı buna göre kurar, süreci sizin adınıza yönetiriz.',
  ];
  if (source === 'roi_report') {
    paragraphs.push(
      'Talep ettiğiniz ROI raporu e-posta kutunuza ayrıca iletildi. Görüştüğümüzde rapordaki varsayımların üzerinden birlikte geçmekten ve senaryoyu durumunuza göre özelleştirmekten memnuniyet duyarız.',
    );
  }
  paragraphs.push(
    'Danışmanlarımızdan biri, hedeflerinizi dinlemek ve size özel bir değerlendirme hazırlamak için kısa süre içinde sizinle iletişime geçecek. Dilerseniz bu e-postayı doğrudan yanıtlayarak da bize ulaşabilirsiniz.',
  );
  return {
    subject: "ProDuality'ye Hoş Geldiniz — Yatırım Yolculuğunuz Başlıyor",
    greeting: `Sayın ${recipientName},`,
    paragraphs,
    ctaLabel: 'Güncel Fırsatları İnceleyin',
    ctaUrl: CTA_URL,
  };
}
