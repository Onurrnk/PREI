// =====================================================================
// PREI | Teklif Görüntüleme — premium açık teklif belgesi (ProposalDocument)
// + yan panelde takip (durum/görüntülenme/gönderim) + taslakta "Mail Gönder"
// + "PDF İndir" (window.print). Belge = önizleme = PDF (tek bileşen).
// =====================================================================
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import type { ProposalDTO } from '../../core/types';
import { proposalsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, DownloadSimple, PaperPlaneTilt } from '@phosphor-icons/react';
import { printProposal } from '../../core/utils/printProposal';
import { ProposalDocument, type ProposalDocData } from './ProposalDocument';
import styles from './ProposalView.module.css';

interface ProposalViewProps {
  proposalId?: string;
  onClose?: () => void;
}

const STATUS_TR: Record<string, { tr: string; en: string }> = {
  Draft: { tr: 'Taslak', en: 'Draft' }, Sent: { tr: 'Gönderildi', en: 'Sent' },
  Viewed: { tr: 'Görüntülendi', en: 'Viewed' }, Accepted: { tr: 'Kabul Edildi', en: 'Accepted' },
  Rejected: { tr: 'Reddedildi', en: 'Rejected' },
};

export const ProposalView: React.FC<ProposalViewProps> = ({ proposalId, onClose }) => {
  const { t, i18n } = useTranslation();
  const tr = i18n.language === 'tr';
  const { id: routeId } = useParams<{ id: string }>();
  const id = proposalId || routeId;
  const navigate = useNavigate();
  const toast = useToast();
  const { data: proposal, loading, refetch } = useFetch<ProposalDTO>(() => proposalsApi.get(id!), [id]);
  const [sending, setSending] = React.useState(false);

  if (loading) return <div className={styles.loading}>{t('proposals.view.loading')}</div>;
  if (!proposal) return <div className={styles.error}>{t('proposals.view.notFound')}</div>;

  const dateLocale = tr ? 'tr-TR' : 'en-GB';
  const status = STATUS_TR[proposal.status] ? (tr ? STATUS_TR[proposal.status].tr : STATUS_TR[proposal.status].en) : proposal.status;

  const doc: ProposalDocData = {
    title: proposal.title,
    clientName: proposal.clientName,
    projectName: proposal.projectName,
    projectLocation: proposal.projectLocation,
    date: new Date(proposal.createdAt).toLocaleDateString(dateLocale),
    currency: proposal.currency || 'EUR',
    coverImage: proposal.coverImage,
    unit: proposal.unit,
    listPrice: proposal.listPrice,
    discountPct: proposal.discountPct,
    totalValue: proposal.totalValue,
    paymentPlan: proposal.paymentPlan,
    paymentPlanOnList: proposal.paymentPlanOnList,
    roi: proposal.roi,
    notes: proposal.notes,
    lang: tr ? 'tr' : 'en',
  };

  async function handleSend() {
    if (!proposal?.clientEmail) return;
    setSending(true);
    try {
      await proposalsApi.send(proposal.id);
      toast.success(tr ? 'Teklif müşteriye gönderildi.' : 'Proposal sent to the client.');
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
            <span className={`${styles.statusBadge} ${styles[proposal.status.toLowerCase().replace(/ /g, '-')]}`}>{status}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          {proposal.status === 'Draft' && proposal.clientEmail && (
            <Button variant="primary" onClick={handleSend} disabled={sending}>
              <PaperPlaneTilt size={16} style={{ marginRight: 6 }} /> {sending ? (tr ? 'Gönderiliyor…' : 'Sending…') : (tr ? 'Mail Gönder' : 'Send Email')}
            </Button>
          )}
          <Button variant="outline" onClick={printProposal}><DownloadSimple size={16} style={{ marginRight: 6 }} /> {t('proposals.view.downloadPdf')}</Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.docCol}>
          <ProposalDocument doc={doc} />
        </div>

        <div className={styles.sidebar}>
          <Card>
            <CardHeader><h3 className={styles.cardTitle}>{t('proposals.view.analyticsTitle')}</h3></CardHeader>
            <CardBody>
              <ul className={styles.analyticsList}>
                <li><strong>{t('proposals.view.status')}:</strong> {status}</li>
                <li><strong>{t('proposals.view.created')}:</strong> {new Date(proposal.createdAt).toLocaleString(dateLocale)}</li>
                {proposal.sentAt && <li><strong>{tr ? 'Gönderildi' : 'Sent'}:</strong> {new Date(proposal.sentAt).toLocaleString(dateLocale)}</li>}
                <li><strong>{t('proposals.view.totalViews')}:</strong> {proposal.viewCount}</li>
                {proposal.lastViewed && <li><strong>{t('proposals.view.lastViewedLabel')}:</strong> {new Date(proposal.lastViewed).toLocaleString(dateLocale)}</li>}
                {proposal.clientEmail && <li><strong>{tr ? 'Alıcı' : 'Recipient'}:</strong> {proposal.clientEmail}</li>}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
