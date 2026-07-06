import React, { useState } from 'react';
import { Card, CardBody } from '../../core/components/Card/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { FileText, DownloadSimple, Buildings, CalendarBlank, Percent, ShieldCheck, Scroll } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import type { ContractDTO } from '../../core/types';
import { contractsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import styles from './Contracts.module.css';

export const ContractsList: React.FC = () => {
  const { data, loading, error } = useFetch<ContractDTO[]>(() => contractsApi.list(), []);
  const contracts = data ?? [];
  const [selectedContract, setSelectedContract] = useState<ContractDTO | null>(null);
  const toast = useToast();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return <span className={`${styles.statusBadge} ${styles.statusActive}`}>Active</span>;
      case 'Expiring': return <span className={`${styles.statusBadge} ${styles.statusExpiring}`}>Expiring Soon</span>;
      case 'Expired': return <span className={`${styles.statusBadge} ${styles.statusExpired}`}>Expired</span>;
      default: return <span className={styles.statusBadge}>{status}</span>;
    }
  };

  const handleDownload = (docName: string) => {
    toast.info(`${docName} indiriliyor…`);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Developer Contracts</h1>
          <p className={styles.subtitle}>Manage agency agreements and commission structures.</p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <div className={styles.errorState}>Sözleşmeler yüklenemedi: {error}</div>
      ) : contracts.length === 0 ? (
        <div className={styles.emptyState}>
          <Scroll size={40} weight="thin" />
          <h3>Henüz sözleşme yok</h3>
          <p>Geliştirici acente anlaşmaları eklendiğinde burada görünecek.</p>
        </div>
      ) : (
        <Card>
          <CardBody padding="none">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Developer</TableHeader>
                  <TableHeader>Associated Project</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Commission</TableHeader>
                  <TableHeader>Expiry Date</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>{contract.developer}</TableCell>
                    <TableCell>{contract.project}</TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
                    <TableCell><span className={styles.numCell}>{contract.commission || '—'}</span></TableCell>
                    <TableCell><span className={styles.numCell}>{contract.expiryDate ?? '—'}</span></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedContract(contract)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      {/* Contract Details Modal */}
      <Modal
        isOpen={selectedContract !== null}
        onClose={() => setSelectedContract(null)}
        title={selectedContract ? `${selectedContract.developer} Agreement` : ''}
        size="lg"
      >
        {selectedContract && (
          <div className={styles.modalStack}>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><Buildings size={12} /> Legal Entity</span>
                <span className={styles.detailValue}>{selectedContract.legalEntity || '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><ShieldCheck size={12} /> Status</span>
                <span className={styles.detailValue}>{getStatusBadge(selectedContract.status)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><CalendarBlank size={12} /> Valid From</span>
                <span className={`${styles.detailValue} ${styles.numCell}`}>{selectedContract.startDate ?? '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><CalendarBlank size={12} /> Valid To (Expiry)</span>
                <span className={`${styles.detailValue} ${styles.numCell}`}>{selectedContract.expiryDate ?? '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><Percent size={12} /> Commission Rate</span>
                <span className={`${styles.detailValue} ${styles.numCell}`}>{selectedContract.commission || '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Payment Terms</span>
                <span className={styles.detailValue}>{selectedContract.paymentTerms || '—'}</span>
              </div>
            </div>

            <div>
              <h3 className={styles.sectionTitle}>
                <FileText size={18} /> Attached PDF Documents
              </h3>
              <div className={styles.documentsList}>
                {selectedContract.documents.length === 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>Ekli doküman yok.</span>
                )}
                {selectedContract.documents.map(doc => (
                  <div key={doc.id} className={styles.documentItem}>
                    <div className={styles.documentInfo}>
                      <div className={styles.documentIcon}>
                        <FileText size={22} />
                      </div>
                      <div>
                        <div className={styles.documentName}>{doc.name}</div>
                        <div className={styles.documentSize}>{doc.size} · PDF</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleDownload(doc.name)}>
                      <DownloadSimple size={16} /> Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
