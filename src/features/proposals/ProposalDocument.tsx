// =====================================================================
// PREI | ProposalDocument — müşteriye giden premium, açık renkli "yatırım
// sunumu" belgesi. Hem sihirbaz önizlemesinde hem ProposalView'da hem de
// PDF (window.print) çıktısında AYNI bileşen render edilir → önizleme = PDF.
// Uygulamanın koyu temasından bağımsız; kağıt/PDF için beyaz sayfa hissi.
// Marka: logo moru #9B5BB3 (dondurulmuş tasarım sistemine uyumlu accent).
// data-print-root: printProposal() yalnız bu bölümü yazdırır.
// =====================================================================
import React from 'react';
import type { ProposalUnitDetails, ProposalRoiReport, PaymentPlanDTO } from '../../core/types';
import { formatMoney } from './roi';
import styles from './ProposalDocument.module.css';

export interface ProposalDocData {
  title: string;
  clientName: string;
  consultantName?: string;
  projectName: string;
  projectLocation?: string;
  date: string;
  currency: string;
  coverImage?: string;
  images?: string[];
  unit?: ProposalUnitDetails;
  listPrice?: number;
  discountPct?: number;
  totalValue: number;
  paymentPlan?: PaymentPlanDTO[];
  paymentPlanOnList?: boolean;
  roi?: ProposalRoiReport;
  notes?: string;
  lang: 'tr' | 'en';
}

const L = (tr: boolean) => ({
  tagline: tr ? 'ÖZEL YATIRIM TEKLİFİ' : 'EXCLUSIVE INVESTMENT PROPOSAL',
  preparedFor: tr ? 'Hazırlanan' : 'Prepared for',
  advisor: tr ? 'Danışman' : 'Advisor',
  date: tr ? 'Tarih' : 'Date',
  property: tr ? 'Mülk Bilgileri' : 'Property Details',
  financial: tr ? 'Finansal Özet' : 'Financial Summary',
  payment: tr ? 'Ödeme Planı' : 'Payment Plan',
  roi: tr ? 'Yatırım Getiri Analizi' : 'Return on Investment',
  notes: tr ? 'Notlar' : 'Notes',
  listPrice: tr ? 'Liste Fiyatı' : 'List Price',
  discount: tr ? 'İndirim' : 'Discount',
  finalPrice: tr ? 'İndirimli Fiyat' : 'Discounted Price',
  totalInvestment: tr ? 'Toplam Yatırım' : 'Total Investment',
  onList: tr ? 'Ödeme planı oranları liste fiyatı üzerinden hesaplanmıştır.' : 'Payment plan percentages are calculated on the list price.',
  milestone: tr ? 'Aşama' : 'Milestone',
  rate: tr ? 'Oran' : 'Rate',
  planDate: tr ? 'Açıklama / Tarih' : 'Note / Date',
  grossYield: tr ? 'Brüt Kira Getirisi (yıllık)' : 'Gross Rental Yield (annual)',
  netYield: tr ? 'Net Kira Getirisi (yıllık)' : 'Net Rental Yield (annual)',
  annualNet: tr ? 'Yıllık Net Kira Geliri' : 'Annual Net Rent',
  annualAppr: tr ? 'Yıllık Değer Artışı' : 'Annual Appreciation',
  totalReturn: tr ? 'Yıllık Toplam Getiri' : 'Annual Total Return',
  features: tr ? 'Özellikler' : 'Features',
  roiNote: tr
    ? 'Yıllık getiri projeksiyonu, girilen kira ve değer artışı varsayımlarına dayanır. Gerçek getiriler piyasa koşullarına göre değişebilir; yatırım tavsiyesi değildir.'
    : 'Annual return projection is based on the entered rent and appreciation assumptions. Actual returns may vary with market conditions; this is not investment advice.',
  footer: tr
    ? 'ProDuality · Türkiye & Dubai Gayrimenkul Danışmanlığı · info@produality.com'
    : 'ProDuality · Türkiye & Dubai Real Estate Advisory · info@produality.com',
  u: {
    type: tr ? 'Daire Tipi' : 'Unit Type', unitNo: tr ? 'Daire / Blok' : 'Unit / Block',
    area: tr ? 'Brüt Alan' : 'Gross Area', netArea: tr ? 'Net Alan' : 'Net Area',
    floor: tr ? 'Kat' : 'Floor', facade: tr ? 'Cephe / Yön' : 'Facade', view: tr ? 'Manzara' : 'View',
    beds: tr ? 'Yatak Odası' : 'Bedrooms', baths: tr ? 'Banyo' : 'Bathrooms',
    titleDeed: tr ? 'Tapu Durumu' : 'Title Deed',
  },
  deed: {
    kat_mulkiyeti: tr ? 'Kat Mülkiyeti' : 'Condominium (Kat Mülkiyeti)',
    kat_irtifaki: tr ? 'Kat İrtifakı' : 'Construction Servitude (Kat İrtifakı)',
    mustakil: tr ? 'Müstakil Tapu' : 'Freehold (Müstakil)',
    arsa: tr ? 'Arsa' : 'Land (Arsa)',
  } as Record<string, string>,
});

// Gerçek ProDuality logosu (public/produality-logo.svg). Kapakta (koyu) beyaza
// çevrilir, footer'da (açık) tam renkli.
function Logo({ light }: { light?: boolean }) {
  return (
    <img
      src="/produality-logo.svg"
      alt="ProDuality"
      className={`${styles.logo} ${light ? styles.logoLight : ''}`}
    />
  );
}

function unitRows(unit: ProposalUnitDetails, t: ReturnType<typeof L>): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const push = (k: string, v?: string | number, sfx = '') => {
    if (v !== undefined && v !== null && v !== '') rows.push([k, `${v}${sfx}`]);
  };
  push(t.u.type, unit.type); push(t.u.unitNo, unit.unitNo);
  push(t.u.area, unit.area, ' m²'); push(t.u.netArea, unit.netArea, ' m²');
  push(t.u.floor, unit.floor); push(t.u.facade, unit.facade); push(t.u.view, unit.view);
  push(t.u.beds, unit.bedrooms); push(t.u.baths, unit.bathrooms);
  if (unit.titleDeed && t.deed[unit.titleDeed]) push(t.u.titleDeed, t.deed[unit.titleDeed]);
  return rows;
}

export const ProposalDocument: React.FC<{ doc: ProposalDocData }> = ({ doc }) => {
  const t = L(doc.lang === 'tr');
  const cur = doc.currency || 'USD';
  const hasDiscount = typeof doc.listPrice === 'number' && (doc.discountPct ?? 0) > 0;
  const unit = doc.unit ?? {};
  const rows = unitRows(unit, t);
  const roi = doc.roi;
  const plan = (doc.paymentPlan ?? []).filter((r) => (r.milestone ?? '').toString().trim());
  const gallery = (doc.images ?? []).filter(Boolean).slice(0, 6);

  return (
    <article className={styles.sheet} data-print-root>
      {/* KAPAK */}
      <header className={styles.cover} style={doc.coverImage ? { backgroundImage: `url(${doc.coverImage})` } : undefined}>
        <div className={styles.coverScrim} data-print-cover>
          <Logo light />
          <div className={styles.coverBottom}>
            <div className={styles.tagline}>{t.tagline}</div>
            <h1 className={styles.coverTitle}>{doc.projectName && doc.projectName !== '—' ? doc.projectName : doc.title}</h1>
            {doc.projectLocation && <div className={styles.coverLoc}>{doc.projectLocation}</div>}
          </div>
        </div>
      </header>

      {/* META */}
      <div className={styles.metaBar}>
        <div><span className={styles.metaK}>{t.preparedFor}</span><span className={styles.metaV}>{doc.clientName}</span></div>
        {doc.consultantName && <div><span className={styles.metaK}>{t.advisor}</span><span className={styles.metaV}>{doc.consultantName}</span></div>}
        <div><span className={styles.metaK}>{t.date}</span><span className={styles.metaV}>{doc.date}</span></div>
      </div>

      <div className={styles.body}>
        {doc.title && doc.title !== doc.projectName && (
          <p className={styles.lede}>{doc.title}</p>
        )}

        {/* MÜLK BİLGİLERİ */}
        {(rows.length > 0 || unit.features || unit.description || gallery.length > 0) && (
          <section className={styles.section}>
            <div className={styles.secLabel}>{t.property}</div>
            {rows.length > 0 && (
              <div className={styles.detailGrid}>
                {rows.map(([k, v]) => (
                  <div className={styles.detailRow} key={k}>
                    <span className={styles.dk}>{k}</span><span className={styles.dv}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            {unit.features && <p className={styles.para}><strong>{t.features}:</strong> {unit.features}</p>}
            {unit.description && <p className={styles.para}>{unit.description}</p>}
            {gallery.length > 0 && (
              <div className={styles.gallery}>
                {gallery.map((src) => <div key={src} className={styles.thumb} style={{ backgroundImage: `url(${src})` }} />)}
              </div>
            )}
          </section>
        )}

        {/* FİNANSAL */}
        <section className={styles.section}>
          <div className={styles.secLabel}>{t.financial}</div>
          <div className={styles.priceBlock}>
            {hasDiscount && (
              <div className={styles.priceMinor}>
                <span>{t.listPrice}</span>
                <s>{formatMoney(doc.listPrice!, cur)}</s>
              </div>
            )}
            {hasDiscount && (
              <div className={styles.priceMinor}>
                <span>{t.discount}</span>
                <strong className={styles.accent}>%{doc.discountPct}</strong>
              </div>
            )}
            <div className={styles.priceMain}>
              <span>{hasDiscount ? t.finalPrice : t.totalInvestment}</span>
              <strong>{formatMoney(doc.totalValue, cur)}</strong>
            </div>
          </div>
        </section>

        {/* ÖDEME PLANI */}
        {plan.length > 0 && (
          <section className={styles.section}>
            <div className={styles.secLabel}>{t.payment}</div>
            <table className={styles.table}>
              <thead><tr><th>{t.milestone}</th><th className={styles.tc}>{t.rate}</th><th className={styles.tr}>{t.planDate}</th></tr></thead>
              <tbody>
                {plan.map((r, i) => (
                  <tr key={i}><td>{r.milestone}</td><td className={styles.tc}>%{r.percentage}</td><td className={styles.tr}>{r.date}</td></tr>
                ))}
              </tbody>
            </table>
            {doc.paymentPlanOnList && <p className={styles.fine}>* {t.onList}</p>}
          </section>
        )}

        {/* ROI */}
        {roi && (
          <section className={styles.section}>
            <div className={styles.secLabel}>{t.roi}</div>
            <table className={styles.table}>
              <tbody>
                <tr><td>{t.grossYield}</td><td className={styles.tr}>%{roi.grossYieldPct}</td></tr>
                <tr><td>{t.netYield}</td><td className={styles.tr}>%{roi.netYieldPct}</td></tr>
                <tr><td>{t.annualNet}</td><td className={styles.tr}>{formatMoney(roi.annualNetRent, cur)}</td></tr>
                <tr><td>{t.annualAppr}</td><td className={styles.tr}>{formatMoney(roi.annualAppreciation, cur)} <span className={styles.muted}>(%{roi.appreciationPct})</span></td></tr>
                <tr className={styles.totalRow}><td><strong>{t.totalReturn}</strong></td><td className={styles.tr}><strong className={styles.accent}>%{roi.annualTotalReturnPct}</strong></td></tr>
              </tbody>
            </table>
            <p className={styles.fine}>{t.roiNote}</p>
          </section>
        )}

        {/* NOTLAR */}
        {doc.notes && (
          <section className={styles.section}>
            <div className={styles.secLabel}>{t.notes}</div>
            <p className={styles.para}>{doc.notes}</p>
          </section>
        )}
      </div>

      <footer className={styles.footer}>
        <Logo />
        <p className={styles.footNote}>{t.footer}</p>
      </footer>
    </article>
  );
};
