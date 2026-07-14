// =====================================================================
// PREI | Client-facing e-mail template ("Private Banking Terminal" kimliği)
// Table-based, inline-styled HTML — Outlook/Gmail/Apple Mail uyumlu.
// Görsel logo yerine metin wordmark kullanılır: e-posta istemcilerinin
// çoğu görselleri varsayılan engeller, marka adı böylece her zaman görünür.
// Renk/tipografi PREI_Design_System_v1.md light tema token'larından
// (dark-mode e-posta istemci desteği tutarsız olduğundan light temel alındı).
// =====================================================================

export interface ClientEmailParams {
  recipientName: string;
  consultantName: string;
  consultantTitle?: string;
  consultantEmail: string;
  consultantPhone?: string;
  /** Paragraf paragraf gövde metni — her biri ayrı <p> olur. */
  bodyParagraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  /** Gizli önizleme metni (inbox listesinde konudan sonra görünür). */
  preheader?: string;
}

const COLORS = {
  bgApp: '#F4F3F1',
  bgSurface: '#FDFCFB',
  headerBg: '#0B0C0E',
  textPrimary: '#1B1A18',
  textSecondary: '#5C5A55',
  textMuted: '#8E8C86',
  border: '#E7E5E1',
  brand: '#9B5BB3',
  brandDim: '#8A4DA1',
  onBrand: '#FFFFFF',
};

const FONT_SANS = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "'Geist Mono', 'SFMono-Regular', Consolas, 'Courier New', monospace";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const initials = (name: string): string =>
  name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function buildClientEmailHtml(p: ClientEmailParams): string {
  const paragraphs = p.bodyParagraphs
    .map((para) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${COLORS.textPrimary};font-family:${FONT_SANS};">${escapeHtml(para)}</p>`)
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

  const consultantMeta = [p.consultantTitle, p.consultantPhone].filter(Boolean).join(' &bull; ');

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
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

          <!-- Header: koyu terminal şeridi + metin wordmark -->
          <tr>
            <td style="background-color:${COLORS.headerBg};border-radius:12px 12px 0 0;padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-family:${FONT_SANS};font-size:20px;font-weight:600;color:#ECEAE6;letter-spacing:-0.01em;">Pro<span style="color:${COLORS.brand};">Duality</span></span>
                    <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#605F5B;margin-top:4px;">Gayrimenkul Danışmanlığı</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:${COLORS.bgSurface};border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};padding:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom:20px;">
                    <span style="font-family:${FONT_SANS};font-size:15px;color:${COLORS.textPrimary};">Sayın ${escapeHtml(p.recipientName)},</span>
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

          <!-- Signature -->
          <tr>
            <td style="background-color:${COLORS.bgSurface};border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};border-bottom:1px solid ${COLORS.border};padding:0 32px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:44px;height:44px;border-radius:9999px;background-color:rgba(155,91,179,0.14);text-align:center;vertical-align:middle;font-family:${FONT_MONO};font-size:14px;font-weight:600;color:${COLORS.brand};">
                    ${escapeHtml(initials(p.consultantName))}
                  </td>
                  <td style="padding-left:12px;">
                    <div style="font-family:${FONT_SANS};font-size:14px;font-weight:600;color:${COLORS.textPrimary};">${escapeHtml(p.consultantName)}</div>
                    ${consultantMeta ? `<div style="font-family:${FONT_SANS};font-size:12px;color:${COLORS.textSecondary};margin-top:2px;">${consultantMeta}</div>` : ''}
                    <div style="font-family:${FONT_MONO};font-size:12px;color:${COLORS.brand};margin-top:2px;">${escapeHtml(p.consultantEmail)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 0 32px;" align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-top:1px solid ${COLORS.border};padding-top:20px;">
                    <div style="font-family:${FONT_SANS};font-size:12px;color:${COLORS.textMuted};line-height:1.6;">
                      ProDuality Real Estate &bull; Türkiye, BAE, İspanya, İngiltere<br>
                      <a href="mailto:info@produality.com" style="color:${COLORS.textMuted};text-decoration:underline;">info@produality.com</a> &bull; +90 507 857 69 05 &bull;
                      <a href="https://produality.com" style="color:${COLORS.textMuted};text-decoration:underline;">produality.com</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Zengin metinsiz e-posta istemcileri için düz metin karşılığı. */
export function buildClientEmailText(p: ClientEmailParams): string {
  const lines = [
    `Sayın ${p.recipientName},`,
    '',
    ...p.bodyParagraphs,
    '',
  ];
  if (p.ctaLabel && p.ctaUrl) {
    lines.push(`${p.ctaLabel}: ${p.ctaUrl}`, '');
  }
  lines.push(
    '--',
    p.consultantName,
    [p.consultantTitle, p.consultantPhone].filter(Boolean).join(' | '),
    p.consultantEmail,
    '',
    'ProDuality Real Estate',
    'info@produality.com | +90 507 857 69 05 | produality.com',
  );
  return lines.filter((l) => l !== undefined).join('\n');
}
