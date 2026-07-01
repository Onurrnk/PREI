import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProposalDTO } from '../../core/types';
import { proposalsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, Search, FileSignature, Eye, Calendar, DollarSign } from 'lucide-react';
import styles from './ProposalsList.module.css';

import { ProposalView } from './ProposalView';

export const ProposalsList: React.FC = () => {
  const { data, loading } = useFetch<ProposalDTO[]>(() => proposalsApi.list(), []);
  const proposals = data ?? [];
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const navigate = useNavigate();

  // proposals loaded via useFetch above

  if (loading) return <div className={styles.loading}>Loading Proposals...</div>;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Proposal Center</h1>
          <p className={styles.subtitle}>Generate and track custom property pitches and financial offers</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <Search size={16} className={styles.searchIcon} />
            <input type="text" placeholder="Search proposals..." className={styles.searchInput} />
          </div>
          <Button variant="primary" onClick={() => navigate('/proposals/new')}><Plus size={16} /> Create Proposal</Button>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Draft</div>
          <div className={styles.statValue}>{proposals.filter(p => p.status === 'Draft').length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Sent / Viewed</div>
          <div className={styles.statValue}>{proposals.filter(p => p.status === 'Sent' || p.status === 'Viewed').length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Accepted</div>
          <div className={`${styles.statValue} ${styles.textSuccess}`}>{proposals.filter(p => p.status === 'Accepted').length}</div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Proposal Name</TableHeader>
              <TableHeader>Client</TableHeader>
              <TableHeader>Project</TableHeader>
              <TableHeader>Total Value</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Analytics</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {proposals.map(prop => (
              <TableRow key={prop.id} className={styles.clickableRow} onClick={() => setSelectedProposalId(prop.id)}>
                <TableCell>
                  <div className={styles.proposalNameCell}>
                    <FileSignature size={16} className={styles.iconMuted} />
                    <div className={styles.proposalInfo}>
                      <span className={styles.proposalTitle}>{prop.title}</span>
                      <span className={styles.proposalDate}><Calendar size={12}/> {prop.createdAt}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{prop.clientName}</TableCell>
                <TableCell>{prop.projectName}</TableCell>
                <TableCell style={{ fontWeight: 600 }}><DollarSign size={14} className={styles.iconMuted}/> {formatCurrency(prop.totalValue)}</TableCell>
                <TableCell>
                  <span className={`${styles.statusBadge} ${styles[prop.status.toLowerCase().replace(/ /g, '-')]}`}>
                    {prop.status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className={styles.analyticsCell}>
                    <Eye size={14} className={styles.iconMuted} /> 
                    <span>{prop.viewCount} views</span>
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
