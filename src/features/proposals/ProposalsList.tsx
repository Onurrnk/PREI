import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProposalDTO } from '../../core/types';
import { proposalsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, MagnifyingGlass, PenNib, Eye, CalendarBlank } from '@phosphor-icons/react';
import styles from './ProposalsList.module.css';

import { ProposalView } from './ProposalView';

export const ProposalsList: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading } = useFetch<ProposalDTO[]>(() => proposalsApi.list(), []);
  const proposals = data ?? [];
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const navigate = useNavigate();

  // proposals loaded via useFetch above

  if (loading) return <div className={styles.loading}>{t('proposals.loading')}</div>;

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('proposals.title')}</h1>
          <p className={styles.subtitle}>{t('proposals.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input type="text" placeholder={t('proposals.searchPlaceholder')} className={styles.searchInput} />
          </div>
          <Button variant="primary" onClick={() => navigate('/proposals/new')}><Plus size={16} /> {t('proposals.createProposal')}</Button>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t('proposals.stats.draft')}</div>
          <div className={styles.statValue}>{proposals.filter(p => p.status === 'Draft').length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t('proposals.stats.sentViewed')}</div>
          <div className={styles.statValue}>{proposals.filter(p => p.status === 'Sent' || p.status === 'Viewed').length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t('proposals.stats.accepted')}</div>
          <div className={`${styles.statValue} ${styles.textSuccess}`}>{proposals.filter(p => p.status === 'Accepted').length}</div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>{t('proposals.table.proposalName')}</TableHeader>
              <TableHeader>{t('proposals.table.client')}</TableHeader>
              <TableHeader>{t('proposals.table.project')}</TableHeader>
              <TableHeader>{t('proposals.table.totalValue')}</TableHeader>
              <TableHeader>{t('proposals.table.status')}</TableHeader>
              <TableHeader>{t('proposals.table.analytics')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {proposals.map(prop => (
              <TableRow key={prop.id} className={styles.clickableRow} onClick={() => setSelectedProposalId(prop.id)}>
                <TableCell>
                  <div className={styles.proposalNameCell}>
                    <PenNib size={16} className={styles.iconMuted} />
                    <div className={styles.proposalInfo}>
                      <span className={styles.proposalTitle}>{prop.title}</span>
                      <span className={styles.proposalDate}><CalendarBlank size={12}/> {prop.createdAt}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{prop.clientName}</TableCell>
                <TableCell>{prop.projectName}</TableCell>
                <TableCell style={{ fontWeight: 600 }}>{formatCurrency(prop.totalValue, prop.currency)}</TableCell>
                <TableCell>
                  <span className={`${styles.statusBadge} ${styles[prop.status.toLowerCase().replace(/ /g, '-')]}`}>
                    {prop.status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className={styles.analyticsCell}>
                    <Eye size={14} className={styles.iconMuted} />
                    <span>{t('proposals.viewsCount', { count: prop.viewCount })}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Slide-over Drawer for ProposalView */}
      {selectedProposalId && (
        <div className={styles.drawerOverlay} onClick={() => setSelectedProposalId(null)}>
          <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
            <ProposalView proposalId={selectedProposalId} onClose={() => setSelectedProposalId(null)} />
          </div>
        </div>
      )}
    </div>
  );
};
