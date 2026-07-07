import React, { useState } from 'react';
import type { ClientDTO } from '../../core/types';
import { clientsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, DotsThree, FunnelSimple, DownloadSimple, MagnifyingGlass, CheckCircle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, Select, FormRow } from '../../core/components/Form/Form';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import styles from './Clients.module.css';

export const ClientsList: React.FC = () => {
  const { data, loading } = useFetch<ClientDTO[]>(() => clientsApi.list(), []);
  const clients = data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  // clients loaded via useFetch above

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);

  const handleActionClick = (actionName: string) => {
    setModalTitle(actionName);
    if (actionName === 'Add New Client') {
      setModalContent(
        <div className={styles.formStack}>
          <FormRow>
            <Field label="Full Name">
              <Input type="text" placeholder="e.g. Beatriz Almeida" />
            </Field>
            <Field label="Nationality">
              <Input type="text" placeholder="e.g. Portuguese" />
            </Field>
          </FormRow>

          <FormRow>
            <Field label="Email Address">
              <Input type="email" placeholder="beatriz.almeida@atlanticocapital.pt" />
            </Field>
            <Field label="Phone Number">
              <Input type="tel" placeholder="+351 912 384 706" />
            </Field>
          </FormRow>

          <FormRow>
            <Field label="Client Type">
              <Select defaultValue="investor">
                <option value="investor">Investor</option>
                <option value="end-user">End-User</option>
                <option value="corporate">Corporate</option>
              </Select>
            </Field>
            <Field label="Lead Source">
              <Select defaultValue="website">
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="event">Event / Exhibition</option>
                <option value="campaign">Marketing Campaign</option>
              </Select>
            </Field>
          </FormRow>

          <Field label="Preferred Regions">
            <Input type="text" placeholder="e.g. Downtown Dubai, Palm Jumeirah" />
          </Field>
        </div>
      );
    } else if (actionName.includes('Export')) {
      setModalContent(
        <div className={styles.exportState}>
          <CheckCircle size={40} weight="duotone" className={styles.exportIcon} />
          <p>Data export has started and will be downloaded shortly.</p>
        </div>
      );
    } else {
      setModalContent(<p className={styles.mutedText}>This feature is under development.</p>);
    }
    setShowModal(true);
  };

  if (loading) {
    return <TableSkeleton rows={8} />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Client Directory</h1>
          <p className={styles.subtitle}>Enterprise CRM and relationship management</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search clients, IDs, or emails..." 
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => handleActionClick('Filter Clients')}><FunnelSimple size={16} /> Filter</Button>
          <Button variant="outline" onClick={() => handleActionClick('Export Data (CSV/Excel)')}><DownloadSimple size={16} /> Export</Button>
          <Button variant="primary" onClick={() => handleActionClick('Add New Client')}><Plus size={16} /> Add Client</Button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.scrollContainer}>
          <Table style={{ minWidth: '1600px' }}>
            <TableHead>
              <TableRow>
                <TableHeader>Client ID</TableHeader>
                <TableHeader>Client Name</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Nationality</TableHeader>
                <TableHeader>Contact Info</TableHeader>
                <TableHeader>Total Investment</TableHeader>
                <TableHeader>Properties</TableHeader>
                <TableHeader>Preferred Regions</TableHeader>
                <TableHeader>Profile</TableHeader>
                <TableHeader>Assigned To</TableHeader>
                <TableHeader>Last Contact</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader align="right">Actions</TableHeader>
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
                        handleActionClick(`Row Actions for ${client.name}`);
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
        size={modalTitle === 'Add New Client' ? 'lg' : 'md'}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              if (modalTitle === 'Add New Client') {
                toast.success("Müşteri kaydedildi");
              }
              setShowModal(false);
            }}>
              {modalTitle === 'Add New Client' ? 'Save Client' : 'Close'}
            </Button>
          </>
        }
      >
        {modalContent}
      </Modal>
    </div>
  );
};
