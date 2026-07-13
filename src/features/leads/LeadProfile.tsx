import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { LeadCommunicationDTO, LeadDTO, LeadScoreDTO, LeadStatus, UserDTO } from '../../core/types';
import { leadsApi, usersApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import {
  ArrowLeft, CurrencyDollar, Tag, Flag, MapPin, CalendarBlank, UserCircle,
  WhatsappLogo, EnvelopeSimple, Phone, ChatCircleDots, ArrowDown, ArrowUp, ChatCircle,
  Sparkle,
} from '@phosphor-icons/react';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import styles from './LeadProfile.module.css';

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', nurturing: 'Nurturing',
  converted: 'Converted', unqualified: 'Unqualified', lost: 'Lost',
};

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
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const CHANNEL_ICON: Record<LeadCommunicationDTO['channel'], React.ReactNode> = {
  whatsapp: <WhatsappLogo size={16} weight="fill" />,
  email: <EnvelopeSimple size={16} />,
  phone: <Phone size={16} />,
  sms: <ChatCircleDots size={16} />,
};

const CHANNEL_LABEL: Record<LeadCommunicationDTO['channel'], string> = {
  whatsapp: 'WhatsApp', email: 'E-posta', phone: 'Telefon', sms: 'SMS',
};

export const LeadProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
        Aday bulunamadı{error ? `: ${error}` : ''}.
        <Button variant="outline" onClick={() => navigate('/leads')} style={{ marginTop: 12 }}>
          <ArrowLeft size={16} /> Leads'e dön
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
              <h1 className={styles.title}>{lead.contactName || 'İsimsiz aday'}</h1>
              <span className={styles.statusBadge}>{STATUS_LABEL[lead.status]}</span>
              <span className={`${styles.priorityBadge} ${styles[lead.priority]}`}>{lead.priority}</span>
            </div>
            <p className={styles.subtitle}>
              {lead.company ?? 'Kurumsal bağlantı yok'}
              {lead.targetMarketCode ? ` · ${lead.targetMarketCode} pazarı` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardHeader><h3 className={styles.cardTitle}>Aday Detayları</h3></CardHeader>
            <CardBody>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><CurrencyDollar size={14} /></span>
                <span className={styles.detailLabel}>Bütçe</span>
                <span className={styles.detailValue}>{budget}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Tag size={14} /></span>
                <span className={styles.detailLabel}>İlgi Türü</span>
                <span className={styles.detailValue} style={{ textTransform: 'capitalize' }}>{lead.interestType}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><MapPin size={14} /></span>
                <span className={styles.detailLabel}>Hedef Pazar</span>
                <span className={styles.detailValue}>{lead.targetMarketCode ?? '—'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><UserCircle size={14} /></span>
                <span className={styles.detailLabel}>Danışman</span>
                <span className={styles.detailValue}>{ownerName ?? 'Atanmadı'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><CalendarBlank size={14} /></span>
                <span className={styles.detailLabel}>Oluşturuldu</span>
                <span className={styles.detailValue}>{formatDate(lead.createdAt)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Flag size={14} /></span>
                <span className={styles.detailLabel}>Son Güncelleme</span>
                <span className={styles.detailValue}>{formatDate(lead.updatedAt)}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h3 className={styles.cardTitle}>Skor</h3></CardHeader>
            <CardBody>
              <div className={styles.scoreRow}>
                <span className={`${styles.scoreValue} ${styles[scoreBand(lead.score)]}`}>
                  {lead.score ?? '—'}
                </span>
                <span className={styles.scoreOutOf}>/ 100</span>
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
                    {latestScore.source === 'n8n_ai' ? 'RAG destekli AI skorlaması' : 'Manuel girildi'}
                    {latestScore.createdBy ? ` — ${latestScore.createdBy}` : ''} · {formatDate(latestScore.createdAt)}
                  </span>

                  {scores && scores.length > 1 && (
                    <div className={styles.scoreHistory}>
                      <span className={styles.scoreHistoryLabel}>Geçmiş</span>
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
                <p className={styles.scoreCaveat}>
                  Bu değer şu an <strong>manuel girilmiş</strong> bir referans skoru — otomatik
                  bir kural motoru ya da AI modeli tarafından hesaplanmıyor. Gerçek bir
                  skorlama sistemi (hangi sinyallere göre, nasıl ağırlıklandırılacak) henüz
                  tasarlanmadı.
                </p>
              )}
            </CardBody>
          </Card>

          {lead.notes && (
            <Card>
              <CardHeader><h3 className={styles.cardTitle}>Notlar</h3></CardHeader>
              <CardBody>
                <p className={styles.notesText}>{lead.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className={styles.main}>
          <Card className={styles.timelineCard}>
            <CardHeader><h3 className={styles.cardTitle}>Görüşme Geçmişi</h3></CardHeader>
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
                            {CHANNEL_LABEL[entry.channel]}
                            {entry.subject ? ` — ${entry.subject}` : ''}
                          </span>
                          <span className={styles.timelineMeta}>
                            {entry.direction === 'inbound'
                              ? <ArrowDown size={12} className={styles.inboundIcon} />
                              : <ArrowUp size={12} className={styles.outboundIcon} />}
                            {entry.direction === 'inbound' ? 'Gelen' : 'Giden'}
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
                  <h4>Henüz kayıtlı görüşme yok</h4>
                  <p>
                    WhatsApp/e-posta/telefon üzerinden bu adayla yapılan görüşmeler
                    burada kronolojik olarak listelenecek.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
