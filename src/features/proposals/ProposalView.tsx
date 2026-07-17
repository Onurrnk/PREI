import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import type { ProposalDTO } from '../../core/types';
import { proposalsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, DownloadSimple, Buildings, PenNib } from '@phosphor-icons/react';
import { printProposal } from '../../core/utils/printProposal';
import styles from './ProposalView.module.css';

interface ProposalViewProps {
  proposalId?: string;
  onClose?: () => void;
}

export const ProposalView: React.FC<ProposalViewProps> = ({ proposalId, onClose }) => {
  const { t, i18n } = useTranslation();
  const { id: routeId } = useParams<{ id: string }>();
  const id = proposalId || routeId;
  const navigate = useNavigate();
  const { data, loading } = useFetch<ProposalDTO[]>(() => proposalsApi.list(), [id]);
  const proposal = (data ?? []).find(p => p.id === id) ?? null;

  // proposal resolved from the list via useFetch above

  if (loading) return <div className={styles.loading}>{t('proposals.view.loading')}</div>;
  if (!proposal) return <div className={styles.error}>{t('proposals.view.notFound')}</div>;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: proposal.currency || 'EUR', maximumFractionDigits: 0 }).format(value);
  };

  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';

  // metadata'dan gelen gerçek alanlar; eski kayıtlarda yoksa bölüm hiç çizilmez.
  const paymentPlan = proposal.paymentPlan ?? [];
  const attachmentLabels = [
    proposal.includeBrochurePdf ? t('proposals.create.brochurePdf') : null,
    proposal.includeFloorPlans ? t('proposals.create.floorPlansPdf') : null,
    proposal.includeRoiSheet ? t('proposals.create.roiSheet') : null,
  ].filter((v): v is string => Boolean(v));
  const coverImage = proposal.coverImage || '/images/exterior.png';

  return (
    <div className={`${styles.container} ${onClose ? styles.isDrawerMode : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={onClose || (() => navigate(-1))}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={styles.title}>{proposal.title}</h1>
            <span className={`${styles.statusBadge} ${styles[proposal.status.toLowerCase().replace(/ /g, '-')]}`}>
              {proposal.status}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={printProposal}><DownloadSimple size={16} style={{marginRight: 6}}/> {t('proposals.view.downloadPdf')}</Button>
        </div>
      </div>

      <div className={styles.content}>
        <Card className={styles.mainCard} data-print-root>
          <CardBody className={styles.digitalProposal}>
            <div className={styles.proposalHeader}>
              <div className={styles.brandLogo}>
                <Buildings size={28} />
                <span>ProDuality</span>
              </div>
              <div className={styles.proposalMeta}>
                <div>{t('proposals.view.preparedFor', { name: proposal.clientName })}</div>
                <div className={styles.metaDate}>{t('proposals.view.date', { date: proposal.createdAt })}</div>
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
              <div className={styles.bodySection}>
                <h3>{t('proposals.view.financialSummary')}</h3>
                <div className={styles.financialSummary}>
                  <div className={styles.finBox}>
                    <span>{t('proposals.view.totalInvestment')}</span>
                    <strong>{formatCurrency(proposal.totalValue)}</strong>
                  </div>
                </div>
              </div>

              {paymentPlan.length > 0 && (
                <div className={styles.bodySection}>
                  <h3>{t('proposals.view.paymentPlan')}</h3>
                  <table className={styles.previewTable}>
                    <thead>
                      <tr><th>{t('proposals.view.milestone')}</th><th>{t('proposals.view.percentage')}</th><th>{t('proposals.view.planDate')}</th></tr>
                    </thead>
                    <tbody>
                      {paymentPlan.map((row, idx) => (
                        <tr key={idx}><td>{row.milestone}</td><td>{row.percentage}%</td><td>{row.date}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {attachmentLabels.length > 0 && (
                <div className={styles.attachmentsSectionPreview}>
                  <h3>{t('proposals.view.includedAttachments')}</h3>
                  <div className={styles.attachmentPills}>
                    {attachmentLabels.map((label) => (
                      <div key={label} className={styles.pill}><PenNib size={14}/> {label}</div>
                    ))}
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
                <li><strong>{t('proposals.view.status')}:</strong> {proposal.status}</li>
                <li><strong>{t('proposals.view.created')}:</strong> {proposal.createdAt}</li>
                <li><strong>{t('proposals.view.totalViews')}:</strong> {proposal.viewCount}</li>
                {proposal.lastViewed && <li><strong>{t('proposals.view.lastViewedLabel')}:</strong> {new Date(proposal.lastViewed).toLocaleString(dateLocale)}</li>}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
