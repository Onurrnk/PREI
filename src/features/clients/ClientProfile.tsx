import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ClientDTO } from '../../core/types';
import { clientsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { EmailClient } from './components/EmailClient';
import { DocumentVault } from '../documents/DocumentVault';
import { Modal } from '../../core/components/Modal/Modal';
import { ArrowLeft, EnvelopeSimple, Phone, CalendarBlank, ChatCircle, FileText, MapPin, BuildingOffice, CurrencyDollar, FolderOpen } from '@phosphor-icons/react';
import styles from './ClientProfile.module.css';

export const ClientProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading } = useFetch<ClientDTO[]>(() => clientsApi.list(), [id]);
  const client = (data ?? []).find(c => c.id === id) ?? null;
  const [activeTab, setActiveTab] = useState<'communication' | 'vault'>('communication');
  
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityType, setActivityType] = useState<'Call' | 'Meeting' | 'Note'>('Note');
  const [activityNote, setActivityNote] = useState('');

  const toast = useToast();

  const handleActionClick = (actionName: string) => {
    if (actionName === 'View Contracts') {
      setActiveTab('vault');
      return;
    }
    if (actionName === 'Log Call') {
      setActivityType('Call');
      setShowActivityModal(true);
      return;
    }
    if (actionName === 'Schedule Meeting') {
      setActivityType('Meeting');
      setShowActivityModal(true);
      return;
    }
    if (actionName === 'Add Activity') {
      setActivityType('Note');
      setShowActivityModal(true);
      return;
    }
    toast.info(actionName);
  };

  const handleSaveActivity = () => {
    toast.success(`${activityType} kaydedildi`);
    setShowActivityModal(false);
    setActivityNote('');
  };

  if (loading) {
    return <div className={styles.loading}>Loading Profile...</div>;
  }

  if (!client) {
    return <div className={styles.error}>Client not found</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate('/clients')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className={styles.titleWrapper}>
              <h1 className={styles.title}>{client.name}</h1>
              <span className={`${styles.typeBadge} ${styles[client.type.toLowerCase()]}`}>{client.type}</span>
              <span className={`${styles.statusBadge} ${styles[client.relationshipStatus.toLowerCase()]}`}>
                {client.relationshipStatus}
              </span>
            </div>
            <p className={styles.subtitle}>ID: {client.clientId} &bull; {client.nationality} &bull; Acquired via: {client.source}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => handleActionClick('Send Email')}><EnvelopeSimple size={16} /> Email</Button>
          <Button variant="outline" onClick={() => handleActionClick('Log Call')}><Phone size={16} /> Call</Button>
          <Button variant="primary" onClick={() => handleActionClick('Edit Profile')}>Edit Profile</Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle}>Contact Details</h3>
            </CardHeader>
            <CardBody>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><EnvelopeSimple size={14} /></span>
                <span className={styles.detailValue}>{client.email}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Phone size={14} /></span>
                <span className={styles.detailValue}>{client.phone}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Assigned Consultant</span>
                <span className={styles.detailValue}>{client.assignedConsultant}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle}>Investment Overview</h3>
            </CardHeader>
            <CardBody>
              <div className={styles.kpiGrid}>
                <div className={styles.kpiBox}>
                  <CurrencyDollar size={16} className={styles.kpiIcon} />
                  <span className={styles.kpiLabel}>Total Value</span>
                  <span className={styles.kpiValue}>{formatCurrency(client.totalInvestment)}</span>
                </div>
                <div className={styles.kpiBox}>
                  <BuildingOffice size={16} className={styles.kpiIcon} />
                  <span className={styles.kpiLabel}>Properties</span>
                  <span className={styles.kpiValue}>{client.activeProperties} Active</span>
                </div>
              </div>
              
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Risk Profile</span>
                <span className={styles.detailValue}>{client.investmentProfile}</span>
              </div>
              
              <div className={styles.regionsContainer}>
                <span className={styles.detailLabel} style={{ marginBottom: '8px', display: 'block' }}>Preferred Regions</span>
                <div className={styles.regionsList}>
                  {client.preferredRegions.map((region, i) => (
                    <span key={i} className={styles.regionTag}><MapPin size={10} /> {region}</span>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={styles.quickActions}>
            <CardHeader>
              <h3 className={styles.cardTitle}>Quick Actions</h3>
            </CardHeader>
            <CardBody>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Schedule Meeting')}><CalendarBlank size={16} /> Schedule Meeting</Button>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Create Proposal')}><FileText size={16} /> Create Proposal</Button>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('View Contracts')}><FolderOpen size={16} /> View Client Vault</Button>
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'communication' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('communication')}
            >
              <ChatCircle size={16} /> Communication Center
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'vault' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('vault')}
            >
              <FolderOpen size={16} /> Client Document Vault
            </button>
          </div>

          {activeTab === 'communication' && (
            <>
              <Card className={styles.communicationCenter}>
                <CardHeader className={styles.commHeader}>
                  <h3 className={styles.cardTitle}>Communication Timeline</h3>
                  <div className={styles.commFilters}>
                    <button className={`${styles.filterBtn} ${styles.active}`} onClick={() => handleActionClick('Filter: All')}>All</button>
                    <button className={styles.filterBtn} onClick={() => handleActionClick('Filter: Emails')}>Emails</button>
                    <button className={styles.filterBtn} onClick={() => handleActionClick('Filter: Calls')}>Calls</button>
                  </div>
                </CardHeader>
                <CardBody className={styles.commBody}>
                  <div className={styles.timeline}>
                    <div className={styles.timelineItem}>
                      <div className={styles.timelineIcon}><EnvelopeSimple size={16} /></div>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <span className={styles.timelineTitle}>Email Sent: Property Portfolio Update</span>
                          <span className={styles.timelineDate}>Today, 10:30 AM</span>
                        </div>
                        <p className={styles.timelineText}>Sent the latest Dubai Marina off-plan portfolio PDF.</p>
                      </div>
                    </div>

                    <div className={styles.timelineItem}>
                      <div className={styles.timelineIcon}><Phone size={16} /></div>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <span className={styles.timelineTitle}>Call Logged: Initial Consultation</span>
                          <span className={styles.timelineDate}>Yesterday, 2:15 PM</span>
                        </div>
                        <p className={styles.timelineText}>Discussed requirements. Looking for 2BR in Downtown, budget $1.5M.</p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className={styles.emailCard}>
                <CardHeader>
                  <h3 className={styles.cardTitle}>Send Email</h3>
                </CardHeader>
                <CardBody>
                  <EmailClient clientEmail={client.email} clientName={client.name} />
                </CardBody>
              </Card>
            </>
          )}

          {activeTab === 'vault' && (
            <div className={styles.vaultTabWrapper}>
              <DocumentVault clientId={client.id} />
            </div>
          )}
        </div>
      </div>

      <Modal 
        isOpen={showActivityModal} 
        onClose={() => setShowActivityModal(false)}
        title={`New ${activityType}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowActivityModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveActivity}>Save {activityType}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {activityType} Details
            </label>
            <textarea 
              style={{ 
                width: '100%', 
                minHeight: '120px', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)', 
                backgroundColor: 'var(--bg-app)', 
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
              placeholder={`Enter notes for this ${activityType.toLowerCase()}...`}
              value={activityNote}
              onChange={(e) => setActivityNote(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
