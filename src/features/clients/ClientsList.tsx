import React, { useState } from 'react';
import type { ClientDTO } from '../../core/types';
import { clientsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, MoreHorizontal, Filter, Download, Search, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../core/components/Modal/Modal';
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Full Name</label>
              <input type="text" placeholder="e.g. Elena Rodriguez" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Nationality</label>
              <input type="text" placeholder="e.g. Spanish" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email Address</label>
              <input type="email" placeholder="elena@example.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone Number</label>
              <input type="tel" placeholder="+34 600 123 456" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Client Type</label>
              <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                <option value="investor">Investor</option>
                <option value="end-user">End-User</option>
                <option value="corporate">Corporate</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Lead Source</label>
              <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="event">Event / Exhibition</option>
                <option value="campaign">Marketing Campaign</option>
              </select>
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Preferred Regions</label>
            <input type="text" placeholder="e.g. Downtown Dubai, Palm Jumeirah" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
          </div>
        </div>
      );
    } else if (actionName.includes('Export')) {
      setModalContent(
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <CheckCircle2 size={48} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Data export has started and will be downloaded shortly.</p>
        </div>
      );
    } else {
      setModalContent(<p style={{color: 'var(--text-secondary)'}}>This feature is under development.</p>);
    }
    setShowModal(true);
  };

  if (loading) {
    return <div className={styles.loading}>Loading Clients...</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
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
            <Search size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search clients, IDs, or emails..." 
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => handleActionClick('Filter Clients')}><Filter size={16} /> Filter</Button>
          <Button variant="outline" onClick={() => handleActionClick('Export Data (CSV/Excel)')}><Download size={16} /> Export</Button>
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
                  <TableCell style={{ fontWeight: 600 }}>{formatCurrency(client.totalInvestment)}</TableCell>
                  <TableCell>{client.activeProperties}</TableCell>
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
                      <MoreHorizontal size={16} />
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
