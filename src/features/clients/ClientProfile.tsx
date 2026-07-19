import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import type { ClientAnalysisDTO, ClientDTO, ClientNoteDTO, ClientTimelineEntryDTO, ProposalDTO } from '../../core/types';
import { formatRelativeTime } from './timelineFormat';
import { clientsApi, proposalsApi } from '../../core/api/resources';
import { ClientForm, emptyClientForm, clientFormToPatch, type ClientFormValue } from './ClientForm';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { EmailClient } from './components/EmailClient';
import { DocumentVault } from '../documents/DocumentVault';
import { Modal } from '../../core/components/Modal/Modal';
import { ArrowLeft, EnvelopeSimple, Phone, CalendarBlank, ChatCircle, FileText, MapPin, BuildingOffice, CurrencyDollar, FolderOpen, WhatsappLogo, TelegramLogo, PencilSimple, NotePencil, Trash, Sparkle } from '@phosphor-icons/react';
import { useAuth } from '../../core/auth/AuthContext';
import { Field, Input, Textarea, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import i18n from '../../core/i18n/config';
import styles from './ClientProfile.module.css';

// ---------------------------------------------------------------------
// İletişim zaman çizelgesi — clientsApi.timeline() (communications tablosu,
// bkz. server/src/modules/clients/dto/client-timeline.dto.ts). WhatsApp/
// Telegram kayıtları varsa Eylül'ün qualification skorunu taşır.
// ---------------------------------------------------------------------
type TimelineKind = ClientTimelineEntryDTO['kind'];

const TIMELINE_ICON: Record<TimelineKind, React.ReactNode> = {
  email: <EnvelopeSimple size={16} />,
  call: <Phone size={16} />,
  whatsapp: <WhatsappLogo size={16} />,
  telegram: <TelegramLogo size={16} />,
  sms: <ChatCircle size={16} />,
};

const FILTER_KEYS: Array<{ key: 'all' | TimelineKind; labelKey: string }> = [
  { key: 'all', labelKey: 'clients.profile.filters.all' },
  { key: 'whatsapp', labelKey: 'clients.profile.filters.whatsapp' },
  { key: 'email', labelKey: 'clients.profile.filters.emails' },
  { key: 'call', labelKey: 'clients.profile.filters.calls' },
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
  const { t } = useTranslation();
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
          {t('clients.profile.addRegion')}
        </button>
      ) : (
        <input
          autoFocus
          className={styles.regionInput}
          value={draft}
          placeholder={t('clients.profile.newRegionPh')}
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

// Görüşme kaydı alanları — ne zaman / kanal / yer / amaç (Onur talebi:
// "19 Temmuz 16.16'da telefonla, şu amaçla görüştüm, şunları konuştuk").
interface InteractionValue {
  channel: string;
  occurredAt: string; // datetime-local biçimi
  location: string;
  purpose: string;
}
const emptyInteraction: InteractionValue = { channel: 'phone', occurredAt: '', location: '', purpose: '' };
const NOTE_CHANNELS = ['phone', 'meeting', 'video', 'whatsapp', 'email', 'other'] as const;

const InteractionFields: React.FC<{
  v: InteractionValue;
  onChange: (v: InteractionValue) => void;
}> = ({ v, onChange }) => {
  const { t } = useTranslation();
  const set = (patch: Partial<InteractionValue>) => onChange({ ...v, ...patch });
  return (
    <>
      <FormRow>
        <Field label={t('clients.profile.interaction.channel')}>
          <SelectMenu
            aria-label={t('clients.profile.interaction.channel')}
            value={v.channel}
            onChange={(c) => set({ channel: c })}
            options={NOTE_CHANNELS.map((c) => ({ value: c, label: t(`clients.profile.interaction.channels.${c}`) }))}
          />
        </Field>
        <Field label={t('clients.profile.interaction.occurredAt')}>
          <Input type="datetime-local" value={v.occurredAt} onChange={(e) => set({ occurredAt: e.target.value })} />
        </Field>
      </FormRow>
      <FormRow>
        <Field label={t('clients.profile.interaction.location')}>
          <Input value={v.location} placeholder={t('clients.profile.interaction.locationPh')}
            onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label={t('clients.profile.interaction.purpose')}>
          <Input value={v.purpose} placeholder={t('clients.profile.interaction.purposePh')}
            onChange={(e) => set({ purpose: e.target.value })} />
        </Field>
      </FormRow>
    </>
  );
};

/** Görüşme meta satırı — kanal · tarih/saat · yer · amaç chip'leri. */
const InteractionMeta: React.FC<{ n: ClientNoteDTO }> = ({ n }) => {
  const { t } = useTranslation();
  if (!n.channel && !n.occurredAt && !n.location && !n.purpose) return null;
  const bits: string[] = [];
  if (n.channel) bits.push(t(`clients.profile.interaction.channels.${n.channel}`, { defaultValue: n.channel }));
  if (n.occurredAt) bits.push(new Date(n.occurredAt).toLocaleString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
  if (n.location) bits.push(n.location);
  if (n.purpose) bits.push(`${t('clients.profile.interaction.purposeShort')}: ${n.purpose}`);
  return (
    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {bits.map((b, i) => <span key={i}>{i > 0 ? '· ' : ''}{b}</span>)}
    </div>
  );
};

/** datetime-local → ISO (boşsa undefined). */
const localToIso = (v: string): string | undefined =>
  v ? new Date(v).toISOString() : undefined;

// İç not zamanı: ISO → göreli etiket (listede kompakt okunur). Modül seviyesinde
// olduğu için hook kullanamaz; canlı dil değişimini yakalamak için i18n'i
// doğrudan config'ten import eder (bkz. Meetings.tsx aynı desen).
function noteTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return i18n.t('clients.profile.justNow');
  if (m < 60) return i18n.t('clients.profile.minutesAgo', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return i18n.t('clients.profile.hoursAgo', { h });
  const d = Math.floor(h / 24);
  if (d < 14) return i18n.t('clients.profile.daysAgo', { d });
  return new Date(iso).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB');
}

export const ClientProfile: React.FC = () => {
  const { t } = useTranslation();
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
      toast.error(t('clients.profile.saveFailed'));
    }
  };
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<ClientFormValue | null>(null);
  // Kalıcı silme — yalnız super_admin; kişi + tüm lead'leri + iletişim izleri.
  const { user } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canDelete = user?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState<'communication' | 'email' | 'vault' | 'notes' | 'analysis' | 'proposals'>('communication');
  // Müşteri-360: bu müşteriye gönderilmiş teklifler (contactId ile filtre).
  const { data: allProposals } = useFetch<ProposalDTO[]>(() => proposalsApi.list(), [id]);
  const clientProposals = (allProposals ?? []).filter(
    (p) => p.contactId === id || (fetched && p.clientName === fetched.name),
  );
  // Danışman iç notları — meeting_notes tablosundan (mock modda MSW)
  const { data: fetchedNotes } = useFetch<ClientNoteDTO[]>(() => clientsApi.notes(id!), [id]);
  const [addedNotes, setAddedNotes] = useState<ClientNoteDTO[]>([]);
  const notes: ClientNoteDTO[] = [...addedNotes, ...(fetchedNotes ?? [])];
  // AI Analiz raporları — n8n analiz workflow'u üretir, meeting_notes'ta saklanır.
  const { data: analyses } = useFetch<ClientAnalysisDTO[]>(() => clientsApi.analyses(id!), [id]);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteTag, setNoteTag] = useState<ClientNoteDTO['tag']>('Meeting');
  const [noteInter, setNoteInter] = useState<InteractionValue>(emptyInteraction);
  // İletişim zaman çizelgesi — communications tablosundan (mock modda MSW)
  const { data: fetchedTimeline, loading: timelineLoading } =
    useFetch<ClientTimelineEntryDTO[]>(() => clientsApi.timeline(id!), [id]);
  const timelineEntries = fetchedTimeline ?? [];
  const [timelineFilter, setTimelineFilter] = useState<'all' | TimelineKind>('all');

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityType, setActivityType] = useState<'Call' | 'Meeting' | 'Note'>('Note');
  const [activityNote, setActivityNote] = useState('');
  const [actInter, setActInter] = useState<InteractionValue>(emptyInteraction);

  const toast = useToast();

  const activityTypeLabel = (type: 'Call' | 'Meeting' | 'Note') =>
    type === 'Call' ? t('clients.profile.activityTypes.call')
      : type === 'Meeting' ? t('clients.profile.activityTypes.meeting')
      : t('clients.profile.activityTypes.note');

  const handleActionClick = (actionName: string) => {
    if (actionName === 'View Contracts') {
      setActiveTab('vault');
      return;
    }
    if (actionName === 'Send Email') {
      setActiveTab('email');
      return;
    }
    if (actionName === 'Create Proposal') {
      // Müşteriyi kilitleyerek aç — teklif yalnız bu müşteriye hedeflenir.
      if (client) navigate(`/proposals/new?clientId=${client.id}`);
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
    const text = activityNote.trim();
    if (!text || !client) return;
    // Aktivite = etiketli iç not (meeting_notes) — Notlar sekmesiyle aynı kalıcı uç.
    const tag = activityType === 'Note' ? 'General' : activityType;
    void clientsApi.addNote(client.id, {
      text, tag,
      channel: actInter.channel || undefined,
      occurredAt: localToIso(actInter.occurredAt),
      location: actInter.location.trim() || undefined,
      purpose: actInter.purpose.trim() || undefined,
    })
      .then((created) => {
        setAddedNotes(prev => [created, ...prev]);
        toast.success(t('clients.profile.activitySaved', { type: activityTypeLabel(activityType) }));
        setShowActivityModal(false);
        setActivityNote('');
        setActInter(emptyInteraction);
      })
      .catch(() => toast.error(t('clients.profile.noteSaveFailed')));
  };

  const handleDelete = async () => {
    if (!client) return;
    setDeleting(true);
    try {
      await clientsApi.remove(client.id);
      toast.success(t('clients.profile.deleteSuccess'));
      navigate('/clients');
    } catch (e) {
      toast.error(`${t('clients.profile.deleteError')}: ${e instanceof Error ? e.message : String(e)}`);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (loading) {
    return <TableSkeleton rows={6} />;
  }

  if (!client) {
    return <div className={styles.error}>{t('clients.notFound')}</div>;
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
            <p className={styles.subtitle}>{t('clients.profile.idLine', { id: client.clientId, nationality: client.nationality, source: client.source })}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => handleActionClick('Send Email')}><EnvelopeSimple size={16} /> {t('clients.profile.email')}</Button>
          <Button variant="outline" onClick={() => handleActionClick('Log Call')}><Phone size={16} /> {t('clients.profile.call')}</Button>
          {/* DS §5.4: sayfada tek primary — vault sekmesindeki Upload File primary kalır */}
          <Button
            variant="secondary"
            onClick={() => {
              setEditForm({
                ...emptyClientForm,
                name: client.name,
                email: client.email === '—' ? '' : client.email,
                phone: client.phone === '—' ? '' : client.phone,
                nationality: client.nationality === '—' ? '' : client.nationality,
                type: client.type,
                relationshipStatus: client.relationshipStatus,
                investmentProfile: client.investmentProfile,
                assignedConsultant: client.assignedConsultant === '—' ? '' : client.assignedConsultant,
                source: client.source === '—' ? '' : client.source,
                preferredRegions: client.preferredRegions,
                unitTypes: client.unitTypes ?? [],
                purpose: client.purpose ?? 'Investment',
                budgetMin: client.budgetMin ? String(client.budgetMin) : '',
                budgetMax: client.budgetMax ? String(client.budgetMax) : '',
                budgetCurrency: client.budgetCurrency ?? 'EUR',
                requirements: client.requirements ?? '',
              });
              setShowEditModal(true);
            }}
          >
            <PencilSimple size={16} /> {t('clients.profile.editProfile')}
          </Button>
          {canDelete && (confirmingDelete ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--color-danger)', alignSelf: 'center' }}>
                {t('clients.profile.deleteConfirm')}
              </span>
              <Button variant="outline" onClick={handleDelete} disabled={deleting}
                style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                <Trash size={16} /> {t('clients.profile.deleteYes')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                {t('clients.profile.deleteCancel')}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmingDelete(true)}
              style={{ color: 'var(--color-danger)' }}>
              <Trash size={16} /> {t('clients.profile.delete')}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle}>{t('clients.profile.contactDetails')}</h3>
            </CardHeader>
            <CardBody>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><EnvelopeSimple size={14} /></span>
                <InlineText
                  value={client.email}
                  type="email"
                  ariaLabel="email"
                  onSave={(v) => { void saveClient({ email: v }, t('clients.profile.emailUpdated')); }}
                />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Phone size={14} /></span>
                <InlineText
                  value={client.phone}
                  type="tel"
                  ariaLabel="phone"
                  onSave={(v) => { void saveClient({ phone: v }, t('clients.profile.phoneUpdated')); }}
                />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{t('clients.profile.assignedConsultant')}</span>
                <span className={styles.detailValue}>{client.assignedConsultant}</span>
              </div>

              {/* Durum bayrakları — küçük ama kritik operasyon detayları */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {(!client.email || client.email === '—') && (
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-control, 6px)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', opacity: 0.9 }}>
                    ⚠ {t('clients.profile.flagEmailMissing')}
                  </span>
                )}
                {client.email && client.email !== '—' && client.welcomeEmailSentAt === null && (
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-control, 6px)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)', opacity: 0.9 }}>
                    {t('clients.profile.flagWelcomeNotSent')}
                  </span>
                )}
                {client.welcomeEmailSentAt ? (
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-control, 6px)', color: 'var(--color-success)', border: '1px solid var(--color-success)', opacity: 0.9 }}>
                    ✓ {t('clients.profile.flagWelcomeSent', { date: new Date(client.welcomeEmailSentAt).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short' }) })}
                  </span>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t('clients.profile.overview')}
                {client.profileSource === 'eylul' && (
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 'var(--radius-control, 6px)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)' }}>
                    {t('clients.profile.eylulExtracted')}
                  </span>
                )}
              </h3>
            </CardHeader>
            <CardBody>
              {typeof client.aiScore === 'number' && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>{t('clients.profile.aiScoreLabel')}</span>
                  <span className={`${styles.detailValue} ${styles.monoValue}`}>{client.aiScore} / 100</span>
                </div>
              )}
              <div className={styles.kpiGrid}>
                <div className={styles.kpiBox}>
                  <CurrencyDollar size={16} className={styles.kpiIcon} />
                  <span className={styles.kpiLabel}>{t('clients.profile.totalValue')}</span>
                  <span className={styles.kpiValue}>{formatCurrency(client.totalInvestment)}</span>
                </div>
                <div className={styles.kpiBox}>
                  <BuildingOffice size={16} className={styles.kpiIcon} />
                  <span className={styles.kpiLabel}>{t('clients.profile.properties')}</span>
                  <span className={styles.kpiValue}>{t('clients.profile.activeCount', { count: client.activeProperties })}</span>
                </div>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{t('clients.profile.riskProfile')}</span>
                <InlineText
                  value={client.investmentProfile}
                  ariaLabel="risk profile"
                  onSave={(v) => { void saveClient({ investmentProfile: v as ClientDTO['investmentProfile'] }, t('clients.profile.riskUpdated')); }}
                />
              </div>

              {client.purpose && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>{t('clients.profile.purpose')}</span>
                  <span className={styles.detailValue}>{client.purpose}</span>
                </div>
              )}
              {client.budgetRange && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>{t('clients.profile.budgetRange')}</span>
                  <span className={`${styles.detailValue} ${styles.monoValue}`}>{client.budgetRange}</span>
                </div>
              )}
              {client.unitTypes && client.unitTypes.length > 0 && (
                <div className={styles.regionsContainer}>
                  <span className={styles.detailLabel} style={{ marginBottom: '8px', display: 'block' }}>{t('clients.profile.unitTypeSearch')}</span>
                  <div className={styles.regionsList}>
                    {client.unitTypes.map((u) => (
                      <span key={u} className={styles.unitTag}>{u}</span>
                    ))}
                  </div>
                </div>
              )}
              {client.requirements && (
                <div className={styles.requirementsBox}>
                  <span className={styles.detailLabel} style={{ marginBottom: '6px', display: 'block' }}>{t('clients.profile.specificRequirements')}</span>
                  <p className={styles.requirementsText}>{client.requirements}</p>
                </div>
              )}

              <div className={styles.regionsContainer}>
                <span className={styles.detailLabel} style={{ marginBottom: '8px', display: 'block' }}>{t('clients.profile.regions')}</span>
                <RegionsEditor
                  regions={client.preferredRegions}
                  onChange={(regions) => { void saveClient({ preferredRegions: regions }, t('clients.profile.regionsUpdated')); }}
                />
              </div>
            </CardBody>
          </Card>

          <Card className={styles.quickActions}>
            <CardHeader>
              <h3 className={styles.cardTitle}>{t('clients.profile.quickActions')}</h3>
            </CardHeader>
            <CardBody>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Schedule Meeting')}><CalendarBlank size={16} /> {t('clients.profile.scheduleMeeting')}</Button>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Create Proposal')}><FileText size={16} /> {t('clients.profile.createProposal')}</Button>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('View Contracts')}><FolderOpen size={16} /> {t('clients.profile.viewVault')}</Button>
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'communication' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('communication')}
            >
              <ChatCircle size={16} /> {t('clients.profile.communicationCenter')}
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'email' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('email')}
            >
              <EnvelopeSimple size={16} /> {t('clients.profile.mailTab')}
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'vault' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('vault')}
            >
              <FolderOpen size={16} /> {t('clients.profile.documentVault')}
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'notes' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <NotePencil size={16} /> {t('clients.profile.internalNotes')}
              <span className={styles.tabCount}>{notes.length}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'analysis' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              <Sparkle size={16} /> {t('clients.profile.aiAnalysisTab')}
              <span className={styles.tabCount}>{analyses?.length ?? 0}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'proposals' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('proposals')}
            >
              <FileText size={16} /> {t('clients.profile.proposalsTab')}
              <span className={styles.tabCount}>{clientProposals.length}</span>
            </button>
          </div>

          {activeTab === 'proposals' && (
            <Card>
              <CardHeader>
                <h3 className={styles.cardTitle}>{t('clients.profile.proposalsTab')}</h3>
                <span className={styles.notesHint}>{t('clients.profile.proposalsHint')}</span>
              </CardHeader>
              <CardBody>
                {clientProposals.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('clients.profile.proposalsEmpty')}</p>
                ) : (
                  clientProposals.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/proposals/${p.id}`)}
                      style={{
                        display: 'flex', width: '100%', alignItems: 'baseline', gap: 12,
                        padding: '12px 4px', background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: '1px solid var(--border-subtle, rgba(128,128,128,0.15))', textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.projectName}{p.projectLocation ? ` · ${p.projectLocation}` : ''}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        {p.totalValue > 0 ? `${p.totalValue.toLocaleString('tr-TR')} ${p.currency}` : '—'}
                      </span>
                      <span className={styles.noteTagChip}>{p.status}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(p.createdAt).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </button>
                  ))
                )}
              </CardBody>
            </Card>
          )}

          {activeTab === 'analysis' && (
            <Card>
              <CardHeader>
                <h3 className={styles.cardTitle}>{t('clients.profile.aiAnalysisTab')}</h3>
                <span className={styles.notesHint}>{t('clients.profile.aiAnalysisHint')}</span>
              </CardHeader>
              <CardBody>
                {(!analyses || analyses.length === 0) ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('clients.profile.aiAnalysisEmpty')}</p>
                ) : (
                  analyses.map((a) => (
                    <div key={a.id} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle, rgba(128,128,128,0.15))' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                        <strong style={{ fontSize: 14 }}>{a.subject}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(a.createdAt).toLocaleString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{a.report}</pre>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          )}

          {activeTab === 'communication' && (
            <Card className={styles.communicationCenter}>
                <CardHeader className={styles.commHeader}>
                  <h3 className={styles.cardTitle}>{t('clients.profile.communicationTimeline')}</h3>
                  <div className={styles.commFilters}>
                    {FILTER_KEYS.map((f) => (
                      <button
                        key={f.key}
                        className={`${styles.filterBtn} ${timelineFilter === f.key ? styles.active : ''}`}
                        onClick={() => setTimelineFilter(f.key)}
                      >
                        {t(f.labelKey)}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardBody className={styles.commBody}>
                  <div className={styles.timeline}>
                    {timelineLoading && <p className={styles.messageEmpty}>{t('clients.email.loading')}</p>}
                    {!timelineLoading && timelineEntries
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
                                <span className={styles.timelineDate}>{formatRelativeTime(entry.time, i18n.language)}</span>
                              </span>
                            </div>
                            <p className={styles.timelineText}>{entry.body}</p>
                          </div>
                        </div>
                      ))}
                    {!timelineLoading && timelineEntries.filter((e) => timelineFilter === 'all' || e.kind === timelineFilter).length === 0 && (
                      <div className={styles.timelineEmpty}>
                        <ChatCircle size={28} weight="duotone" />
                        <p>{t('clients.profile.noRecords')}</p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
          )}

          {activeTab === 'email' && (
            <div className={styles.emailCard}>
              <EmailClient clientEmail={client.email} clientName={client.name} />
            </div>
          )}

          {activeTab === 'vault' && (
            <div className={styles.vaultTabWrapper}>
              <DocumentVault clientId={client.id} />
            </div>
          )}

          {activeTab === 'notes' && (
            <Card>
              <CardHeader>
                <h3 className={styles.cardTitle}>{t('clients.profile.internalNotes')}</h3>
                <span className={styles.notesHint}>{t('clients.profile.notesHint')}</span>
              </CardHeader>
              <CardBody>
                {/* Kompozer: yapılandırılmış görüşme kaydı (ne zaman/kanal/yer/amaç) + özet */}
                <div className={styles.noteComposer}>
                  <InteractionFields v={noteInter} onChange={setNoteInter} />
                  <Textarea
                    rows={3}
                    placeholder={t('clients.profile.notePlaceholderLong')}
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
                          { value: 'Meeting', label: t('clients.profile.noteTypes.meeting') },
                          { value: 'Call', label: t('clients.profile.noteTypes.call') },
                          { value: 'General', label: t('clients.profile.noteTypes.general') },
                        ]}
                      />
                    </div>
                    <Button
                      variant="primary"
                      disabled={!noteDraft.trim()}
                      onClick={() => {
                        const text = noteDraft.trim();
                        if (!text || !client) return;
                        void clientsApi.addNote(client.id, {
                          text, tag: noteTag,
                          channel: noteInter.channel || undefined,
                          occurredAt: localToIso(noteInter.occurredAt),
                          location: noteInter.location.trim() || undefined,
                          purpose: noteInter.purpose.trim() || undefined,
                        })
                          .then((created) => {
                            setAddedNotes(prev => [created, ...prev]);
                            setNoteDraft('');
                            setNoteInter(emptyInteraction);
                            toast.success(t('clients.profile.noteSaved'));
                          })
                          .catch(() => toast.error(t('clients.profile.noteSaveFailed')));
                      }}
                    >
                      <NotePencil size={16} /> {t('clients.profile.addNote')}
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
                        <InteractionMeta n={n} />
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
        title={t('clients.profile.newActivity', { type: activityTypeLabel(activityType) })}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowActivityModal(false)}>{t('clients.cancel')}</Button>
            <Button variant="primary" onClick={handleSaveActivity} disabled={!activityNote.trim()}>{t('clients.profile.saveActivity', { type: activityTypeLabel(activityType) })}</Button>
          </>
        }
      >
        <InteractionFields v={actInter} onChange={setActInter} />
        <Field label={t('clients.profile.activityDetails', { type: activityTypeLabel(activityType) })}>
          <Textarea
            rows={5}
            placeholder={t('clients.profile.activityPlaceholder', { type: activityTypeLabel(activityType).toLowerCase() })}
            value={activityNote}
            onChange={(e) => setActivityNote(e.target.value)}
          />
        </Field>
      </Modal>

      {/* Edit Profile: tüm profil alanları tek formda (mock-persist → overrides) */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('clients.profile.editModalTitle')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>{t('clients.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!editForm) return;
                if (!editForm.name.trim()) {
                  toast.error(t('clients.profile.nameEmailRequired'));
                  return;
                }
                void saveClient(clientFormToPatch(editForm) as Partial<ClientDTO>, t('clients.profile.profileUpdated'));
                setShowEditModal(false);
              }}
            >
              {t('clients.profile.saveChanges')}
            </Button>
          </>
        }
      >
        {editForm && (
          <ClientForm value={editForm} onChange={setEditForm} />
        )}
      </Modal>
    </div>
  );
};
