import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import type { LeadCommunicationDTO, LeadDTO, LeadScoreDTO, UserDTO } from '../../core/types';
import { leadsApi, usersApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import {
  ArrowLeft, CurrencyDollar, Tag, Flag, MapPin, CalendarBlank, UserCircle,
  WhatsappLogo, EnvelopeSimple, Phone, ChatCircleDots, ArrowDown, ArrowUp, ChatCircle,
  Sparkle, TelegramLogo, Trash,
} from '@phosphor-icons/react';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import i18n from '../../core/i18n/config';
import styles from './LeadProfile.module.css';

function scoreBand(score: number | null): 'weak' | 'moderate' | 'strong' | 'unscored' {
  if (score === null) return 'unscored';
  if (score < 40) return 'weak';
  if (score < 70) return 'moderate';
  return 'strong';
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const CHANNEL_ICON: Record<LeadCommunicationDTO['channel'], React.ReactNode> = {
  whatsapp: <WhatsappLogo size={16} weight="fill" />,
  email: <EnvelopeSimple size={16} />,
  phone: <Phone size={16} />,
  sms: <ChatCircleDots size={16} />,
  telegram: <TelegramLogo size={16} weight="fill" />,
};

export const LeadProfile: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  // Kalıcı silme — yalnız super_admin görür; iki aşamalı onay (modal'sız).
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const canDelete = user?.role === 'super_admin';

  // Danışman atama (super_admin) — owner_id PATCH; version optimistic lock.
  const [assignedOwnerId, setAssignedOwnerId] = React.useState<string | null>(null);
  const handleAssign = async (ownerId: string) => {
    if (!id || !lead || !ownerId) return;
    try {
      const updated = await leadsApi.update(id, { owner_id: ownerId, version: lead.version });
      setAssignedOwnerId(updated.ownerId);
      lead.version = updated.version; // yerel sürümü tazele (arka arkaya atama 409 yemesin)
      toast.success(t('leads.profile.assignSuccess'));
    } catch (e) {
      toast.error(`${t('leads.profile.assignError')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await leadsApi.remove(id);
      toast.success(t('leads.profile.deleteSuccess'));
      navigate('/leads');
    } catch (e) {
      toast.error(`${t('leads.profile.deleteError')}: ${e instanceof Error ? e.message : String(e)}`);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const { data: lead, loading, error } = useFetch<LeadDTO>(() => leadsApi.get(id!), [id]);
  const { data: comms, loading: commsLoading } = useFetch<LeadCommunicationDTO[]>(
    () => leadsApi.communications(id!), [id],
  );
  const { data: scores } = useFetch<LeadScoreDTO[]>(() => leadsApi.scores(id!), [id]);
  const latestScore = scores?.[0] ?? null;
  const { data: users } = useFetch<UserDTO[]>(() => usersApi.list(), []);
  const ownerName = users?.find((u) => u.id === lead?.ownerId)?.name ?? null;

  if (loading) return <TableSkeleton rows={6} />;

  if (error || !lead) {
    return (
      <div className={styles.errorState}>
        {t('leads.profile.notFound')}{error ? `: ${error}` : ''}.
        <Button variant="outline" onClick={() => navigate('/leads')} style={{ marginTop: 12 }}>
          <ArrowLeft size={16} /> {t('leads.profile.backToPipeline')}
        </Button>
      </div>
    );
  }

  const budget = lead.budgetMin && lead.budgetMax
    ? `${formatMoney(lead.budgetMin, lead.currency)} – ${formatMoney(lead.budgetMax, lead.currency)}`
    : formatMoney(lead.budgetMax ?? lead.budgetMin, lead.currency);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate('/leads')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className={styles.titleWrapper}>
              <h1 className={styles.title}>{lead.contactName || t('leads.unnamed')}</h1>
              <span className={styles.statusBadge}>{t(`leads.status.${lead.status}`)}</span>
              <span className={`${styles.priorityBadge} ${styles[lead.priority]}`}>{t(`leads.priorityLevel.${lead.priority}`)}</span>
            </div>
            <p className={styles.subtitle}>
              {lead.company ?? t('leads.profile.noCorporateLink')}
              {lead.targetMarketCode ? ` · ${t('leads.profile.marketSuffix', { market: lead.targetMarketCode })}` : ''}
            </p>
          </div>
        </div>
        {canDelete && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {confirmingDelete ? (
              <>
                <span style={{ fontSize: 13, color: 'var(--color-danger)' }}>
                  {t('leads.profile.deleteConfirm')}
                </span>
                <Button variant="outline" onClick={handleDelete} disabled={deleting}
                  style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                  <Trash size={16} /> {t('leads.profile.deleteYes')}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                  {t('leads.profile.deleteCancel')}
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingDelete(true)}
                style={{ color: 'var(--color-danger)' }}>
                <Trash size={16} /> {t('leads.profile.delete')}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardHeader><h3 className={styles.cardTitle}>{t('leads.profile.leadDetails')}</h3></CardHeader>
            <CardBody>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><CurrencyDollar size={14} /></span>
                <span className={styles.detailLabel}>{t('leads.budget')}</span>
                <span className={styles.detailValue}>{budget}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Tag size={14} /></span>
                <span className={styles.detailLabel}>{t('leads.profile.interestTypeLabel')}</span>
                <span className={styles.detailValue}>{t(`leads.interestType.${lead.interestType}`)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><MapPin size={14} /></span>
                <span className={styles.detailLabel}>{t('leads.profile.targetMarket')}</span>
                <span className={styles.detailValue}>{lead.targetMarketCode ?? '—'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><UserCircle size={14} /></span>
                <span className={styles.detailLabel}>{t('leads.profile.consultant')}</span>
                {canDelete && users && users.length > 0 ? (
                  /* super_admin: yatırımcıyı bir danışmana ata (owner_id PATCH) */
                  <span style={{ minWidth: 150 }}>
                    <SelectMenu
                      aria-label="assign consultant"
                      value={assignedOwnerId ?? lead.ownerId ?? ''}
                      onChange={(v) => { void handleAssign(v); }}
                      options={[
                        { value: '', label: t('leads.profile.notAssigned') },
                        ...users.map((u) => ({ value: u.id, label: u.name })),
                      ]}
                    />
                  </span>
                ) : (
                  <span className={styles.detailValue}>{ownerName ?? t('leads.profile.notAssigned')}</span>
                )}
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><CalendarBlank size={14} /></span>
                <span className={styles.detailLabel}>{t('leads.profile.createdAt')}</span>
                <span className={styles.detailValue}>{formatDate(lead.createdAt)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Flag size={14} /></span>
                <span className={styles.detailLabel}>{t('leads.profile.lastUpdate')}</span>
                <span className={styles.detailValue}>{formatDate(lead.updatedAt)}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h3 className={styles.cardTitle}>{t('leads.score')}</h3></CardHeader>
            <CardBody>
              <div className={styles.scoreRow}>
                <span className={`${styles.scoreValue} ${styles[scoreBand(lead.score)]}`}>
                  {lead.score ?? '—'}
                </span>
                <span className={styles.scoreOutOf}>{t('leads.profile.outOf100')}</span>
                {latestScore?.source === 'n8n_ai' && (
                  <span className={styles.aiBadge}><Sparkle size={12} weight="fill" /> AI</span>
                )}
              </div>

              {latestScore ? (
                <>
                  {latestScore.reasoning && (
                    <p className={styles.scoreReasoning}>{latestScore.reasoning}</p>
                  )}
                  <span className={styles.scoreSourceLine}>
                    {latestScore.source === 'n8n_ai' ? t('leads.profile.ragScoreSource') : t('leads.profile.manualScoreSource')}
                    {latestScore.createdBy ? ` — ${latestScore.createdBy}` : ''} · {formatDate(latestScore.createdAt)}
                  </span>

                  {scores && scores.length > 1 && (
                    <div className={styles.scoreHistory}>
                      <span className={styles.scoreHistoryLabel}>{t('leads.profile.historyLabel')}</span>
                      {scores.slice(1).map((s) => (
                        <div key={s.id} className={styles.scoreHistoryRow}>
                          <span className={`${styles.scoreHistoryValue} ${styles[scoreBand(s.score)]}`}>{s.score}</span>
                          <span className={styles.scoreHistoryDate}>{formatDate(s.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className={styles.scoreCaveat}>{t('leads.profile.scoreCaveat')}</p>
              )}
            </CardBody>
          </Card>

          {lead.notes && (
            <Card>
              <CardHeader><h3 className={styles.cardTitle}>{t('leads.profile.notes')}</h3></CardHeader>
              <CardBody>
                <p className={styles.notesText}>{lead.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className={styles.main}>
          <Card className={styles.timelineCard}>
            <CardHeader><h3 className={styles.cardTitle}>{t('leads.profile.communications')}</h3></CardHeader>
            <CardBody className={styles.timelineBody}>
              {commsLoading ? (
                <TableSkeleton rows={3} />
              ) : comms && comms.length > 0 ? (
                <div className={styles.timeline}>
                  {comms.map((entry) => (
                    <div key={entry.id} className={styles.timelineItem}>
                      <div className={`${styles.timelineIcon} ${styles[`kind_${entry.channel}`]}`}>
                        {CHANNEL_ICON[entry.channel]}
                      </div>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <span className={styles.timelineTitle}>
                            {t(`leads.profile.channels.${entry.channel}`)}
                            {entry.subject ? ` — ${entry.subject}` : ''}
                          </span>
                          <span className={styles.timelineMeta}>
                            {entry.direction === 'inbound'
                              ? <ArrowDown size={12} className={styles.inboundIcon} />
                              : <ArrowUp size={12} className={styles.outboundIcon} />}
                            {entry.direction === 'inbound' ? t('leads.profile.inbound') : t('leads.profile.outbound')}
                            <span className={styles.timelineDate}>{formatDate(entry.sentAt)}</span>
                          </span>
                        </div>
                        {entry.body && <p className={styles.timelineText}>{entry.body}</p>}
                        {entry.handledBy && (
                          <span className={styles.timelineHandledBy}>{entry.handledBy}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.timelineEmpty}>
                  <ChatCircle size={40} weight="thin" />
                  <h4>{t('leads.profile.noCommunications')}</h4>
                  <p>{t('leads.profile.noCommunicationsBody')}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
