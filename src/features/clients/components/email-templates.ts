// =====================================================================
// PREI | Hazır e-posta şablonları — TR ve EN ayrı setler.
//
// Neden i18n'de değil: şablonun dili ARAYÜZ dilinden bağımsızdır.
// Danışman Türk müşteriye TR, BAE/UK müşterisine EN yazar; arayüz hangi
// dilde olursa olsun iki set de her zaman elinin altındadır.
//
// Ses tonu (produality_tone_voice.md): insan odaklı profesyonellik —
// kısa ve net, aktif cümleler, empatik, şeffaf, eylem odaklı ama baskısız.
// "Biz verilerle konuşuruz ama insan gibi hissederiz."
//
// Yer tutucu: {client} → alıcının adı (uygulanırken değiştirilir).
// Gövde paragrafları \n\n ile ayrılır; kompozör <p>'ye çevirir.
// =====================================================================

export interface EmailTemplate {
  id: string;
  lang: 'tr' | 'en';
  /** Seçicide görünen kısa ad. */
  name: string;
  /** Ne zaman kullanılır — seçicinin altında ipucu olarak görünür. */
  description: string;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ─────────────────────────── TÜRKÇE ───────────────────────────
  {
    id: 'tr-tanisma',
    lang: 'tr',
    name: 'Tanışma / İlk Temas',
    description: 'Yeni gelen talebe ilk yanıt — güven kurar, sonraki adımı netleştirir.',
    subject: 'Yatırım hedefleriniz üzerine — ProDuality',
    body:
      'Merhaba {client},\n\n'
      + 'Talebiniz bize ulaştı, teşekkür ederiz. ProDuality olarak Türkiye, Dubai, İspanya ve İngiltere pazarlarında yatırımcılarımıza tek muhatapla, uçtan uca eşlik ediyoruz — araştırmadan tapuya kadar.\n\n'
      + 'Size en doğru seçenekleri sunabilmemiz için hedeflerinizi kısaca dinlemek isteriz: bütçeniz, tercih ettiğiniz bölge ve yatırım amacınız (kira getirisi, değer artışı ya da oturum).\n\n'
      + 'Bu hafta 15 dakikalık bir telefon görüşmesi sizin için uygun olur mu? Dilerseniz birkaç saat önerebilirim.',
  },
  {
    id: 'tr-gorusme-daveti',
    lang: 'tr',
    name: 'Görüşme Daveti',
    description: 'Randevu teklifi — net seçenek sunar, karar yükünü azaltır.',
    subject: 'Kısa bir görüşme planlayalım mı?',
    body:
      'Merhaba {client},\n\n'
      + 'Hedeflerinize uyan seçenekleri sizin için derledim. En verimlisi, bunları 20 dakikalık bir görüşmede birlikte gözden geçirmemiz — hangi soruyu sorarsanız sorun, açık ve net cevap alacaksınız.\n\n'
      + 'Bu hafta Salı 14:00 ya da Perşembe 11:00 size uyar mı? Farklı bir zaman isterseniz takvimimi size göre ayarlarım.',
  },
  {
    id: 'tr-gorusme-takip',
    lang: 'tr',
    name: 'Görüşme Sonrası Özet',
    description: 'Görüşmeden sonra aynı gün gönderilir — konuşulanları ve sonraki adımı yazıya döker.',
    subject: 'Görüşmemizin özeti ve sonraki adımlar',
    body:
      'Merhaba {client},\n\n'
      + 'Bugünkü görüşmemiz için teşekkür ederim — hedeflerinizi net bir şekilde anladım.\n\n'
      + 'Konuştuklarımızın özeti: aradığınız kriterlere uyan seçenekleri önümüzdeki günlerde sizinle paylaşacağım. Her seçenekte fiyat, ödeme planı ve beklenen getiriyi açıkça göreceksiniz; kararınızı kolaylaştırmak bizim işimiz.\n\n'
      + 'Bu arada aklınıza takılan her şey için bana doğrudan ulaşabilirsiniz.',
  },
  {
    id: 'tr-proje-tanitim',
    lang: 'tr',
    name: 'Proje Önerisi',
    description: 'Kriterlere uyan yeni proje çıktığında — neden ONA uygun olduğunu söyler.',
    subject: 'Kriterlerinize uyan yeni bir fırsat',
    body:
      'Merhaba {client},\n\n'
      + 'Belirttiğiniz kriterlere uyan yeni bir proje portföyümüze girdi ve ilk size yazıyorum.\n\n'
      + 'Konum, ödeme planı ve teslim tarihi tam da aradığınız çerçevede. Detaylı sunumu ekte bulacaksınız; rakamlar ve görseller kendini anlatıyor.\n\n'
      + 'İncelemeniz sonrası kısa bir görüşmeyle sorularınızı yanıtlamak isterim. Bu hafta hangi gün size uygun?',
  },
  {
    id: 'tr-teklif-sunum',
    lang: 'tr',
    name: 'Teklif Gönderimi',
    description: 'Hazırlanan teklifin eşlik yazısı — teklifi çerçeveler, aciliyet dayatmaz.',
    subject: 'Size özel hazırladığımız teklif',
    body:
      'Merhaba {client},\n\n'
      + 'Görüşmelerimiz doğrultusunda size özel bir teklif hazırladık. İçinde mülk detayları, ödeme planı ve beklenen getiri hesabı — hepsi açık rakamlarla — yer alıyor.\n\n'
      + 'Teklifi kendi hızınızda inceleyin; acele ettirmek bizim tarzımız değil. Sorularınız olduğunda ya da bir maddeyi birlikte gözden geçirmek istediğinizde tek bir mesajınız yeterli.\n\n'
      + 'Kararınız ne olursa olsun, süreci sizin için net ve şeffaf tutacağız.',
  },
  {
    id: 'tr-nazik-hatirlatma',
    lang: 'tr',
    name: 'Nazik Hatırlatma',
    description: 'Yanıt gelmeyince — baskısız, kapıyı açık tutan kısa dokunuş.',
    subject: 'Aklımdasınız — hazır olduğunuzda buradayım',
    body:
      'Merhaba {client},\n\n'
      + 'Bir süredir sizden haber alamadım — yoğunluktandır, gayet anlaşılır.\n\n'
      + 'Paylaştığım seçenekler hâlâ güncel; bir-iki tanesinde fiyat ve müsaitlik yakında değişebilir. Baskı yok: yalnızca, karar aşamasına geldiğinizde güncel tabloyu benden isteyebileceğinizi bilin.\n\n'
      + 'Uygun olduğunuzda tek satırlık bir yanıt yeterli.',
  },
  {
    id: 'tr-belge-talebi',
    lang: 'tr',
    name: 'Belge / Bilgi Talebi',
    description: 'Rezervasyon öncesi gerekli belgeler — neyin neden istendiğini açıklar.',
    subject: 'Rezervasyon için ihtiyacımız olan birkaç belge',
    body:
      'Merhaba {client},\n\n'
      + 'Rezervasyon adımına geçebilmemiz için birkaç belgeye ihtiyacımız var: pasaport/kimlik kopyası ve güncel iletişim bilgileriniz. Bunlar yalnızca resmi işlemler için kullanılır ve verileriniz KVKK kapsamında korunur.\n\n'
      + 'Belgeleri bu e-postaya yanıt olarak iletebilirsiniz; alır almaz süreci başlatıp her adımda sizi bilgilendireceğim.\n\n'
      + 'Herhangi bir sorunuz olursa çekinmeden yazın.',
  },
  {
    id: 'tr-tesekkur',
    lang: 'tr',
    name: 'Teşekkür & Sonraki Adımlar',
    description: 'Satış/kayıt tamamlanınca — ilişkiyi kapatmaz, uzun vadeye bağlar.',
    subject: 'Teşekkürler — bundan sonrası bizde',
    body:
      'Merhaba {client},\n\n'
      + 'Bize duyduğunuz güven için içtenlikle teşekkür ederiz. İmza tamam; bundan sonraki resmi adımların her birini biz takip edeceğiz ve her gelişmede sizi bilgilendireceğiz.\n\n'
      + 'İlişkimiz burada bitmiyor: mülkünüzle ilgili her konuda — kiralama, yönetim ya da ileride satış — tek muhatabınız yine biziz.\n\n'
      + 'Yeni mülkünüz hayırlı olsun. İhtiyacınız olan an, bir mesaj uzağınızdayız.',
  },

  // ─────────────────────────── ENGLISH ───────────────────────────
  {
    id: 'en-introduction',
    lang: 'en',
    name: 'Introduction / First Contact',
    description: 'First reply to a new enquiry — builds trust, sets the next step.',
    subject: 'About your investment goals — ProDuality',
    body:
      'Hello {client},\n\n'
      + 'Thank you for reaching out. At ProDuality we guide investors end-to-end across Türkiye, Dubai, Spain and the UK — one point of contact from research to title deed.\n\n'
      + 'To match you with the right options, I would love to hear your goals in brief: your budget, preferred location, and what you are investing for — rental yield, capital growth or residency.\n\n'
      + 'Would a 15-minute call work for you this week? I am happy to suggest a few time slots.',
  },
  {
    id: 'en-meeting-invite',
    lang: 'en',
    name: 'Meeting Invitation',
    description: 'Proposes a call with concrete slots — reduces decision friction.',
    subject: 'Shall we schedule a short call?',
    body:
      'Hello {client},\n\n'
      + 'I have shortlisted options that fit your goals. The most productive next step is a 20-minute call to walk through them together — ask anything, and you will get a clear, direct answer.\n\n'
      + 'Would Tuesday at 2 PM or Thursday at 11 AM suit you? If not, tell me what works and I will arrange my calendar around you.',
  },
  {
    id: 'en-meeting-followup',
    lang: 'en',
    name: 'Post-Meeting Summary',
    description: 'Sent the same day after a meeting — puts decisions and next steps in writing.',
    subject: 'Summary of our call and next steps',
    body:
      'Hello {client},\n\n'
      + 'Thank you for your time today — I now have a clear picture of what you are looking for.\n\n'
      + 'To summarise: I will curate options matching your criteria and send them over in the coming days. For each one you will see the price, payment plan and projected return in plain numbers — making your decision easier is our job.\n\n'
      + 'In the meantime, feel free to reach me directly with any question.',
  },
  {
    id: 'en-project-intro',
    lang: 'en',
    name: 'Project Recommendation',
    description: 'When a new project matches their criteria — explains why it fits THEM.',
    subject: 'A new opportunity matching your criteria',
    body:
      'Hello {client},\n\n'
      + 'A new project has just entered our portfolio, and it fits your criteria closely — so you are the first person I am writing to.\n\n'
      + 'Location, payment plan and completion date are all within the frame you described. You will find the full presentation attached; the numbers and visuals speak for themselves.\n\n'
      + 'Once you have had a look, I would be glad to answer your questions on a short call. Which day suits you this week?',
  },
  {
    id: 'en-proposal-cover',
    lang: 'en',
    name: 'Proposal Delivery',
    description: 'Cover note for a prepared proposal — frames it without pressure.',
    subject: 'Your personalised proposal is ready',
    body:
      'Hello {client},\n\n'
      + 'Following our conversations, we have prepared a proposal tailored to you. Inside you will find the property details, the payment plan and the projected return — all in transparent figures.\n\n'
      + 'Take your time reviewing it; rushing clients is not how we work. Whenever a question comes up, or you would like to go through any section together, one message is enough.\n\n'
      + 'Whatever you decide, we will keep the process clear and honest for you.',
  },
  {
    id: 'en-gentle-reminder',
    lang: 'en',
    name: 'Gentle Reminder',
    description: 'After silence — a short, pressure-free nudge that keeps the door open.',
    subject: 'Still here whenever you are ready',
    body:
      'Hello {client},\n\n'
      + 'It has been a little while since we last spoke — busy schedules, completely understandable.\n\n'
      + 'The options I shared are still current, though pricing and availability on one or two may change soon. No pressure at all: just know that whenever you are ready to decide, I can send you the up-to-date picture within the day.\n\n'
      + 'A one-line reply is all it takes.',
  },
  {
    id: 'en-document-request',
    lang: 'en',
    name: 'Document / Info Request',
    description: 'Documents needed before reservation — explains what and why.',
    subject: 'A few documents needed for your reservation',
    body:
      'Hello {client},\n\n'
      + 'To move to the reservation step, we need a few documents from you: a copy of your passport/ID and your current contact details. These are used solely for the official process, and your data is protected under applicable privacy law.\n\n'
      + 'You can simply reply to this email with the documents; as soon as they arrive I will start the process and keep you informed at every step.\n\n'
      + 'If anything is unclear, just ask.',
  },
  {
    id: 'en-thank-you',
    lang: 'en',
    name: 'Thank You & Next Steps',
    description: 'After completion — closes the sale, opens the long-term relationship.',
    subject: 'Thank you — we will take it from here',
    body:
      'Hello {client},\n\n'
      + 'Thank you sincerely for the trust you have placed in us. With the signing complete, we will now follow every official step on your behalf and keep you informed as things progress.\n\n'
      + 'Our relationship does not end here: for anything concerning your property — letting, management, or a future sale — we remain your single point of contact.\n\n'
      + 'Congratulations on your new property. Whenever you need us, we are one message away.',
  },
];

/** Verilen dilin şablonları (seçici bu listeyi gösterir). */
export const templatesFor = (lang: 'tr' | 'en'): EmailTemplate[] =>
  EMAIL_TEMPLATES.filter((tpl) => tpl.lang === lang);

/** Kimliğe göre şablon; bilinmeyen kimlik null. */
export const templateById = (id: string): EmailTemplate | null =>
  EMAIL_TEMPLATES.find((tpl) => tpl.id === id) ?? null;
