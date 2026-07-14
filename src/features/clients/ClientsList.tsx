import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientDTO } from '../../core/types';
import { clientsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, DotsThree, FunnelSimple, DownloadSimple, MagnifyingGlass, CheckCircle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import styles from './Clients.module.css';

type ModalKind = 'addClient' | 'export' | 'filter' | 'rowActions' | null;

export const ClientsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { data, loading } = useFetch<ClientDTO[]>(() => clientsApi.list(), []);
  const clients = data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const [newClientType, setNewClientType] = useState('investor');
  const [newClientSource, setNewClientSource] = useState('website');
  const navigate = useNavigate();
  const toast = useToast();

  // clients loaded via useFetch above

  const [showModal, setShowModal] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [rowActionsFor, setRowActionsFor] = useState('');

  const handleActionClick = (kind: ModalKind, rowClientName?: string) => {
    setModalKind(kind);
    if (rowClientName) setRowActionsFor(rowClientName);
    setShowModal(true);
  };

  if (loading) {
    return <TableSkeleton rows={8} />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  };

  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  };

  const modalTitle = modalKind === 'addClient' ? t('clients.addClient')
    : modalKind === 'export' ? t('clients.export')
    : modalKind === 'filter' ? t('clients.filter')
    : modalKind === 'rowActions' ? rowActionsFor
    : '';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('clients.title')}</h1>
          <p className={styles.subtitle}>{t('clients.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t('clients.searchPlaceholder')}
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => handleActionClick('filter')}><FunnelSimple size={16} /> {t('clients.filter')}</Button>
          <Button variant="outline" onClick={() => handleActionClick('export')}><DownloadSimple size={16} /> {t('clients.export')}</Button>
          <Button variant="primary" onClick={() => handleActionClick('addClient')}><Plus size={16} /> {t('clients.addClient')}</Button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.scrollContainer}>
          <Table style={{ minWidth: '1600px' }}>
            <TableHead>
              <TableRow>
                <TableHeader>{t('clients.table.clientId')}</TableHeader>
                <TableHeader>{t('clients.table.clientName')}</TableHeader>
                <TableHeader>{t('clients.table.type')}</TableHeader>
                <TableHeader>{t('clients.table.nationality')}</TableHeader>
                <TableHeader>{t('clients.table.contactInfo')}</TableHeader>
                <TableHeader>{t('clients.table.totalInvestment')}</TableHeader>
                <TableHeader>{t('clients.table.properties')}</TableHeader>
                <TableHeader>{t('clients.table.preferredRegions')}</TableHeader>
                <TableHeader>{t('clients.table.profile')}</TableHeader>
                <TableHeader>{t('clients.table.assignedTo')}</TableHeader>
                <TableHeader>{t('clients.table.lastContact')}</TableHeader>
                <TableHeader>{t('clients.table.status')}</TableHeader>
                <TableHeader align="right">{t('clients.table.actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.filter(client =>
                client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                client.clientId.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(client => (
                <TableRow
                  key={client.id}
                  className={styles.clickableRow}
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <TableCell className={styles.cellId}>{client.clientId}</TableCell>
                  <TableCell style={{ fontWeight: 600 }}>{client.name}</TableCell>
                  <TableCell>
                    <span className={`${styles.typeBadge} ${styles[client.type.toLowerCase()]}`}>{client.type}</span>
                  </TableCell>
                  <TableCell>{client.nationality}</TableCell>
                  <TableCell>
                    <div className={styles.contactInfo}>
                      <span className={styles.email}>{client.email}</span>
                      <span className={styles.phone}>{client.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className={styles.numCell}>{formatCurrency(client.totalInvestment)}</span></TableCell>
                  <TableCell><span className={styles.numCell}>{client.activeProperties}</span></TableCell>
                  <TableCell>
                    <div className={styles.regionsList}>
                      {client.preferredRegions.map((region, i) => (
                        <span key={i} className={styles.regionTag}>{region}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{client.investmentProfile}</TableCell>
                  <TableCell>
                    <div className={styles.assignedUser}>
                      <div className={styles.userAvatar}>{client.assignedConsultant.charAt(0)}</div>
                      <span>{client.assignedConsultant}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(client.lastContactDate)}</TableCell>
                  <TableCell>
                    <span className={`${styles.statusBadge} ${styles[client.relationshipStatus.toLowerCase()]}`}>
                      {client.relationshipStatus}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <button
                      className={styles.moreButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionClick('rowActions', client.name);
                      }}
                    >
                      <DotsThree size={18} weight="bold" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalTitle}
        size={modalKind === 'addClient' ? 'lg' : 'md'}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>{t('clients.cancel')}</Button>
            <Button variant="primary" onClick={() => {
              if (modalKind === 'addClient') {
                toast.success(t('clients.clientSaved'));
              }
              setShowModal(false);
            }}>
              {modalKind === 'addClient' ? t('clients.saveClient') : t('clients.close')}
            </Button>
          </>
        }
      >
        {modalKind === 'addClient' && (
          <div className={styles.formStack}>
            <FormRow>
              <Field label={t('clients.form.fullName')}>
                <Input type="text" placeholder={t('clients.form.fullNamePh')} />
              </Field>
              <Field label={t('clients.form.nationality')}>
                <Input type="text" placeholder={t('clients.form.nationalityPh')} />
              </Field>
            </FormRow>

            <FormRow>
              <Field label={t('clients.form.email')}>
                <Input type="email" placeholder="beatriz.almeida@atlanticocapital.pt" />
              </Field>
              <Field label={t('clients.form.phone')}>
                <Input type="tel" placeholder="+351 912 384 706" />
              </Field>
            </FormRow>

            <FormRow>
              <Field label={t('clients.form.clientType')}>
                <SelectMenu
                  aria-label={t('clients.form.clientType')}
                  value={newClientType}
                  onChange={setNewClientType}
                  options={[
                    { value: 'investor', label: t('clients.form.types.investor') },
                    { value: 'end-user', label: t('clients.form.types.endUser') },
                    { value: 'corporate', label: t('clients.form.types.corporate') },
                  ]}
                />
              </Field>
              <Field label={t('clients.form.leadSource')}>
                <SelectMenu
                  aria-label={t('clients.form.leadSource')}
                  value={newClientSource}
                  onChange={setNewClientSource}
                  options={[
                    { value: 'website', label: t('clients.form.sources.website') },
                    { value: 'referral', label: t('clients.form.sources.referral') },
                    { value: 'event', label: t('clients.form.sources.event') },
                    { value: 'campaign', label: t('clients.form.sources.campaign') },
                  ]}
                />
              </Field>
            </FormRow>

            <Field label={t('clients.form.preferredRegions')}>
              <Input type="text" placeholder={t('clients.form.preferredRegionsPh')} />
            </Field>
          </div>
        )}
        {modalKind === 'export' && (
          <div className={styles.exportState}>
            <CheckCircle size={40} weight="duotone" className={styles.exportIcon} />
            <p>{t('clients.exportStarted')}</p>
          </div>
        )}
        {(modalKind === 'filter' || modalKind === 'rowActions') && (
          <p className={styles.mutedText}>{t('clients.underDevelopment')}</p>
        )}
      </Modal>
    </div>
  );
};
