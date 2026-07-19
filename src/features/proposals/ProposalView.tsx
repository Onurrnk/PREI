// =====================================================================
// PREI | Teklif Görüntüleme — kayıtlı teklifin tam detayı (logo + daire +
// finansal + ödeme planı + ROI + durum/görüntülenme takibi). Taslakta
// "Mail Gönder" ile müşteriye gönderilebilir. i18n + yerel yeni etiketler.
// =====================================================================
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import type { ProposalDTO, ProposalUnitDetails } from '../../core/types';
import { proposalsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, DownloadSimple, Buildings, PenNib, PaperPlaneTilt } from '@phosphor-icons/react';
import { printProposal } from '../../core/utils/printProposal';
import { formatMoney } from './roi';
import styles from './ProposalView.module.css';

interface ProposalViewProps {
  proposalId?: string;
  onClose?: () => void;
}

const LX = (tr: boolean) => ({
  unitTitle: tr ? 'Mülk Bilgileri' : 'Property Details',
  roiTitle: tr ? 'Yatırım Getiri Analizi (ROI)' : 'Return on Investment (ROI)',
  listPrice: tr ? 'Liste Fiyatı' : 'List Price',
  discount: tr ? 'İndirim' : 'Discount',
  discounted: tr ? 'İndirimli Fiyat' : 'Discounted Price',
  onList: tr ? '* Ödeme planı oranları liste fiyatı üzerinden hesaplanmıştır.' : '* Payment plan is calculated on the list price.',
  features: tr ? 'Özellikler' : 'Features',
  send: tr ? 'Mail Gönder' : 'Send Email',
  sending: tr ? 'Gönderiliyor…' : 'Sending…',
  sent: tr ? 'Teklif müşteriye gönderildi.' : 'Proposal sent to the client.',
  sentAt: tr ? 'Gönderildi' : 'Sent',
  recipient: tr ? 'Alıcı' : 'Recipient',
  grossYield: tr ? 'Brüt Kira Getirisi (yıl-1)' : 'Gross Yield (yr-1)',
  netYield: tr ? 'Net Kira Getirisi (yıl-1)' : 'Net Yield (yr-1)',
  totalNet: tr ? 'Toplam Net Kira' : 'Total Net Rent',
  appr: tr ? 'Tahmini Değer Artışı' : 'Est. Capital Appreciation',
  profit: tr ? 'Toplam Kâr' : 'Total Profit',
  totalRoi: tr ? 'Toplam ROI' : 'Total ROI',
  annual: tr ? 'Yıllık Ortalama Getiri' : 'Annualized Return',
  equity: tr ? 'Sermaye Çarpanı' : 'Equity Multiple',
  u: {
    type: tr ? 'Daire Tipi' : 'Unit Type', unitNo: tr ? 'Daire / Blok' : 'Unit / Block',
    area: tr ? 'Brüt Alan' : 'Gross Area', netArea: tr ? 'Net Alan' : 'Net Area',
    floor: tr ? 'Kat' : 'Floor', facade: tr ? 'Cephe / Yön' : 'Facade', view: tr ? 'Manzara' : 'View',
    beds: tr ? 'Yatak Odası' : 'Bedrooms', baths: tr ? 'Banyo' : 'Bathrooms',
  },
});

function unitRows(unit: ProposalUnitDetails, u: ReturnType<typeof LX>['u']): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const push = (k: string, v?: string | number, sfx = '') => {
    if (v !== undefined && v !== null && v !== '') rows.push([k, `${v}${sfx}`]);
  };
  push(u.type, unit.type); push(u.unitNo, unit.unitNo);
  push(u.area, unit.area, ' m²'); push(u.netArea, unit.netArea, ' m²');
  push(u.floor, unit.floor); push(u.facade, unit.facade); push(u.view, unit.view);
  push(u.beds, unit.bedrooms); push(u.baths, unit.bathrooms);
  return rows;
}

export const ProposalView: React.FC<ProposalViewProps> = ({ proposalId, onClose }) => {
  const { t, i18n } = useTranslation();
  const tr = i18n.language === 'tr';
  const L = LX(tr);
  const { id: routeId } = useParams<{ id: string }>();
  const id = proposalId || routeId;
  const navigate = useNavigate();
  const toast = useToast();
  const { data: proposal, loading, refetch } = useFetch<ProposalDTO>(() => proposalsApi.get(id!), [id]);
  const [sending, setSending] = React.useState(false);

  if (loading) return <div className={styles.loading}>{t('proposals.view.loading')}</div>;
  if (!proposal) return <div className={styles.error}>{t('proposals.view.notFound')}</div>;

  const currency = proposal.currency || 'EUR';
  const dateLocale = tr ? 'tr-TR' : 'en-GB';
  const paymentPlan = proposal.paymentPlan ?? [];
  const hasDiscount = proposal.listPrice !== undefined && (proposal.discountPct ?? 0) > 0;
  const unit = proposal.unit ?? {};
  const roi = proposal.roi;
  const rows = unitRows(unit, L.u);
  const coverImage = proposal.coverImage || '/images/exterior.png';
  const attachmentLabels = [
    proposal.includeBrochurePdf ? t('proposals.create.brochurePdf') : null,
    proposal.includeFloorPlans ? t('proposals.create.floorPlansPdf') : null,
    proposal.includeRoiSheet ? t('proposals.create.roiSheet') : null,
  ].filter((v): v is string => Boolean(v));

  async function handleSend() {
    if (!proposal?.clientEmail) return;
    setSending(true);
    try {
      await proposalsApi.send(proposal.id);
      toast.success(L.sent);
      refetch?.();
    } catch {
      toast.error(t('proposals.create.sendError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`${styles.container} ${onClose ? styles.isDrawerMode : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={onClose || (() => navigate(-1))}><ArrowLeft size={20} /></button>
          <div>
            <h1 className={styles.title}>{proposal.title}</h1>
            <span className={`${styles.statusBadge} ${styles[proposal.status.toLowerCase().replace(/ /g, '-')]}`}>
              {t(`proposals.status.${proposal.status.toLowerCase()}`, proposal.status)}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          {proposal.status === 'Draft' && proposal.clientEmail && (
            <Button variant="primary" onClick={handleSend} disabled={sending}>
              <PaperPlaneTilt size={16} style={{ marginRight: 6 }} /> {sending ? L.sending : L.send}
            </Button>
          )}
          <Button variant="outline" onClick={printProposal}><DownloadSimple size={16} style={{ marginRight: 6 }} /> {t('proposals.view.downloadPdf')}</Button>
        </div>
      </div>

      <div className={styles.content}>
        <Card className={styles.mainCard} data-print-root>
          <CardBody className={styles.digitalProposal}>
            <div className={styles.proposalHeader}>
              <div className={styles.brandLogo}><Buildings size={28} /><span>ProDuality</span></div>
              <div className={styles.proposalMeta}>
                <div>{t('proposals.view.preparedFor', { name: proposal.clientName })}</div>
                <div className={styles.metaDate}>{t('proposals.view.date', { date: new Date(proposal.createdAt).toLocaleDateString(dateLocale) })}</div>
              </div>
            </div>

            <div className={styles.proposalCover}>
              <img src={coverImage} alt="Cover" className={styles.coverImage} />
              <div className={styles.coverText} data-print-cover>
                <h2>{t('proposals.view.coverTag')}</h2>
                <h1>{proposal.projectName}</h1>
                {proposal.projectLocation && <p>{proposal.projectLocation}</p>}
              </div>
            </div>

            <div className={styles.proposalBody}>
              {(rows.length > 0 || unit.features || unit.description) && (
                <div className={styles.bodySection}>
                  <h3>{L.unitTitle}</h3>
                  {rows.length > 0 && (
                    <table className={styles.previewTable}><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
                  )}
                  {unit.features && <p style={{ marginTop: 8 }}><strong>{L.features}:</strong> {unit.features}</p>}
                  {unit.description && <p style={{ marginTop: 6, opacity: .85 }}>{unit.description}</p>}
                </div>
              )}

              <div className={styles.bodySection}>
                <h3>{t('proposals.view.financialSummary')}</h3>
                <div className={styles.financialSummary}>
                  {hasDiscount && (
                    <div className={styles.finBox}><span>{L.listPrice}</span>
                      <strong style={{ textDecoration: 'line-through', opacity: .7 }}>{formatMoney(proposal.listPrice!, currency)}</strong></div>
                  )}
                  {hasDiscount && <div className={styles.finBox}><span>{L.discount}</span><strong>%{proposal.discountPct}</strong></div>}
                  <div className={styles.finBox}>
                    <span>{hasDiscount ? L.discounted : t('proposals.view.totalInvestment')}</span>
                    <strong>{formatMoney(proposal.totalValue, currency)}</strong>
                  </div>
                </div>
              </div>

              {paymentPlan.length > 0 && (
                <div className={styles.bodySection}>
                  <h3>{t('proposals.view.paymentPlan')}</h3>
                  <table className={styles.previewTable}>
                    <thead><tr><th>{t('proposals.view.milestone')}</th><th>{t('proposals.view.percentage')}</th><th>{t('proposals.view.planDate')}</th></tr></thead>
                    <tbody>{paymentPlan.map((row, idx) => (
                      <tr key={idx}><td>{row.milestone}</td><td>{row.percentage}%</td><td>{row.date}</td></tr>
                    ))}</tbody>
                  </table>
                  {proposal.paymentPlanOnList && <p className={styles.metaDate}>{L.onList}</p>}
                </div>
              )}

              {roi && (
                <div className={styles.bodySection}>
                  <h3>{L.roiTitle}</h3>
                  <table className={styles.previewTable}>
                    <tbody>
                      <tr><td>{L.grossYield}</td><td>%{roi.grossYieldPct}</td></tr>
                      <tr><td>{L.netYield}</td><td>%{roi.netYieldPct}</td></tr>
                      <tr><td>{roi.years} · {L.totalNet}</td><td>{formatMoney(roi.totalNetCashflow, currency)}</td></tr>
                      <tr><td>{L.appr}</td><td>{formatMoney(roi.capitalAppreciation, currency)}</td></tr>
                      <tr><td><strong>{L.profit}</strong></td><td><strong>{formatMoney(roi.totalProfit, currency)}</strong></td></tr>
                      <tr><td><strong>{L.totalRoi}</strong></td><td><strong>%{roi.totalRoiPct}</strong></td></tr>
                      <tr><td>{L.annual}</td><td>%{roi.annualizedRoiPct}</td></tr>
                      <tr><td>{L.equity}</td><td>{roi.equityMultiple}x</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {proposal.notes && (
                <div className={styles.bodySection}><h3>Notlar</h3><p style={{ opacity: .85 }}>{proposal.notes}</p></div>
              )}

              {attachmentLabels.length > 0 && (
                <div className={styles.attachmentsSectionPreview}>
                  <h3>{t('proposals.view.includedAttachments')}</h3>
                  <div className={styles.attachmentPills}>
                    {attachmentLabels.map((label) => <div key={label} className={styles.pill}><PenNib size={14} /> {label}</div>)}
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <div className={styles.sidebar}>
          <Card>
            <CardHeader><h3 className={styles.cardTitle}>{t('proposals.view.analyticsTitle')}</h3></CardHeader>
            <CardBody>
              <ul className={styles.analyticsList}>
                <li><strong>{t('proposals.view.status')}:</strong> {t(`proposals.status.${proposal.status.toLowerCase()}`, proposal.status)}</li>
                <li><strong>{t('proposals.view.created')}:</strong> {new Date(proposal.createdAt).toLocaleString(dateLocale)}</li>
                {proposal.sentAt && <li><strong>{L.sentAt}:</strong> {new Date(proposal.sentAt).toLocaleString(dateLocale)}</li>}
                <li><strong>{t('proposals.view.totalViews')}:</strong> {proposal.viewCount}</li>
                {proposal.lastViewed && <li><strong>{t('proposals.view.lastViewedLabel')}:</strong> {new Date(proposal.lastViewed).toLocaleString(dateLocale)}</li>}
                {proposal.clientEmail && <li><strong>{L.recipient}:</strong> {proposal.clientEmail}</li>}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
