import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateDeveloperInput, DeveloperDTO } from '../../core/types';
import { developersApi } from '../../core/api/resources';
import { ApiError } from '../../core/api/client';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { Plus, DotsThree, DownloadSimple, MagnifyingGlass, Buildings, MapPin } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { ProjectsHubTabs } from '../projects/ProjectsHubTabs';
import styles from './Developers.module.css';

const EMPTY_FORM: CreateDeveloperInput = {
  name: '', tier: 'Boutique', headquarters: '', partnershipStatus: 'Active', commissionRate: '',
  keyContactName: '', keyContactEmail: '', keyContactPhone: '', website: '',
};

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const csvRow = (cells: (string | number)[]) => cells.map(csvCell).join(',') + '\n';

export const DevelopersList: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, refetch } = useFetch<DeveloperDTO[]>(() => developersApi.list(), []);
  const developers = data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const toast = useToast();

  const handleActionClick = (actionName: string) => {
    toast.info(actionName);
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<CreateDeveloperInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof CreateDeveloperInput>(key: K, value: CreateDeveloperInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const closeModal = () => {
    setShowAddModal(false);
    setForm(EMPTY_FORM);
  };

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error(t('developers.form.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await developersApi.create({ ...form, name });
      closeModal();
      refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('developers.form.createError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    let csv = csvRow(['Name', 'Tier', 'Headquarters', 'Partnership Status', 'Commission Rate', 'Active Projects', 'Completed Projects', 'Key Contact', 'Key Contact Email', 'Key Contact Phone', 'Website']);
    for (const dev of developers) {
      csv += csvRow([dev.name, dev.tier, dev.headquarters, dev.partnershipStatus, dev.commissionRate, dev.activeProjects, dev.totalCompletedProjects, dev.keyContactName, dev.keyContactEmail, dev.keyContactPhone, dev.website]);
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `developers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className={styles.loading}>{t('developers.loading')}</div>;
  }

  return (
    <div className={styles.container}>
      <ProjectsHubTabs />
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('developers.title')}</h1>
          <p className={styles.subtitle}>{t('developers.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t('developers.searchPlaceholder')}
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!data}><DownloadSimple size={16} /> {t('developers.export')}</Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}><Plus size={16} /> {t('developers.addDeveloper')}</Button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.scrollContainer}>
          <Table style={{ minWidth: '1200px' }}>
            <TableHead>
              <TableRow>
                <TableHeader>{t('developers.table.name')}</TableHeader>
                <TableHeader>{t('developers.table.tier')}</TableHeader>
                <TableHeader>{t('developers.table.headquarters')}</TableHeader>
                <TableHeader>{t('developers.table.portfolio')}</TableHeader>
                <TableHeader>{t('developers.table.partnershipStatus')}</TableHeader>
                <TableHeader>{t('developers.table.commission')}</TableHeader>
                <TableHeader>{t('developers.table.keyContact')}</TableHeader>
                <TableHeader align="right">{t('developers.table.actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {developers.filter(dev =>
                dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                dev.headquarters.toLowerCase().includes(searchQuery.toLowerCase()) ||
                dev.keyContactName.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(dev => (
                <TableRow key={dev.id} className={styles.clickableRow} onClick={() => navigate(`/developers/${dev.id}`)}>
                  <TableCell>
                    <div className={styles.developerNameCell}>
                      <div className={styles.developerAvatar}>
                        <Buildings size={16} />
                      </div>
                      <span className={styles.developerName}>{dev.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`${styles.tierBadge} ${styles[dev.tier.toLowerCase().replace(' ', '')]}`}>
                      {dev.tier}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className={styles.locationCell}>
                      <MapPin size={12} className={styles.iconMuted} />
                      {dev.headquarters}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.portfolioStats}>
                      <span className={styles.statActive} title={t('developers.activeProjects')}>{t('developers.activeCount', { count: dev.activeProjects })}</span>
                      <span className={styles.statTotal} title={t('developers.completed')}>{t('developers.completedCount', { count: dev.totalCompletedProjects })}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`${styles.statusBadge} ${styles[dev.partnershipStatus.toLowerCase()]}`}>
                      {dev.partnershipStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={styles.commissionRate}>{dev.commissionRate}</span>
                  </TableCell>
                  <TableCell>
                    <div className={styles.contactCell}>
                      <span className={styles.contactName}>{dev.keyContactName}</span>
                      <span className={styles.contactEmail}>{dev.keyContactEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <button
                      className={styles.moreButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionClick(`Options for ${dev.name}`);
                      }}
                    >
                      <DotsThree size={16} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={closeModal}
        title={t('developers.form.addTitle')}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? t('common.saving') : t('developers.form.create')}
            </Button>
          </>
        }
      >
        <div className={styles.formStack}>
          <FormRow>
            <Field label={t('developers.form.name')}>
              <Input type="text" placeholder={t('developers.form.namePh')}
                value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </Field>
            <Field label={t('developers.form.tier')}>
              <SelectMenu
                aria-label={t('developers.form.tier')}
                value={form.tier ?? 'Boutique'}
                onChange={(v) => setField('tier', v as DeveloperDTO['tier'])}
                options={[
                  { value: 'Tier 1', label: 'Tier 1' },
                  { value: 'Tier 2', label: 'Tier 2' },
                  { value: 'Boutique', label: 'Boutique' },
                ]}
              />
            </Field>
          </FormRow>

          <FormRow>
            <Field label={t('developers.form.headquarters')}>
              <Input type="text" placeholder={t('developers.form.headquartersPh')}
                value={form.headquarters} onChange={(e) => setField('headquarters', e.target.value)} />
            </Field>
            <Field label={t('developers.form.partnershipStatus')}>
              <SelectMenu
                aria-label={t('developers.form.partnershipStatus')}
                value={form.partnershipStatus ?? 'Active'}
                onChange={(v) => setField('partnershipStatus', v as DeveloperDTO['partnershipStatus'])}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Negotiating', label: 'Negotiating' },
                  { value: 'Inactive', label: 'Inactive' },
                ]}
              />
            </Field>
          </FormRow>

          <FormRow>
            <Field label={t('developers.form.commissionRate')}>
              <Input type="text" placeholder={t('developers.form.commissionRatePh')}
                value={form.commissionRate} onChange={(e) => setField('commissionRate', e.target.value)} />
            </Field>
            <Field label={t('developers.form.website')}>
              <Input type="text" placeholder={t('developers.form.websitePh')}
                value={form.website} onChange={(e) => setField('website', e.target.value)} />
            </Field>
          </FormRow>

          <FormRow>
            <Field label={t('developers.form.keyContactName')}>
              <Input type="text" placeholder={t('developers.form.keyContactNamePh')}
                value={form.keyContactName} onChange={(e) => setField('keyContactName', e.target.value)} />
            </Field>
            <Field label={t('developers.form.keyContactEmail')}>
              <Input type="email"
                value={form.keyContactEmail} onChange={(e) => setField('keyContactEmail', e.target.value)} />
            </Field>
          </FormRow>

          <Field label={t('developers.form.keyContactPhone')}>
            <Input type="tel"
              value={form.keyContactPhone} onChange={(e) => setField('keyContactPhone', e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
};
