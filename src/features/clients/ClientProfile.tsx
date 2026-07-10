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
import { ArrowLeft, EnvelopeSimple, Phone, CalendarBlank, ChatCircle, FileText, MapPin, BuildingOffice, CurrencyDollar, FolderOpen, WhatsappLogo, PencilSimple } from '@phosphor-icons/react';
import { Field, Textarea } from '../../core/components/Form/Form';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import styles from './ClientProfile.module.css';

// ---------------------------------------------------------------------
// Mock iletişim zaman çizelgesi — Faz 1-2'de communications tablosuna bağlanır.
// WhatsApp kayıtları Eylül'ün qualification skorunu taşır.
// ---------------------------------------------------------------------
type TimelineKind = 'email' | 'call' | 'whatsapp' | 'meeting';

interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  title: string;
  body: string;
  time: string;
  score?: number; // Eylül qualification skoru (yalnız whatsapp)
}

const timelineEntries: TimelineEntry[] = [
  { id: 'tl1', kind: 'whatsapp', title: 'WhatsApp · Eylül qualified the lead', body: '"Golden Visa için minimum yatırım tutarını teyit edebilir misiniz?" Score reached 85, Calendly link sent.', time: '12m', score: 85 },
  { id: 'tl2', kind: 'email', title: 'Email sent: Property Portfolio Update', body: 'Latest Dubai Marina off-plan portfolio PDF shared (4 units, Q4 2027 handover).', time: '2h' },
  { id: 'tl3', kind: 'call', title: 'Call logged: Payment plan review', body: '18 min. Prefers 60/40 construction-linked plan; asked for Nişantaşı comparison.', time: '1d' },
  { id: 'tl4', kind: 'meeting', title: 'Meeting: Marina Vista 2B viewing', body: 'On-site viewing completed. Strong interest; requested SPA draft within the week.', time: '3d' },
  { id: 'tl5', kind: 'whatsapp', title: 'WhatsApp · First contact via CTWA ad', body: 'Arrived from "Golden Visa · Dubai Off-Plan (TR)" campaign. Eylül opened conversation.', time: '6d', score: 25 },
];

const TIMELINE_ICON: Record<TimelineKind, React.ReactNode> = {
  email: <EnvelopeSimple size={16} />,
  call: <Phone size={16} />,
  whatsapp: <WhatsappLogo size={16} />,
  meeting: <CalendarBlank size={16} />,
};

const FILTERS: Array<{ key: 'all' | TimelineKind; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Emails' },
  { key: 'call', label: 'Calls' },
  { key: 'meeting', label: 'Meetings' },
];

// Satır-içi düzenlenebilir metin: hover'da kalem, Enter/blur kaydeder, Esc iptal.
// Mock-persist (local state) — gerçek PATCH FAZ 1 create-edit işinde bağlanır.
const InlineText: React.FC<{
  value: string;
  onSave: (v: string) => void;
  ariaLabel: string;
  type?: string;
}> = ({ value, onSave, ariaLabel, type = 'text' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span className={styles.inlineWrap}>
        <span className={styles.detailValue}>{value}</span>
        <button
          type="button"
          className={styles.inlineEditBtn}
          aria-label={`Edit ${ariaLabel}`}
          onClick={() => { setDraft(value); setEditing(true); }}
        >
          <PencilSimple size={12} />
        </button>
      </span>
    );
  }
  return (
    <input
      autoFocus
      type={type}
      className={styles.inlineInput}
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); const v = draft.trim(); if (v && v !== value) onSave(v); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      }}
    />
  );
};

export const ClientProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading } = useFetch<ClientDTO[]>(() => clientsApi.list(), [id]);
  const fetched = (data ?? []).find(c => c.id === id) ?? null;
  // Satır-içi düzenlemeler (mock-persist): fetch edilen kaydın üstüne bindirilir.
  const [overrides, setOverrides] = useState<Partial<ClientDTO>>({});
  const client = fetched ? { ...fetched, ...overrides } : null;
  const [newRegion, setNewRegion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'communication' | 'vault'>('communication');
  const [timelineFilter, setTimelineFilter] = useState<'all' | TimelineKind>('all');

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
    return <TableSkeleton rows={6} />;
  }

  if (!client) {
    return <div className={styles.error}>Client not found</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate('/clients')}>
            <ArrowLeft size={20} />
          </button>
          <div className={styles.avatar}>
            {client.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
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
          {/* DS §5.4: sayfada tek primary — vault sekmesindeki Upload File primary kalır */}
          <Button variant="secondary" onClick={() => handleActionClick('Edit Profile')}><PencilSimple size={16} /> Edit Profile</Button>
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
                <InlineText
                  value={client.email}
                  type="email"
                  ariaLabel="email"
                  onSave={(v) => { setOverrides(o => ({ ...o, email: v })); toast.success('Email updated'); }}
                />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Phone size={14} /></span>
                <InlineText
                  value={client.phone}
                  type="tel"
                  ariaLabel="phone"
                  onSave={(v) => { setOverrides(o => ({ ...o, phone: v })); toast.success('Phone updated'); }}
                />
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
                <InlineText
                  value={client.investmentProfile}
                  ariaLabel="risk profile"
                  onSave={(v) => { setOverrides(o => ({ ...o, investmentProfile: v })); toast.success('Risk profile updated'); }}
                />
              </div>

              <div className={styles.regionsContainer}>
                <span className={styles.detailLabel} style={{ marginBottom: '8px', display: 'block' }}>Preferred Regions</span>
                <div className={styles.regionsList}>
                  {client.preferredRegions.map((region) => (
                    <span key={region} className={styles.regionTag}>
                      <MapPin size={10} /> {region}
                      <button
                        type="button"
                        className={styles.regionRemove}
                        aria-label={`Remove ${region}`}
                        onClick={() => {
                          setOverrides(o => ({ ...o, preferredRegions: client.preferredRegions.filter(r => r !== region) }));
                          toast.success('Region removed');
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {newRegion === null ? (
                    <button type="button" className={styles.regionAdd} onClick={() => setNewRegion('')}>
                      + Add Region
                    </button>
                  ) : (
                    <input
                      autoFocus
                      className={styles.regionInput}
                      value={newRegion}
                      placeholder="e.g. Palm Jumeirah"
                      aria-label="new region"
                      onChange={(e) => setNewRegion(e.target.value)}
                      onBlur={() => setNewRegion(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setNewRegion(null);
                        if (e.key === 'Enter') {
                          const v = newRegion.trim();
                          if (v && !client.preferredRegions.includes(v)) {
                            setOverrides(o => ({ ...o, preferredRegions: [...client.preferredRegions, v] }));
                            toast.success('Region added');
                          }
                          setNewRegion(null);
                        }
                      }}
                    />
                  )}
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
                    {FILTERS.map((f) => (
                      <button
                        key={f.key}
                        className={`${styles.filterBtn} ${timelineFilter === f.key ? styles.active : ''}`}
                        onClick={() => setTimelineFilter(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardBody className={styles.commBody}>
                  <div className={styles.timeline}>
                    {timelineEntries
                      .filter((e) => timelineFilter === 'all' || e.kind === timelineFilter)
                      .map((entry) => (
                        <div key={entry.id} className={styles.timelineItem}>
                          <div className={`${styles.timelineIcon} ${styles[`kind_${entry.kind}`]}`}>
                            {TIMELINE_ICON[entry.kind]}
                          </div>
                          <div className={styles.timelineContent}>
                            <div className={styles.timelineHeader}>
                              <span className={styles.timelineTitle}>{entry.title}</span>
                              <span className={styles.timelineMeta}>
                                {entry.score !== undefined && (
                                  <span className={`${styles.scoreChip} ${entry.score >= 75 ? styles.scoreHigh : ''}`}>
                                    {entry.score}
                                  </span>
                                )}
                                <span className={styles.timelineDate}>{entry.time}</span>
                              </span>
                            </div>
                            <p className={styles.timelineText}>{entry.body}</p>
                          </div>
                        </div>
                      ))}
                    {timelineEntries.filter((e) => timelineFilter === 'all' || e.kind === timelineFilter).length === 0 && (
                      <div className={styles.timelineEmpty}>
                        <ChatCircle size={28} weight="duotone" />
                        <p>No records for this channel yet.</p>
                      </div>
                    )}
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
        <Field label={`${activityType} Details`}>
          <Textarea
            rows={5}
            placeholder={`Enter notes for this ${activityType.toLowerCase()}...`}
            value={activityNote}
            onChange={(e) => setActivityNote(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
};
