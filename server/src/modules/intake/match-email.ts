// =====================================================================
// PREI | Proje eşleşme e-postası — saf HTML kurucu.
//
// Önceki hâli düz bir <ul> listesiydi: "Proje adı — şehir · fiyat".
// Görsel yok, kart yok; yatırımcıya sunum gibi değil, sistem bildirimi
// gibi görünüyordu.
//
// Yeni hâli: her proje için kapak görselli kart, konum/fiyat/olanak
// satırları ve harita bağlantısı. E-posta istemcileri flexbox/grid
// desteklemediği için TABLO düzeni ve satır-içi stil kullanılıyor —
// Outlook dahil her yerde aynı görünsün.
// =====================================================================

export interface MatchProject {
  title: string;
  city: string | null;
  marketName: string | null;
  priceLine: string | null;
  /** Public URL — imzalı/kısa ömürlü URL KULLANILAMAZ (mail sonra açılır). */
  imageUrl: string | null;
  mapUrl: string | null;
  amenities: string[];
  unitTypes: string[];
}

const BRAND = '#9B5BB3';
const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const LINE = '#E6E3DE';

export function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tek projenin kartı.
 *
 * Görsel yoksa kart görselsiz kurulur — kırık resim ikonu göstermek
 * hiç göstermemekten kötü.
 */
export function projectCard(p: MatchProject, en: boolean): string {
  const loc = [p.city, p.marketName].filter(Boolean).join(', ');
  const mapLabel = en ? 'View on map' : 'Haritada gör';

  const image = p.imageUrl
    ? `<tr><td style="padding:0;">
         <img src="${esc(p.imageUrl)}" alt="${esc(p.title)}" width="536"
              style="display:block;width:100%;max-width:536px;height:auto;border:0;
                     border-radius:10px 10px 0 0;object-fit:cover;" />
       </td></tr>`
    : '';

  const rows: string[] = [];
  if (loc) {
    rows.push(`<tr><td style="padding:2px 0;font:14px/1.5 Arial,sans-serif;color:${MUTED};">
      ${en ? 'Location' : 'Konum'}: <span style="color:${INK};">${esc(loc)}</span></td></tr>`);
  }
  if (p.priceLine) {
    rows.push(`<tr><td style="padding:2px 0;font:14px/1.5 Arial,sans-serif;color:${MUTED};">
      ${en ? 'Price' : 'Fiyat'}: <span style="color:${INK};font-weight:bold;">${esc(p.priceLine)}</span></td></tr>`);
  }
  if (p.unitTypes.length > 0) {
    rows.push(`<tr><td style="padding:2px 0;font:14px/1.5 Arial,sans-serif;color:${MUTED};">
      ${en ? 'Unit types' : 'Daire tipleri'}: <span style="color:${INK};">${esc(p.unitTypes.slice(0, 8).join(', '))}</span></td></tr>`);
  }

  // Olanaklar rozet olarak — en fazla 6, kalanı "+N" ile özetlenir.
  const shown = p.amenities.slice(0, 6);
  const rest = p.amenities.length - shown.length;
  const chips = shown.length > 0
    ? `<tr><td style="padding:10px 0 0;">${
        shown.map((a) =>
          `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;
             font:12px/1.3 Arial,sans-serif;color:${BRAND};background:#F4EDF7;
             border-radius:999px;">${esc(a)}</span>`).join('')
      }${rest > 0
        ? `<span style="display:inline-block;padding:4px 10px;font:12px/1.3 Arial,sans-serif;
             color:${MUTED};">+${rest}</span>`
        : ''}</td></tr>`
    : '';

  const map = p.mapUrl
    ? `<tr><td style="padding:14px 0 0;">
         <a href="${esc(p.mapUrl)}"
            style="display:inline-block;padding:9px 18px;font:13px/1 Arial,sans-serif;
                   color:#FFFFFF;background:${BRAND};border-radius:6px;
                   text-decoration:none;">${mapLabel}</a>
       </td></tr>`
    : '';

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="margin:0 0 22px;border:1px solid ${LINE};border-radius:10px;
                background:#FFFFFF;">
    ${image}
    <tr><td style="padding:18px 20px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding:0 0 8px;font:bold 18px/1.35 Arial,sans-serif;color:${INK};">
          ${esc(p.title)}</td></tr>
        ${rows.join('')}
        ${chips}
        ${map}
      </table>
    </td></tr>
  </table>`;
}

export interface MatchEmailInput {
  projects: MatchProject[];
  en: boolean;
  logoUrl: string;
  unsubscribeUrl: string;
}

/** Tüm gövde: başlık + kartlar + kapanış + KVKK dipnotu. */
export function buildMatchEmailHtml(input: MatchEmailInput): string {
  const { projects, en, logoUrl, unsubscribeUrl } = input;
  const n = projects.length;

  const intro = en
    ? `New project${n > 1 ? 's' : ''} matching your investment criteria ${n > 1 ? 'have' : 'has'} just been added to our portfolio.`
    : `Yatırım kriterlerinize uyan, portföyümüze yeni eklenen proje${n > 1 ? 'ler' : ''}:`;

  const outro = en
    ? 'Reply to this email for a tailored assessment, full unit list and payment plans.'
    : 'Size özel değerlendirme, tam daire listesi ve ödeme planları için bu e-postayı yanıtlamanız yeterli.';

  const unsub = en
    ? `You are receiving this because you consented to project match updates. <a href="${esc(unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>.`
    : `Bu e-postayı, proje eşleşme bildirimlerine izin verdiğiniz için alıyorsunuz. <a href="${esc(unsubscribeUrl)}" style="color:${MUTED};">Abonelikten çık</a>.`;

  // Not: selamlama ("Merhaba {ad},") agent-mail.php markalı kabukta ekleniyor —
  // gövde selamla BAŞLAMAZ (çift selamlama olmasın).
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:0 0 18px;">
      <img src="${esc(logoUrl)}" alt="ProDuality" height="34"
           style="display:block;height:34px;width:auto;border:0;" />
    </td></tr>
    <tr><td style="padding:0 0 20px;font:15px/1.6 Arial,sans-serif;color:${INK};">
      ${esc(intro)}
    </td></tr>
    <tr><td>${projects.map((p) => projectCard(p, en)).join('')}</td></tr>
    <tr><td style="padding:4px 0 0;font:15px/1.6 Arial,sans-serif;color:${INK};">
      ${esc(outro)}
    </td></tr>
    <tr><td style="padding:26px 0 0;font:12px/1.5 Arial,sans-serif;color:${MUTED};">
      ${unsub}
    </td></tr>
  </table>`;
}

/** Düz metin karşılığı — HTML kapalı istemciler için. */
export function buildMatchEmailText(input: MatchEmailInput): string {
  const { projects, en, unsubscribeUrl } = input;
  const lines = projects.map((p) => {
    const parts = [p.title];
    const loc = [p.city, p.marketName].filter(Boolean).join(', ');
    if (loc) parts.push(loc);
    if (p.priceLine) parts.push(p.priceLine);
    if (p.amenities.length > 0) parts.push(p.amenities.slice(0, 6).join(', '));
    const head = `- ${parts.join(' | ')}`;
    return p.mapUrl ? `${head}\n  ${p.mapUrl}` : head;
  }).join('\n');

  return en
    ? `New projects matching your investment criteria:\n${lines}\n\nReply for details.\n\nUnsubscribe: ${unsubscribeUrl}`
    : `Yatırım kriterlerinize uyan yeni projeler:\n${lines}\n\nDetaylar için yanıtlayın.\n\nAbonelikten çık: ${unsubscribeUrl}`;
}
