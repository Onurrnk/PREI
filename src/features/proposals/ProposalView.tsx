import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ProposalDTO } from '../../core/types';
import { proposalsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, DownloadSimple, Buildings, PenNib } from '@phosphor-icons/react';
import styles from './ProposalView.module.css';

interface ProposalViewProps {
  proposalId?: string;
  onClose?: () => void;
}

export const ProposalView: React.FC<ProposalViewProps> = ({ proposalId, onClose }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const id = proposalId || routeId;
  const navigate = useNavigate();
  const { data, loading } = useFetch<ProposalDTO[]>(() => proposalsApi.list(), [id]);
  const proposal = (data ?? []).find(p => p.id === id) ?? null;

  // proposal resolved from the list via useFetch above

  if (loading) return <div className={styles.loading}>Loading Proposal...</div>;
  if (!proposal) return <div className={styles.error}>Proposal not found</div>;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className={`${styles.container} ${onClose ? styles.isDrawerMode : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={onClose || (() => navigate(-1))}>
            {onClose ? <ArrowLeft size={20} /> : <ArrowLeft size={20} />}
          </button>
          <div>
            <h1 className={styles.title}>{proposal.title}</h1>
            <span className={`${styles.statusBadge} ${styles[proposal.status.toLowerCase().replace(/ /g, '-')]}`}>
              {proposal.status}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline"><DownloadSimple size={16} style={{marginRight: 6}}/> Download PDF</Button>
        </div>
      </div>

      <div className={styles.content}>
        <Card className={styles.mainCard}>
          <CardBody className={styles.digitalProposal}>
            <div className={styles.proposalHeader}>
              <div className={styles.brandLogo}>
                <Buildings size={28} />
                <span>ProDuality</span>
              </div>
              <div className={styles.proposalMeta}>
                <div>Prepared for: <strong>{proposal.clientName}</strong></div>
                <div>Date: {proposal.createdAt}</div>
              </div>
            </div>
            
            <div className={styles.proposalCover}>
              <img src="/images/exterior.png" alt="Cover" className={styles.coverImage} />
              <div className={styles.coverText}>
                <h2>Exclusive Investment Opportunity</h2>
                <h1>{proposal.projectName}</h1>
                <p>Dubai Marina</p>
              </div>
            </div>

            <div className={styles.proposalBody}>
              <div className={styles.bodySection}>
                <h3>Financial Summary</h3>
                <div className={styles.financialSummary}>
                  <div className={styles.finBox}>
                    <span>Total Investment</span>
                    <strong>{formatCurrency(proposal.totalValue)}</strong>
                  </div>
                  <div className={styles.finBox}>
                    <span>Expected ROI</span>
                    <strong>7.5% p.a.</strong>
                  </div>
                </div>
              </div>

              <div className={styles.bodySection}>
                <h3>Proposed Payment Plan</h3>
                <table className={styles.previewTable}>
                  <thead>
                    <tr><th>Milestone</th><th>Percentage</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Down Payment</td><td>20%</td><td>On Booking</td></tr>
                    <tr><td>During Construction</td><td>40%</td><td>Across 2 Years</td></tr>
                    <tr><td>On Handover</td><td>40%</td><td>Q4 2027</td></tr>
                  </tbody>
                </table>
              </div>
              
              <div className={styles.attachmentsSectionPreview}>
                <h3>Included Attachments</h3>
                <div className={styles.attachmentPills}>
                  <div className={styles.pill}><PenNib size={14}/> Project_Brochure.pdf</div>
                  <div className={styles.pill}><PenNib size={14}/> Floor_Plans.pdf</div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className={styles.sidebar}>
          <Card>
            <CardHeader><h3 className={styles.cardTitle}>Proposal Analytics</h3></CardHeader>
            <CardBody>
              <ul className={styles.analyticsList}>
                <li><strong>Status:</strong> {proposal.status}</li>
                <li><strong>Created:</strong> {proposal.createdAt}</li>
                <li><strong>Total Views:</strong> {proposal.viewCount}</li>
                {proposal.lastViewed && <li><strong>Last Viewed:</strong> {new Date(proposal.lastViewed).toLocaleString()}</li>}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
