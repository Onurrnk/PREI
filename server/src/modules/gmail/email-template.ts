// =====================================================================
// PREI | Client-facing e-mail template
// Table-based, inline-styled HTML — Outlook/Gmail/Apple Mail uyumlu.
// Görsel dil, ProDuality'nin kağıt üzerindeki resmi belgelerinden
// (danışmanlık sözleşmesi vb.) esinlenir: krem zemin, ince gri/mor
// çizgiler, serif başlıklar + italik vurgular, küçük harf aralıklı
// (tracked small-caps) etiketler. Gerçek logo (PRODUALITY_LOGO_BASE64,
// bkz. logo-asset.ts) e-postaya CID inline-image olarak gömülür —
// public bir URL'ye bağımlı değildir, tüm istemcilerde güvenilir çalışır.
// =====================================================================
import { PRODUALITY_LOGO_CONTENT_ID } from './logo-asset';

export interface ClientEmailParams {
  recipientName: string;
  /** Selamlama satırının tamamı (ör. "Dear John," / "Sayın Ahmet Bey,").
   *  Verilmezse Türkçe varsayılan kullanılır: "Sayın {recipientName},". */
  greeting?: string;
  consultantName: string;
  consultantTitle?: string;
  consultantEmail: string;
  consultantPhone?: string;
  /** Paragraf paragraf gövde metni — her biri ayrı <p> olur. */
  bodyParagraphs: string[];
  /** Kompozörden gelen zengin gövde (sanitize edilmiş HTML). Verilirse
   *  bodyParagraphs yerine bu kullanılır. */
  bodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Gizli önizleme metni (inbox listesinde konudan sonra görünür). */
  preheader?: string;
}

const COLORS = {
  bgApp: '#F4F3F1',
  bgSurface: '#FDFCFB',
  textPrimary: '#1B1A18',
  textSecondary: '#5C5A55',
  textMuted: '#8E8C86',
  border: '#E7E5E1',
  // Tasarım sistemi tek accent'i — logo moru (#9B5BB3). E-posta istemcilerinde
  // var() çalışmadığından literal hex; design-system --brand-primary ile birebir.
  brand: '#9B5BB3',
  brandDim: '#8A4DA1',
  onBrand: '#FFFFFF',
};

const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildClientEmailHtml(p: ClientEmailParams): string {
  const paragraphs = p.bodyHtml
    ? `<div style="font-size:15px;line-height:1.65;color:${COLORS.textPrimary};font-family:${FONT_SANS};">${p.bodyHtml}</div>`
    : p.bodyParagraphs
      .map((para) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:${COLORS.textPrimary};font-family:${FONT_SANS};">${escapeHtml(para)}</p>`)
      .join('\n');

  const cta = p.ctaLabel && p.ctaUrl ? `
    <tr>
      <td style="padding:8px 0 24px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="border-radius:8px;background-color:${COLORS.brand};">
              <a href="${escapeHtml(p.ctaUrl)}" style="display:inline-block;padding:12px 24px;font-family:${FONT_SANS};font-size:14px;font-weight:500;color:${COLORS.onBrand};text-decoration:none;border-radius:8px;">${escapeHtml(p.ctaLabel)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  const consultantMeta = p.consultantTitle;

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>ProDuality</title>
<!--[if mso]>
<style type="text/css">
  table { border-collapse: collapse; }
  .fallback-font { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bgApp};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(p.preheader ?? '')}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.bgApp};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${COLORS.bgSurface};border:1px solid ${COLORS.border};border-radius:12px;">

          <!-- Header: krem zemin, gerçek logo (CID inline image), altında ince çizgi -->
          <tr>
            <td align="center" style="padding:36px 32px 24px 32px;">
              <img src="cid:${PRODUALITY_LOGO_CONTENT_ID}" width="200" height="60" alt="ProDuality — Property and Investment" style="display:block;width:200px;height:60px;border:0;outline:none;">
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid ${COLORS.border};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom:18px;">
                    <span style="font-family:${FONT_SANS};font-size:16px;font-weight:600;color:${COLORS.textPrimary};">${escapeHtml(p.greeting ?? `Sayın ${p.recipientName},`)}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    ${paragraphs}
                  </td>
                </tr>
                ${cta}
              </table>
            </td>
          </tr>

          <!-- Divider: sade hairline (sessiz lüks — accent dekorasyonda kullanılmaz) -->
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid ${COLORS.border};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-family:${FONT_SANS};font-size:14px;font-weight:600;color:${COLORS.textPrimary};">${escapeHtml(p.consultantName)}</div>
                    ${consultantMeta ? `<div style="font-family:${FONT_SANS};font-size:12px;color:${COLORS.textSecondary};margin-top:3px;">${escapeHtml(consultantMeta)}</div>` : ''}
                    <div style="font-family:${FONT_SANS};font-size:12px;color:${COLORS.brand};margin-top:6px;">${escapeHtml(p.consultantEmail)}</div>
                    ${p.consultantPhone ? `<div style="font-family:${FONT_SANS};font-size:12px;color:${COLORS.textSecondary};margin-top:2px;">${escapeHtml(p.consultantPhone)}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 32px 32px;" align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-top:1px solid ${COLORS.border};padding-top:18px;">
                    <div style="font-family:${FONT_SANS};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.textMuted};line-height:1.8;">
                      ProDuality Property &amp; Investment &bull; T&uuml;rkiye, BAE, İspanya, İngiltere<br>
                      <a href="mailto:info@produality.com" style="color:${COLORS.textMuted};text-decoration:underline;">info@produality.com</a> &bull; +90 507 857 69 05 &bull;
                      <a href="https://produality.com" style="color:${COLORS.textMuted};text-decoration:underline;">produality.com</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Zengin metinsiz e-posta istemcileri için düz metin karşılığı. */
export function buildClientEmailText(p: ClientEmailParams): string {
  const lines = [
    p.greeting ?? `Sayın ${p.recipientName},`,
    '',
    ...p.bodyParagraphs,
    '',
  ];
  if (p.ctaLabel && p.ctaUrl) {
    lines.push(`${p.ctaLabel}: ${p.ctaUrl}`, '');
  }
  lines.push('--', p.consultantName);
  if (p.consultantTitle) lines.push(p.consultantTitle);
  lines.push(p.consultantEmail);
  if (p.consultantPhone) lines.push(p.consultantPhone);
  lines.push(
    '',
    'ProDuality Property & Investment',
    'info@produality.com | +90 507 857 69 05 | produality.com',
  );
  return lines.join('\n');
}
