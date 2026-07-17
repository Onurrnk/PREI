import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '../../core/components/Card/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { FileText, DownloadSimple, Buildings, CalendarBlank, Percent, ShieldCheck, Scroll, Paperclip } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import type { ContractDTO } from '../../core/types';
import { contractsApi, documentsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import styles from './Contracts.module.css';

const STATUS_KEY: Record<string, string> = {
  Active: 'active',
  Draft: 'draft',
  Expired: 'expired',
  Expiring: 'expiring',
  Terminated: 'terminated',
};

export const ContractsList: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useFetch<ContractDTO[]>(() => contractsApi.list(), []);
  const contracts = data ?? [];
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const selectedContract = contracts.find((c) => c.id === selectedContractId) ?? null;
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const getStatusBadge = (status: string) => {
    const key = STATUS_KEY[status];
    const label = key ? t(`contracts.status.${key}`) : status;
    const cls = status === 'Active' ? styles.statusActive
      : status === 'Expiring' ? styles.statusExpiring
      : status === 'Expired' ? styles.statusExpired
      : '';
    return <span className={`${styles.statusBadge} ${cls}`}>{label}</span>;
  };

  const handleDownload = async (docId: string) => {
    try {
      const { url } = await documentsApi.downloadUrl(docId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('contracts.downloadFailed'));
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedContractId) return;
    setIsUploading(true);
    try {
      await documentsApi.upload(file, 'Contracts', 'contract', selectedContractId);
      toast.success(t('contracts.uploadedToast', { name: file.name }));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('contracts.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('contracts.title')}</h1>
          <p className={styles.subtitle}>{t('contracts.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <div className={styles.errorState}>{t('contracts.loadFailed', { error })}</div>
      ) : contracts.length === 0 ? (
        <div className={styles.emptyState}>
          <Scroll size={40} weight="thin" />
          <h3>{t('contracts.emptyTitle')}</h3>
          <p>{t('contracts.emptyBody')}</p>
        </div>
      ) : (
        <Card>
          <CardBody padding="none">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>{t('contracts.table.developer')}</TableHeader>
                  <TableHeader>{t('contracts.table.associatedProject')}</TableHeader>
                  <TableHeader>{t('contracts.table.status')}</TableHeader>
                  <TableHeader>{t('contracts.table.commission')}</TableHeader>
                  <TableHeader>{t('contracts.table.expiryDate')}</TableHeader>
                  <TableHeader>{t('contracts.table.actions')}</TableHeader>
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
                      <Button variant="ghost" size="sm" onClick={() => setSelectedContractId(contract.id)}>
                        {t('contracts.viewDetails')}
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
        onClose={() => setSelectedContractId(null)}
        title={selectedContract ? t('contracts.agreementTitle', { developer: selectedContract.developer }) : ''}
        size="lg"
      >
        {selectedContract && (
          <div className={styles.modalStack}>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><Buildings size={12} /> {t('contracts.detail.legalEntity')}</span>
                <span className={styles.detailValue}>{selectedContract.legalEntity || '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><ShieldCheck size={12} /> {t('contracts.detail.status')}</span>
                <span className={styles.detailValue}>{getStatusBadge(selectedContract.status)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><CalendarBlank size={12} /> {t('contracts.detail.validFrom')}</span>
                <span className={`${styles.detailValue} ${styles.numCell}`}>{selectedContract.startDate ?? '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><CalendarBlank size={12} /> {t('contracts.detail.validTo')}</span>
                <span className={`${styles.detailValue} ${styles.numCell}`}>{selectedContract.expiryDate ?? '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}><Percent size={12} /> {t('contracts.detail.commissionRate')}</span>
                <span className={`${styles.detailValue} ${styles.numCell}`}>{selectedContract.commission || '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('contracts.detail.paymentTerms')}</span>
                <span className={styles.detailValue}>{selectedContract.paymentTerms || '—'}</span>
              </div>
            </div>

            <div>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <FileText size={18} /> {t('contracts.attachedDocuments')}
                </h3>
                <Button variant="outline" size="sm" onClick={handleUploadClick} disabled={isUploading}>
                  <Paperclip size={16} /> {isUploading ? t('common.saving') : t('contracts.attachDocument')}
                </Button>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelected} />
              </div>
              <div className={styles.documentsList}>
                {selectedContract.documents.length === 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>{t('contracts.noDocuments')}</span>
                )}
                {selectedContract.documents.map(doc => (
                  <div key={doc.id} className={styles.documentItem}>
                    <div className={styles.documentInfo}>
                      <div className={styles.documentIcon}>
                        <FileText size={22} />
                      </div>
                      <div>
                        <div className={styles.documentName}>{doc.name}</div>
                        <div className={styles.documentSize}>{doc.size}</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleDownload(doc.id)}>
                      <DownloadSimple size={16} /> {t('contracts.download')}
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
