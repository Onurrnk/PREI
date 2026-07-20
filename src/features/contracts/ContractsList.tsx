import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '../../core/components/Card/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { FileText, DownloadSimple, Buildings, CalendarBlank, Percent, ShieldCheck, Scroll, Paperclip, Plus, PencilSimple } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import type { ContractDTO, ContractWriteInput, ProjectDTO, ClientDTO } from '../../core/types';
import { contractsApi, documentsApi, projectsApi, clientsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import styles from './Contracts.module.css';

const STATUS_KEY: Record<string, string> = {
  Active: 'active',
  Draft: 'draft',
  Expired: 'expired',
  Expiring: 'expiring',
  Terminated: 'terminated',
  Renewed: 'renewed',
};

// Görsel durum → ham enum (düzenleme formu ön-dolumu; 'Expiring' türetilmiştir).
const DISPLAY_TO_RAW: Record<string, string> = {
  Active: 'active', Expiring: 'active', Draft: 'draft',
  Expired: 'expired', Terminated: 'terminated', Renewed: 'renewed',
};

const CONTRACT_TYPES = ['sale', 'rental', 'pm', 'reservation'];
const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated', 'renewed'];
const CURRENCIES = ['EUR', 'USD', 'AED', 'GBP', 'TRY'];

interface ContractFormValue {
  contractType: string;
  status: string;
  propertyId: string;
  contactId: string;
  startDate: string;
  endDate: string;
  amount: string;
  currency: string;
  commission: string;
  legalEntity: string;
  paymentTerms: string;
}

const emptyForm: ContractFormValue = {
  contractType: 'sale', status: 'draft', propertyId: '', contactId: '',
  startDate: '', endDate: '', amount: '', currency: 'EUR',
  commission: '', legalEntity: '', paymentTerms: '',
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

  // Oluştur/düzenle formu — proje + müşteri seçicileri gerçek listelerden.
  const { data: projects } = useFetch<ProjectDTO[]>(() => projectsApi.list(), []);
  const { data: clients } = useFetch<ClientDTO[]>(() => clientsApi.list(), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractFormValue>(emptyForm);
  const [saving, setSaving] = useState(false);
  const patch = (p: Partial<ContractFormValue>) => setForm((f) => ({ ...f, ...p }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (c: ContractDTO) => {
    setEditingId(c.id);
    setForm({
      contractType: CONTRACT_TYPES.includes(c.contractType) ? c.contractType : 'sale',
      status: DISPLAY_TO_RAW[c.status] ?? 'draft',
      propertyId: c.propertyId ?? '',
      contactId: c.contactId ?? '',
      startDate: c.startDate ?? '',
      endDate: c.expiryDate ?? '',
      amount: c.amount != null ? String(c.amount) : '',
      currency: c.currency || 'EUR',
      commission: c.commission ?? '',
      legalEntity: c.legalEntity ?? '',
      paymentTerms: c.paymentTerms ?? '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    const payload: ContractWriteInput = {
      contractType: form.contractType,
      status: form.status,
      propertyId: form.propertyId || null,
      contactId: form.contactId || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      amount: form.amount.trim() ? Number(form.amount) : null,
      currency: form.currency,
      commission: form.commission.trim(),
      legalEntity: form.legalEntity.trim(),
      paymentTerms: form.paymentTerms.trim(),
    };
    setSaving(true);
    try {
      if (editingId) {
        await contractsApi.update(editingId, payload);
        toast.success(t('contracts.form.updated'));
      } else {
        await contractsApi.create(payload);
        toast.success(t('contracts.form.created'));
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('contracts.form.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

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
        <Button variant="primary" onClick={openCreate}>
          <Plus size={16} /> {t('contracts.form.addContract')}
        </Button>
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
          <Button variant="outline" onClick={openCreate} style={{ marginTop: 12 }}>
            <Plus size={16} /> {t('contracts.form.addContract')}
          </Button>
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
        footer={selectedContract ? (
          <Button variant="outline" onClick={() => { openEdit(selectedContract); setSelectedContractId(null); }}>
            <PencilSimple size={16} /> {t('contracts.form.editContract')}
          </Button>
        ) : undefined}
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

      {/* Create / Edit Contract Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? t('contracts.form.editContract') : t('contracts.form.addContract')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('contracts.form.save')}
            </Button>
          </>
        }
      >
        <FormRow>
          <Field label={t('contracts.form.contractType')}>
            <SelectMenu
              value={form.contractType}
              onChange={(v) => patch({ contractType: v })}
              options={CONTRACT_TYPES.map((v) => ({ value: v, label: t(`contracts.types.${v}`) }))}
            />
          </Field>
          <Field label={t('contracts.form.status')}>
            <SelectMenu
              value={form.status}
              onChange={(v) => patch({ status: v })}
              options={CONTRACT_STATUSES.map((v) => ({ value: v, label: t(`contracts.status.${v}`) }))}
            />
          </Field>
        </FormRow>

        <Field label={t('contracts.form.project')}>
          <SelectMenu
            value={form.propertyId}
            onChange={(v) => patch({ propertyId: v })}
            options={[
              { value: '', label: t('contracts.form.noProject') },
              ...(projects ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${p.developerName}` })),
            ]}
          />
        </Field>

        <Field label={t('contracts.form.client')}>
          <SelectMenu
            value={form.contactId}
            onChange={(v) => patch({ contactId: v })}
            options={[
              { value: '', label: t('contracts.form.noClient') },
              ...(clients ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Field>

        <FormRow>
          <Field label={t('contracts.form.startDate')}>
            <Input type="date" value={form.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
          </Field>
          <Field label={t('contracts.form.endDate')}>
            <Input type="date" value={form.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
          </Field>
        </FormRow>

        <FormRow>
          <Field label={t('contracts.form.amount')}>
            <Input type="number" min="0" value={form.amount} onChange={(e) => patch({ amount: e.target.value })} placeholder="0" />
          </Field>
          <Field label={t('contracts.form.currency')}>
            <SelectMenu
              value={form.currency}
              onChange={(v) => patch({ currency: v })}
              options={CURRENCIES.map((v) => ({ value: v, label: v }))}
            />
          </Field>
        </FormRow>

        <Field label={t('contracts.form.commission')}>
          <Input value={form.commission} onChange={(e) => patch({ commission: e.target.value })} placeholder={t('contracts.form.commissionPlaceholder')} />
        </Field>
        <Field label={t('contracts.form.legalEntity')}>
          <Input value={form.legalEntity} onChange={(e) => patch({ legalEntity: e.target.value })} />
        </Field>
        <Field label={t('contracts.form.paymentTerms')}>
          <Input value={form.paymentTerms} onChange={(e) => patch({ paymentTerms: e.target.value })} placeholder={t('contracts.form.paymentTermsPlaceholder')} />
        </Field>
      </Modal>

    </div>
  );
};
