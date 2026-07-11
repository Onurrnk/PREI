import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ClientDTO, ClientNoteDTO } from '../../core/types';
import { clientsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { EmailClient } from './components/EmailClient';
import { DocumentVault } from '../documents/DocumentVault';
import { Modal } from '../../core/components/Modal/Modal';
import { ArrowLeft, EnvelopeSimple, Phone, CalendarBlank, ChatCircle, FileText, MapPin, BuildingOffice, CurrencyDollar, FolderOpen, WhatsappLogo, PencilSimple, NotePencil } from '@phosphor-icons/react';
import { Field, Input, Textarea, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
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
// Kaydetme PATCH /api/clients/:id ile kalıcı (mock modda MSW in-memory).
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

// Bölge chip editörü: hover'da × kaldırma + '+ Add Region' chip-input.
// Hem Investment Overview kartında hem Edit Profile modalında kullanılır.
const RegionsEditor: React.FC<{
  regions: string[];
  onChange: (regions: string[]) => void;
}> = ({ regions, onChange }) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={styles.regionsList}>
      {regions.map((region) => (
        <span key={region} className={styles.regionTag}>
          <MapPin size={10} /> {region}
          <button
            type="button"
            className={styles.regionRemove}
            aria-label={`Remove ${region}`}
            onClick={() => onChange(regions.filter(r => r !== region))}
          >
            ×
          </button>
        </span>
      ))}
      {draft === null ? (
        <button type="button" className={styles.regionAdd} onClick={() => setDraft('')}>
          + Add Region
        </button>
      ) : (
        <input
          autoFocus
          className={styles.regionInput}
          value={draft}
          placeholder="e.g. Palm Jumeirah"
          aria-label="new region"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft(null);
            if (e.key === 'Enter') {
              const v = draft.trim();
              if (v && !regions.includes(v)) onChange([...regions, v]);
              setDraft(null);
            }
          }}
        />
      )}
    </div>
  );
};

// Edit Profile formunun alan seti — PATCH /api/clients/:id sözleşmesiyle hizalı
type EditableProfile = Pick<ClientDTO,
  'name' | 'email' | 'phone' | 'nationality' | 'type' | 'relationshipStatus' |
  'investmentProfile' | 'assignedConsultant' | 'source' | 'preferredRegions'> & {
  unitTypes: string[];
  purpose: NonNullable<ClientDTO['purpose']>;
  budgetRange: string;
  requirements: string;
};

// Aranan daire tipi seçenekleri (çoklu seçim chip'leri)
const UNIT_TYPE_OPTIONS = ['Studio', '1+1', '2+1', '3+1', '4+1+', 'Penthouse', 'Villa'];

// İç not zamanı: ISO → göreli etiket (listede kompakt okunur)
function noteTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const ClientProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading } = useFetch<ClientDTO[]>(() => clientsApi.list(), [id]);
  const fetched = (data ?? []).find(c => c.id === id) ?? null;
  // Satır-içi düzenlemeler (mock-persist): fetch edilen kaydın üstüne bindirilir.
  const [overrides, setOverrides] = useState<Partial<ClientDTO>>({});
  const client = fetched ? { ...fetched, ...overrides } : null;

  /**
   * Kalıcı kaydetme: PATCH /api/clients/:id (gerçek modda contacts + metadata,
   * mock modda MSW in-memory). Başarıda overrides'a işler; hatada dokunmaz.
   */
  const saveClient = async (patch: Partial<ClientDTO>, okMsg: string) => {
    if (!client) return;
    try {
      await clientsApi.update(client.id, patch);
      setOverrides(prev => ({ ...prev, ...patch }));
      toast.success(okMsg);
    } catch {
      toast.error('Save failed — please try again');
    }
  };
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditableProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'communication' | 'vault' | 'notes'>('communication');
  // Danışman iç notları — meeting_notes tablosundan (mock modda MSW)
  const { data: fetchedNotes } = useFetch<ClientNoteDTO[]>(() => clientsApi.notes(id!), [id]);
  const [addedNotes, setAddedNotes] = useState<ClientNoteDTO[]>([]);
  const notes: ClientNoteDTO[] = [...addedNotes, ...(fetchedNotes ?? [])];
  const [noteDraft, setNoteDraft] = useState('');
  const [noteTag, setNoteTag] = useState<ClientNoteDTO['tag']>('Meeting');
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
          <Button
            variant="secondary"
            onClick={() => {
              setEditForm({
                name: client.name,
                email: client.email,
                phone: client.phone,
                nationality: client.nationality,
                type: client.type,
                relationshipStatus: client.relationshipStatus,
                investmentProfile: client.investmentProfile,
                assignedConsultant: client.assignedConsultant,
                source: client.source,
                preferredRegions: client.preferredRegions,
                unitTypes: client.unitTypes ?? [],
                purpose: client.purpose ?? 'Investment',
                budgetRange: client.budgetRange ?? '',
                requirements: client.requirements ?? '',
              });
              setShowEditModal(true);
            }}
          >
            <PencilSimple size={16} /> Edit Profile
          </Button>
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
                  onSave={(v) => { void saveClient({ email: v }, 'Email updated'); }}
                />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Phone size={14} /></span>
                <InlineText
                  value={client.phone}
                  type="tel"
                  ariaLabel="phone"
                  onSave={(v) => { void saveClient({ phone: v }, 'Phone updated'); }}
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
                  onSave={(v) => { void saveClient({ investmentProfile: v as ClientDTO['investmentProfile'] }, 'Risk profile updated'); }}
                />
              </div>

              {client.purpose && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Purpose</span>
                  <span className={styles.detailValue}>{client.purpose}</span>
                </div>
              )}
              {client.budgetRange && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Budget Range</span>
                  <span className={`${styles.detailValue} ${styles.monoValue}`}>{client.budgetRange}</span>
                </div>
              )}
              {client.unitTypes && client.unitTypes.length > 0 && (
                <div className={styles.regionsContainer}>
                  <span className={styles.detailLabel} style={{ marginBottom: '8px', display: 'block' }}>Unit Type Search</span>
                  <div className={styles.regionsList}>
                    {client.unitTypes.map((u) => (
                      <span key={u} className={styles.unitTag}>{u}</span>
                    ))}
                  </div>
                </div>
              )}
              {client.requirements && (
                <div className={styles.requirementsBox}>
                  <span className={styles.detailLabel} style={{ marginBottom: '6px', display: 'block' }}>Specific Requirements</span>
                  <p className={styles.requirementsText}>{client.requirements}</p>
                </div>
              )}

              <div className={styles.regionsContainer}>
                <span className={styles.detailLabel} style={{ marginBottom: '8px', display: 'block' }}>Preferred Regions</span>
                <RegionsEditor
                  regions={client.preferredRegions}
                  onChange={(regions) => { void saveClient({ preferredRegions: regions }, 'Regions updated'); }}
                />
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
            <button
              className={`${styles.tabBtn} ${activeTab === 'notes' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <NotePencil size={16} /> Internal Notes
              <span className={styles.tabCount}>{notes.length}</span>
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

          {activeTab === 'notes' && (
            <Card>
              <CardHeader>
                <h3 className={styles.cardTitle}>Internal Notes</h3>
                <span className={styles.notesHint}>Consultant debriefs — visible to team &amp; admin, never to the client</span>
              </CardHeader>
              <CardBody>
                {/* Kompozer: görüşme özeti + etiket */}
                <div className={styles.noteComposer}>
                  <Textarea
                    rows={3}
                    placeholder="What was discussed? Key signals, objections, next steps…"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <div className={styles.noteComposerRow}>
                    <div className={styles.noteTagSelect}>
                      <SelectMenu
                        aria-label="Note type"
                        value={noteTag}
                        onChange={(v) => setNoteTag(v as ClientNoteDTO['tag'])}
                        options={[
                          { value: 'Meeting', label: 'Meeting Debrief' },
                          { value: 'Call', label: 'Call Note' },
                          { value: 'General', label: 'General' },
                        ]}
                      />
                    </div>
                    <Button
                      variant="primary"
                      disabled={!noteDraft.trim()}
                      onClick={() => {
                        const text = noteDraft.trim();
                        if (!text || !client) return;
                        void clientsApi.addNote(client.id, { text, tag: noteTag })
                          .then((created) => {
                            setAddedNotes(prev => [created, ...prev]);
                            setNoteDraft('');
                            toast.success('Note added');
                          })
                          .catch(() => toast.error('Note could not be saved'));
                      }}
                    >
                      <NotePencil size={16} /> Add Note
                    </Button>
                  </div>
                </div>

                {/* Not akışı — en yeni üstte */}
                <div className={styles.notesThread}>
                  {notes.map((n) => (
                    <div key={n.id} className={styles.noteItem}>
                      <span className={styles.noteAvatar}>
                        {n.author.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </span>
                      <div className={styles.noteBody}>
                        <div className={styles.noteHead}>
                          <span className={styles.noteAuthor}>{n.author}</span>
                          <span className={styles.noteRole}>{n.role}</span>
                          <span className={`${styles.noteTagChip} ${styles[`noteTag${n.tag}`] ?? ''}`}>{n.tag}</span>
                          <span className={styles.noteTime}>{noteTimeAgo(n.createdAt)}</span>
                        </div>
                        <p className={styles.noteText}>{n.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
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

      {/* Edit Profile: tüm profil alanları tek formda (mock-persist → overrides) */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Client Profile"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!editForm) return;
                if (!editForm.name.trim() || !editForm.email.trim()) {
                  toast.error('Name and email are required');
                  return;
                }
                const payload: Partial<ClientDTO> = {
                  ...editForm,
                  name: editForm.name.trim(),
                  email: editForm.email.trim(),
                  purpose: editForm.purpose,
                };
                void saveClient(payload, 'Profile updated');
                setShowEditModal(false);
              }}
            >
              Save Changes
            </Button>
          </>
        }
      >
        {editForm && (
          <div className={styles.editSections}>
            <section className={styles.editSection}>
              <h4 className={styles.editSectionTitle}><EnvelopeSimple size={13} /> Identity &amp; Contact</h4>
              <Field label="Full Name">
                <Input value={editForm.name} onChange={(e) => setEditForm(f => f && { ...f, name: e.target.value })} />
              </Field>
              <FormRow>
                <Field label="Email">
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm(f => f && { ...f, email: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input type="tel" value={editForm.phone} onChange={(e) => setEditForm(f => f && { ...f, phone: e.target.value })} />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Nationality">
                  <Input value={editForm.nationality} onChange={(e) => setEditForm(f => f && { ...f, nationality: e.target.value })} />
                </Field>
                <Field label="Source">
                  <Input value={editForm.source} onChange={(e) => setEditForm(f => f && { ...f, source: e.target.value })} />
                </Field>
              </FormRow>
            </section>

            <section className={styles.editSection}>
              <h4 className={styles.editSectionTitle}><BuildingOffice size={13} /> Classification</h4>
              <FormRow>
                <Field label="Client Type">
                  <SelectMenu
                    aria-label="Client Type"
                    value={editForm.type}
                    onChange={(v) => setEditForm(f => f && { ...f, type: v as ClientDTO['type'] })}
                    options={[
                      { value: 'Individual', label: 'Individual' },
                      { value: 'Corporate', label: 'Corporate' },
                      { value: 'VIP', label: 'VIP' },
                    ]}
                  />
                </Field>
                <Field label="Relationship Status">
                  <SelectMenu
                    aria-label="Relationship Status"
                    value={editForm.relationshipStatus}
                    onChange={(v) => setEditForm(f => f && { ...f, relationshipStatus: v as ClientDTO['relationshipStatus'] })}
                    options={[
                      { value: 'Active', label: 'Active' },
                      { value: 'Dormant', label: 'Dormant' },
                      { value: 'Churned', label: 'Churned' },
                    ]}
                  />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Risk Profile">
                  <SelectMenu
                    aria-label="Risk Profile"
                    value={editForm.investmentProfile}
                    onChange={(v) => setEditForm(f => f && { ...f, investmentProfile: v as ClientDTO['investmentProfile'] })}
                    options={[
                      { value: 'Conservative', label: 'Conservative' },
                      { value: 'Balanced', label: 'Balanced' },
                      { value: 'Aggressive', label: 'Aggressive' },
                    ]}
                  />
                </Field>
                <Field label="Assigned Consultant">
                  <Input value={editForm.assignedConsultant} onChange={(e) => setEditForm(f => f && { ...f, assignedConsultant: e.target.value })} />
                </Field>
              </FormRow>
            </section>

            <section className={styles.editSection}>
              <h4 className={styles.editSectionTitle}><CurrencyDollar size={13} /> Investment Criteria</h4>
              <Field label="Unit Type Search">
                <div className={styles.unitChipRow}>
                  {UNIT_TYPE_OPTIONS.map((u) => {
                    const active = editForm.unitTypes.includes(u);
                    return (
                      <button
                        key={u}
                        type="button"
                        className={`${styles.unitChip} ${active ? styles.unitChipActive : ''}`}
                        aria-pressed={active}
                        onClick={() => setEditForm(f => f && {
                          ...f,
                          unitTypes: active ? f.unitTypes.filter(x => x !== u) : [...f.unitTypes, u],
                        })}
                      >
                        {u}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <FormRow>
                <Field label="Purpose">
                  <SelectMenu
                    aria-label="Purpose"
                    value={editForm.purpose}
                    onChange={(v) => setEditForm(f => f && { ...f, purpose: v as EditableProfile['purpose'] })}
                    options={[
                      { value: 'Investment', label: 'Investment' },
                      { value: 'End-use', label: 'End-use' },
                      { value: 'Golden Visa', label: 'Golden Visa' },
                      { value: 'Relocation', label: 'Relocation' },
                    ]}
                  />
                </Field>
                <Field label="Budget Range">
                  <Input placeholder="e.g. €1.5M – €3.0M" value={editForm.budgetRange} onChange={(e) => setEditForm(f => f && { ...f, budgetRange: e.target.value })} />
                </Field>
              </FormRow>
              <Field label="Specific Requirements">
                <Textarea
                  rows={3}
                  placeholder="Sea view, high floor, payment plan preference…"
                  value={editForm.requirements}
                  onChange={(e) => setEditForm(f => f && { ...f, requirements: e.target.value })}
                />
              </Field>
            </section>

            <section className={styles.editSection}>
              <h4 className={styles.editSectionTitle}><MapPin size={13} /> Preferred Locations</h4>
              <RegionsEditor
                regions={editForm.preferredRegions}
                onChange={(regions) => setEditForm(f => f && { ...f, preferredRegions: regions })}
              />
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
};
