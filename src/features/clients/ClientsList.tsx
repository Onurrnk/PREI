import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientDTO } from '../../core/types';
import { clientsApi, contactsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, DotsThree, FunnelSimple, DownloadSimple, MagnifyingGlass, CheckCircle, UploadSimple, UserCircle, Trash } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../core/components/Modal/Modal';
import { ClientForm, emptyClientForm, clientFormToPatch, type ClientFormValue } from './ClientForm';
import { ImportClients } from './ImportClients';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import { useAuth } from '../../core/auth/AuthContext';
import styles from './Clients.module.css';

type ModalKind = 'addClient' | 'import' | 'export' | 'filter' | 'rowActions' | null;

export const ClientsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data, loading, refetch } = useFetch<ClientDTO[]>(() => clientsApi.list(), []);
  const clients = data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  // Yeni kayıt formu = Profil Düzenle formu (ortak ClientForm — tutarlılık).
  const [form, setForm] = useState<ClientFormValue>(emptyClientForm);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const [showModal, setShowModal] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  // İşlemler menüsü artık gerçek aksiyon için id+ad taşır (yalnız ad değil).
  const [rowActionsFor, setRowActionsFor] = useState<{ id: string; name: string } | null>(null);
  const [deletingRow, setDeletingRow] = useState(false);

  const handleSaveClient = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error(t('clients.form.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      // Ad Soyad → son kelime soyad, kalanı ad (backend update ile aynı kural).
      const parts = name.split(/\s+/);
      const last_name = parts.length > 1 ? parts.pop() : undefined;
      const first_name = parts.join(' ') || name;

      const contact = await contactsApi.create({
        first_name,
        last_name,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });

      // Profil alanları (tip/bütçe/kriter/bölge…) → aynı PATCH sözleşmesi.
      await clientsApi.update(contact.id, clientFormToPatch(form) as Partial<ClientDTO>);

      toast.success(t('clients.clientSaved'));
      setShowModal(false);
      setForm(emptyClientForm);
      refetch();
    } catch (e) {
      toast.error(`${t('clients.saveError')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleActionClick = (kind: ModalKind, row?: { id: string; name: string }) => {
    setModalKind(kind);
    if (row) setRowActionsFor(row);
    setShowModal(true);
  };

  // İşlemler menüsü: kalıcı sil (super_admin). Müşteri kartını açmak için
  // satıra tıklamak zaten yeterli; menü "tehlikeli" aksiyonu barındırır.
  const canDelete = user?.role === 'super_admin';
  const handleDeleteRow = async () => {
    if (!rowActionsFor) return;
    setDeletingRow(true);
    try {
      await clientsApi.remove(rowActionsFor.id);
      toast.success(t('clients.deleted', { name: rowActionsFor.name }));
      setShowModal(false);
      setRowActionsFor(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingRow(false);
    }
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
    : modalKind === 'import' ? t('clients.import.title')
    : modalKind === 'export' ? t('clients.export')
    : modalKind === 'filter' ? t('clients.filter')
    : modalKind === 'rowActions' ? (rowActionsFor?.name ?? '')
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
          <Button variant="outline" onClick={() => handleActionClick('import')}><UploadSimple size={16} /> {t('clients.import.open')}</Button>
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
                        handleActionClick('rowActions', { id: client.id, name: client.name });
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
        size={modalKind === 'addClient' || modalKind === 'import' ? 'lg' : 'md'}
        footer={
          // İçe aktarımda tek düğme: "Önizle"/"İçe aktar" bileşenin kendi
          // içinde. Altta ikinci bir birincil düğme hangisinin yazdığını
          // belirsizleştirirdi.
          modalKind === 'import' ? (
            <Button variant="outline" onClick={() => setShowModal(false)}>
              {t('clients.close')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowModal(false)}>{t('clients.cancel')}</Button>
              <Button
                variant="primary"
                disabled={modalKind === 'addClient' && saving}
                onClick={() => {
                  if (modalKind === 'addClient') {
                    void handleSaveClient();
                  } else {
                    setShowModal(false);
                  }
                }}
              >
                {modalKind === 'addClient' ? (saving ? t('clients.saving') : t('clients.saveClient')) : t('clients.close')}
              </Button>
            </>
          )
        }
      >
        {modalKind === 'addClient' && (
          <ClientForm value={form} onChange={setForm} duplicateCheck />
        )}
        {modalKind === 'import' && <ImportClients onImported={refetch} />}
        {modalKind === 'export' && (
          <div className={styles.exportState}>
            <CheckCircle size={40} weight="duotone" className={styles.exportIcon} />
            <p>{t('clients.exportStarted')}</p>
          </div>
        )}
        {modalKind === 'filter' && (
          <p className={styles.mutedText}>{t('clients.underDevelopment')}</p>
        )}
        {modalKind === 'rowActions' && rowActionsFor && (
          <div className={styles.rowActions}>
            <button
              className={styles.rowAction}
              onClick={() => { setShowModal(false); navigate(`/clients/${rowActionsFor.id}`); }}
            >
              <UserCircle size={18} /> {t('clients.actions.openProfile')}
            </button>
            {canDelete && (
              <button
                className={`${styles.rowAction} ${styles.rowActionDanger}`}
                onClick={handleDeleteRow}
                disabled={deletingRow}
              >
                <Trash size={18} /> {deletingRow ? t('clients.actions.deleting') : t('clients.actions.delete')}
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
