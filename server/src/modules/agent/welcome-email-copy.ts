// =====================================================================
// PREI | Hoş geldiniz e-postası metinleri — web sitesinden gelen yeni
// yatırımcıya (iletişim formu / ROI Calculator) gönderilen İLK temas.
// Ses: .claude/brand-voice-guidelines.md (2026-07-17 marka keşfi) —
// "satıcı değil danışman", sakin kesinlik, risk dürüstlüğü, kısa
// paragraflar, baskısız Calendly daveti. Her zaman isimle hitap.
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

// Playbook'un tekil randevu kanalı — kişi zamanı kendi seçer, plana biz uyarız.
const CALENDLY_URL = 'https://calendly.com/produality-info/30min';

export function buildWelcomeCopy(
  lang: WelcomeLang,
  recipientName: string,
  source: WelcomeSource,
): WelcomeEmailCopy {
  if (lang === 'en') {
    const paragraphs = [
      'Welcome to ProDuality — and thank you for reaching out. From today, you have an advisor following your international investment decision on your behalf.',
      "We are not an estate agency. We are an independent investment advisory: we don't sell property, we help you get the decision right. Our side of the table is always yours.",
      "You will notice this in practice. Every recommendation we make rests on real market data, and we are honest about risk — if an investment is not right for you, you will hear it from us first.",
    ];
    if (source === 'roi_report') {
      paragraphs.push(
        'Your ROI report has been sent to your inbox separately. When we speak, we can walk through the numbers together.',
      );
    }
    paragraphs.push(
      'The first step is a short introductory call, so we can listen to your goals. Choose whichever time suits you below — we will keep to it. You can also simply reply to this email; it reaches us directly.',
    );
    return {
      subject: 'Welcome to ProDuality',
      greeting: `Dear ${recipientName},`,
      paragraphs,
      ctaLabel: 'Choose a Time That Suits You',
      ctaUrl: CALENDLY_URL,
    };
  }

  const paragraphs = [
    "ProDuality'ye hoş geldiniz — bize ulaştığınız için teşekkür ederiz. Bugünden itibaren, uluslararası yatırım kararınızı sizin adınıza takip eden bir danışmanınız var.",
    'Biz bir emlak ajansı değiliz. Bağımsız bir yatırım danışmanlığıyız: mülk satmayız, doğru kararı vermeniz için çalışırız. Masada tarafımız her zaman bellidir — sizin tarafınız.',
    'Bunu ilk günden hissedeceksiniz. Her önerimiz gerçek pazar verisine dayanır ve riski de dürüstçe söyleriz — bir yatırım size uygun değilse, bunu ilk bizden duyarsınız.',
  ];
  if (source === 'roi_report') {
    paragraphs.push(
      'Talep ettiğiniz ROI raporu kutunuza ayrıca iletildi. Görüştüğümüzde rakamların üzerinden birlikte geçebiliriz.',
    );
  }
  paragraphs.push(
    'İlk adım, hedeflerinizi dinleyeceğimiz kısa bir tanışma görüşmesi. Aşağıdan size uygun zamanı seçmeniz yeterli — biz o plana sadık kalırız. Dilerseniz bu e-postayı doğrudan yanıtlayabilirsiniz; mesajınız bize ulaşır.',
  );
  return {
    subject: "ProDuality'ye Hoş Geldiniz",
    greeting: `Merhaba ${recipientName},`,
    paragraphs,
    ctaLabel: 'Size Uygun Zamanı Seçin',
    ctaUrl: CALENDLY_URL,
  };
}
