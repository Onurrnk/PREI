// =====================================================================
// PREI | Teklif e-posta şablonu — markalı, e-posta-güvenli inline HTML.
// Danışmanın Gmail'inden müşteriye gider (logo mor #9B5BB3, Private Banking
// Terminal dili). Komisyon/gizli alan İÇERMEZ (G-1). Girilen tüm teklif
// bilgileri (daire, finansal, ödeme planı, ROI) görünür kılınır.
// =====================================================================
import type { ProposalResponse } from './dto/proposal-response.dto';

const PURPLE = '#9B5BB3';
const INK = '#1a1524';
const MUTED = '#6b6478';
const LINE = '#e7e2ee';

function fmtMoney(v: number, currency: string): string {
  return `${Math.round(v).toLocaleString('tr-TR')} ${currency}`;
}
function fmtPct(v: number): string {
  return `%${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
}
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TITLE_DEED_TR: Record<string, string> = {
  kat_mulkiyeti: 'Kat Mülkiyeti', kat_irtifaki: 'Kat İrtifakı',
  mustakil: 'Müstakil Tapu', arsa: 'Arsa',
};

function unitRows(unit: Record<string, unknown>): string {
  const map: Array<[string, string, string]> = [
    ['type', 'Daire Tipi', ''], ['unitNo', 'Daire / Blok', ''],
    ['area', 'Brüt Alan', ' m²'], ['netArea', 'Net Alan', ' m²'],
    ['floor', 'Kat', ''], ['facade', 'Cephe / Yön', ''], ['view', 'Manzara', ''],
    ['bedrooms', 'Yatak Odası', ''], ['bathrooms', 'Banyo', ''],
  ];
  const rows = map
    .filter(([k]) => unit[k] !== undefined && unit[k] !== null && unit[k] !== '')
    .map(([k, label, sfx]) => `<tr>
        <td style="padding:6px 12px;color:${MUTED};font-size:13px;border-bottom:1px solid ${LINE};">${label}</td>
        <td style="padding:6px 12px;color:${INK};font-size:13px;font-weight:600;border-bottom:1px solid ${LINE};text-align:right;">${esc(unit[k])}${sfx}</td>
      </tr>`);
  const deed = typeof unit.titleDeed === 'string' ? TITLE_DEED_TR[unit.titleDeed] : undefined;
  if (deed) {
    rows.push(`<tr>
        <td style="padding:6px 12px;color:${MUTED};font-size:13px;border-bottom:1px solid ${LINE};">Tapu Durumu</td>
        <td style="padding:6px 12px;color:${INK};font-size:13px;font-weight:600;border-bottom:1px solid ${LINE};text-align:right;">${esc(deed)}</td>
      </tr>`);
  }
  return rows.join('');
}

export function buildProposalEmail(p: ProposalResponse, consultantName: string): {
  subject: string;
  html: string;
} {
  const currency = p.currency || 'USD';
  const subject = `Yatırım Teklifi — ${p.projectName !== '—' ? p.projectName : p.title}`;
  const unit = p.unit ?? {};
  const hasDiscount = typeof p.listPrice === 'number' && (p.discountPct ?? 0) > 0;

  const paymentRows = (p.paymentPlan ?? [])
    .map((r) => `<tr>
      <td style="padding:8px 12px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};">${esc(r.milestone)}</td>
      <td style="padding:8px 12px;font-size:13px;color:${PURPLE};font-weight:700;text-align:center;border-bottom:1px solid ${LINE};">${fmtPct(r.percentage)}</td>
      <td style="padding:8px 12px;font-size:13px;color:${MUTED};text-align:right;border-bottom:1px solid ${LINE};">${esc(r.date)}</td>
    </tr>`)
    .join('');

  const roi = p.roi;
  const roiRows = roi ? [
    ['Brüt Kira Getirisi (yıllık)', fmtPct(roi.grossYieldPct)],
    ['Net Kira Getirisi (yıllık)', fmtPct(roi.netYieldPct)],
    ['Yıllık Net Kira Geliri', fmtMoney(roi.annualNetRent, currency)],
    ['Yıllık Değer Artışı', `${fmtMoney(roi.annualAppreciation, currency)} (${fmtPct(roi.appreciationPct)})`],
    ['Yıllık Toplam Getiri', fmtPct(roi.annualTotalReturnPct)],
  ].map(([k, v], i) => `<tr>
      <td style="padding:8px 12px;font-size:13px;color:${MUTED};border-bottom:1px solid ${LINE};">${k}</td>
      <td style="padding:8px 12px;font-size:14px;color:${i >= 4 ? PURPLE : INK};font-weight:700;text-align:right;border-bottom:1px solid ${LINE};">${v}</td>
    </tr>`).join('') : '';

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1f9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};">
      <div style="background:#ffffff;padding:22px 28px;border-bottom:1px solid ${LINE};">
        <img src="https://produality.com/assets/images/logo-email.png" alt="ProDuality" height="40" style="height:40px;width:auto;display:block;" />
      </div>

      <div style="padding:28px;">
        <div style="color:${PURPLE};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Özel Yatırım Teklifi</div>
        <h1 style="margin:8px 0 4px;color:${INK};font-size:24px;">${esc(p.title)}</h1>
        <div style="color:${MUTED};font-size:14px;">${esc(p.projectName !== '—' ? p.projectName : '')}${p.projectLocation ? ' · ' + esc(p.projectLocation) : ''}</div>
        <div style="margin-top:16px;color:${MUTED};font-size:13px;">Hazırlayan: <strong style="color:${INK};">${esc(consultantName)}</strong></div>
        <div style="color:${MUTED};font-size:13px;">Sayın <strong style="color:${INK};">${esc(p.clientName)}</strong> için hazırlanmıştır.</div>
      </div>

      ${unitRows(unit) ? `<div style="padding:0 28px 20px;">
        <h3 style="color:${INK};font-size:15px;margin:0 0 8px;">Mülk Bilgileri</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">${unitRows(unit)}</table>
        ${unit.features ? `<p style="margin:10px 0 0;color:${MUTED};font-size:13px;line-height:1.5;"><strong style="color:${INK};">Özellikler:</strong> ${esc(unit.features)}</p>` : ''}
        ${unit.description ? `<p style="margin:8px 0 0;color:${MUTED};font-size:13px;line-height:1.5;">${esc(unit.description)}</p>` : ''}
      </div>` : ''}

      <div style="padding:0 28px 20px;">
        <h3 style="color:${INK};font-size:15px;margin:0 0 8px;">Finansal Özet</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">
          ${hasDiscount ? `<tr>
            <td style="padding:8px 12px;color:${MUTED};font-size:13px;border-bottom:1px solid ${LINE};">Liste Fiyatı</td>
            <td style="padding:8px 12px;color:${MUTED};font-size:13px;text-decoration:line-through;text-align:right;border-bottom:1px solid ${LINE};">${fmtMoney(p.listPrice!, currency)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;color:${MUTED};font-size:13px;border-bottom:1px solid ${LINE};">İndirim</td>
            <td style="padding:8px 12px;color:${PURPLE};font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid ${LINE};">${fmtPct(p.discountPct!)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:12px;color:${INK};font-size:14px;font-weight:700;">${hasDiscount ? 'İndirimli Fiyat' : 'Toplam Yatırım'}</td>
            <td style="padding:12px;color:${PURPLE};font-size:18px;font-weight:800;text-align:right;">${fmtMoney(p.totalValue, currency)}</td>
          </tr>
        </table>
      </div>

      ${paymentRows ? `<div style="padding:0 28px 20px;">
        <h3 style="color:${INK};font-size:15px;margin:0 0 8px;">Ödeme Planı</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#faf8fd;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:${MUTED};">Aşama</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:${MUTED};">Oran</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:${MUTED};">Tarih</th>
          </tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>
        ${p.paymentPlanOnList ? `<p style="margin:8px 0 0;color:${MUTED};font-size:12px;font-style:italic;">* Ödeme planı oranları liste fiyatı üzerinden hesaplanmıştır.</p>` : ''}
      </div>` : ''}

      ${roiRows ? `<div style="padding:0 28px 24px;">
        <h3 style="color:${INK};font-size:15px;margin:0 0 8px;">Yatırım Getiri Analizi (ROI)</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">${roiRows}</table>
        <p style="margin:8px 0 0;color:${MUTED};font-size:11px;line-height:1.5;">Yıllık getiri projeksiyonu, girilen kira ve değer artışı varsayımlarına dayanır. Gerçek getiriler piyasa koşullarına göre değişebilir; yatırım tavsiyesi değildir.</p>
      </div>` : ''}

      ${p.notes ? `<div style="padding:0 28px 24px;">
        <h3 style="color:${INK};font-size:15px;margin:0 0 8px;">Notlar</h3>
        <p style="color:${MUTED};font-size:13px;line-height:1.6;margin:0;">${esc(p.notes)}</p>
      </div>` : ''}

      <div style="background:#faf8fd;padding:20px 28px;border-top:1px solid ${LINE};">
        <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.6;">Detaylı görüşme ve site ziyareti için bize dönebilirsiniz.<br/>ProDuality · Türkiye · Birleşik Arap Emirlikleri · İngiltere · info@produality.com</p>
      </div>
    </div>
  </div>
</body></html>`;

  return { subject, html };
}
