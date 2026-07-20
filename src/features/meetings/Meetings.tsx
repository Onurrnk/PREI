import React, { useMemo, useState } from 'react';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { CalendarBlank as CalendarIcon, CaretLeft, CaretRight, Plus, MapPin, User, VideoCamera, Clock, FileText, Phone } from '@phosphor-icons/react';
import type { MeetingDTO } from '../../core/types';
import { meetingsApi } from '../../core/api/resources';
import { ApiError } from '../../core/api/client';
import { useFetch } from '../../core/hooks/useFetch';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import styles from './Meetings.module.css';
import { useTranslation } from 'react-i18next';
import i18n from '../../core/i18n/config';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fmtTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDateLong = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';

interface DayCell { inMonth: boolean; day?: number; iso?: string; isToday?: boolean; events: MeetingDTO[] }

export const Meetings: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useFetch<MeetingDTO[]>(() => meetingsApi.list(), []);
  const meetings = useMemo(() => data ?? [], [data]);

  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingType, setNewMeetingType] = useState('meeting');
  const [newMeetingPlatform, setNewMeetingPlatform] = useState('In-person');
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingTime, setNewMeetingTime] = useState('');
  const [newMeetingLocation, setNewMeetingLocation] = useState('');
  const [newMeetingPhone, setNewMeetingPhone] = useState('');
  const [newMeetingDuration, setNewMeetingDuration] = useState('1h');
  const [newMeetingClient, setNewMeetingClient] = useState('');
  const [newMeetingClientEmail, setNewMeetingClientEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDTO | null>(null);
  const toast = useToast();

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewMeetingTitle(''); setNewMeetingType('meeting'); setNewMeetingPlatform('In-person');
    setNewMeetingDate(''); setNewMeetingTime(''); setNewMeetingLocation('');
    setNewMeetingPhone(''); setNewMeetingDuration('1h');
    setNewMeetingClient(''); setNewMeetingClientEmail('');
  };

  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      toast.error(t('meetings.titleRequired'));
      return;
    }
    if (!newMeetingDate || !newMeetingTime) {
      toast.error(t('meetings.dateRequired'));
      return;
    }
    setIsCreating(true);
    try {
      const created = await meetingsApi.create({
        title: newMeetingTitle.trim(),
        date: new Date(`${newMeetingDate}T${newMeetingTime}`).toISOString(),
        durationLabel: newMeetingDuration,
        client: newMeetingClient.trim() || undefined,
        clientEmail: newMeetingClientEmail.trim() || undefined,
        location: newMeetingPlatform !== 'Phone' ? (newMeetingLocation.trim() || undefined) : undefined,
        phone: newMeetingPlatform === 'Phone' ? (newMeetingPhone.trim() || undefined) : undefined,
        platform: newMeetingPlatform as 'In-person' | 'Zoom' | 'Phone',
        kind: newMeetingType as 'meeting' | 'viewing' | 'signing',
      });
      closeAddModal();
      refetch();
      // Google Takvim senkron durumunu dürüstçe bildir.
      if (created.gcalSync === 'synced') toast.success(t('meetings.gcalSynced'));
      else if (created.gcalSync === 'reauth') toast.info(t('meetings.gcalReauth'));
      else if (created.gcalSync === 'failed') toast.info(t('meetings.gcalFailed'));
      else toast.success(t('meetings.created'));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('meetings.createError');
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Görüntülenen ay için gerçek takvim ızgarası (Pazartesi başlangıç).
  const cells = useMemo<DayCell[]>(() => {
    const today = new Date();
    const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // ay içindeki toplantıları güne göre grupla
    const byDay = new Map<number, MeetingDTO[]>();
    for (const m of meetings) {
      if (!m.date) continue;
      const dt = new Date(m.date);
      if (dt.getFullYear() === viewYear && dt.getMonth() === viewMonth) {
        const list = byDay.get(dt.getDate()) ?? [];
        list.push(m);
        byDay.set(dt.getDate(), list);
      }
    }

    const out: DayCell[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push({ inMonth: false, events: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
      out.push({ inMonth: true, day: d, isToday, events: byDay.get(d) ?? [] });
    }
    while (out.length % 7 !== 0) out.push({ inMonth: false, events: [] });
    return out;
  }, [meetings, viewYear, viewMonth]);

  // Yaklaşan: bugünden sonraki toplantılar, artan sırada.
  const upcoming = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return meetings
      .filter((m) => m.date && new Date(m.date) >= start)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
      .slice(0, 6);
  }, [meetings]);

  const monthTitle = viewDate.toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) => setViewDate(new Date(viewYear, viewMonth + delta, 1));

  const pillClass = (kind: string) =>
    kind === 'viewing' ? styles.eventViewing : kind === 'signing' ? styles.eventSigning : styles.eventMeeting;

  const openMeetingDetails = (m: MeetingDTO) => { setSelectedMeeting(m); setShowDetailsModal(true); };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('meetings.title')}</h1>
          <p className={styles.subtitle}>{t('meetings.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.syncBadge} title={t('meetings.gcalBadgeHint')}>
            <CalendarIcon size={16} />
            {t('meetings.gcalBadge')}
          </div>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> {t('meetings.newAppointment')}
          </Button>
        </div>
      </div>

      {error ? (
        <div className={styles.errorState}>{t('meetings.loadError')}: {error}</div>
      ) : (
      <div className={styles.layout}>
        {/* Ana Takvim */}
        <Card className={styles.calendarCard}>
          <div className={styles.calendarHeader}>
            <div className={styles.monthNav}>
              <button className={styles.navBtn} onClick={() => shiftMonth(-1)}><CaretLeft size={20} /></button>
              <h2 className={styles.monthTitle}>{monthTitle}</h2>
              <button className={styles.navBtn} onClick={() => shiftMonth(1)}><CaretRight size={20} /></button>
            </div>
            <div className={styles.viewToggles}>
              <button className={`${styles.viewBtn} ${styles.viewBtnActive}`}>{t('meetings.month')}</button>
            </div>
          </div>

          <div className={styles.calendarGrid}>
            {DAYS.map((day) => (<div key={day} className={styles.dayName}>{day}</div>))}

            {cells.map((cell, idx) => (
              <div key={idx} className={`${styles.dayCell} ${!cell.inMonth ? styles.dayCellOtherMonth : ''}`}>
                {cell.inMonth && (
                  <>
                    <div className={styles.dayHeader}>
                      <span className={`${styles.dayNumber} ${cell.isToday ? styles.dayNumberToday : ''}`}>{cell.day}</span>
                    </div>
                    <div className={styles.dayEvents}>
                      {cell.events.map((ev) => (
                        <div
                          key={ev.id}
                          className={`${styles.eventPill} ${pillClass(ev.kind)}`}
                          title={`${fmtTime(ev.date)} - ${ev.title}`}
                          onClick={() => openMeetingDetails(ev)}
                          style={{ cursor: 'pointer' }}
                        >
                          {fmtTime(ev.date)} {ev.title}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {loading && <div className={styles.calendarLoading}>{t('common.loading')}</div>}
        </Card>

        {/* Sidebar: Yaklaşan */}
        <Card className={styles.sidebarList}>
          <div className={styles.sidebarHeader}>
            <h3 className={styles.sidebarTitle}>{t('meetings.upcomingAppointments')}</h3>
          </div>
          <div className={styles.sidebarContent}>
            {!loading && upcoming.length === 0 && (
              <div style={{ padding: 'var(--sp-4)', color: 'var(--text-muted)' }}>{t('dashboard.noMeetings')}</div>
            )}
            {upcoming.map((m) => (
              <div key={m.id} className={styles.dateSection}>
                <div className={styles.dateHeader}>{fmtDateLong(m.date)}</div>
                <div
                  className={styles.meetingCard}
                  onClick={() => openMeetingDetails(m)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.meetingTime}>{fmtTime(m.date)}{m.durationLabel ? ` · ${m.durationLabel}` : ''}</div>
                  <div className={styles.meetingTitle}>{m.title}</div>
                  <div className={styles.meetingClient}>
                    <User size={14} /> {m.client || 'N/A'}
                  </div>
                  <div className={styles.meetingMeta}>
                    <div className={styles.metaItem}>
                      {m.platform === 'Zoom' ? <VideoCamera size={14} /> : <MapPin size={14} />} {m.location || m.platform || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      )}

      {/* Toplantı Detay Modalı */}
      {selectedMeeting && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={t('meetings.details')}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>{t('common.close')}</Button>
              <Button variant="primary" onClick={() => toast.info(t('meetings.editSoon'))}>{t('meetings.edit')}</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{selectedMeeting.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={16} /> {fmtDateLong(selectedMeeting.date)}
              </p>
              <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} /> {fmtTime(selectedMeeting.date)} {selectedMeeting.durationLabel ? `(${selectedMeeting.durationLabel})` : ''}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-surface-hover)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('meetings.client')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  <User size={14} /> {selectedMeeting.client || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('meetings.locationPlatform')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {selectedMeeting.platform === 'Zoom' ? <VideoCamera size={14} />
                    : selectedMeeting.platform === 'Phone' ? <Phone size={14} />
                    : <MapPin size={14} />}
                  {selectedMeeting.platform === 'Phone'
                    ? (selectedMeeting.phone || t('meetings.phone'))
                    : (selectedMeeting.location || selectedMeeting.platform || 'N/A')}
                </span>
                {selectedMeeting.platform === 'In-person' && selectedMeeting.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedMeeting.location)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 500 }}
                  >
                    <MapPin size={12} /> {t('meetings.openInMaps')}
                  </a>
                )}
                {selectedMeeting.platform === 'Phone' && selectedMeeting.phone && (
                  <a
                    href={`tel:${selectedMeeting.phone.replace(/\s+/g, '')}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 500 }}
                  >
                    <Phone size={12} /> {t('meetings.callNow')}
                  </a>
                )}
              </div>
            </div>

            <div>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
                <FileText size={16} /> {t('meetings.notes')}
              </span>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                {selectedMeeting.notes || t('meetings.noNotes')}
              </p>
            </div>

            {selectedMeeting.platform === 'Zoom' && (
              <Button variant="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => toast.info(t('meetings.joiningZoom'))}>
                <VideoCamera size={16} /> {t('meetings.joinZoom')}
              </Button>
            )}
          </div>
        </Modal>
      )}

      {/* Yeni Randevu Modalı */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddModal}
        title={t('meetings.scheduleNew')}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeAddModal} disabled={isCreating}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleCreateMeeting} disabled={isCreating}>
              {isCreating ? t('common.saving') : t('meetings.schedule')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.formGroup}>
            <label>{t('meetings.titlePurpose')}</label>
            <input
              type="text"
              className={styles.textInput}
              placeholder={t('meetings.titlePlaceholder')}
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
            />
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('meetings.type')}</label>
              <SelectMenu
                aria-label={t('meetings.type')}
                value={newMeetingType}
                onChange={setNewMeetingType}
                options={[
                  { value: 'meeting', label: t('meetings.typeConsultation') },
                  { value: 'viewing', label: t('meetings.typeViewing') },
                  { value: 'signing', label: t('meetings.typeSigning') },
                ]}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('meetings.platform')}</label>
              <SelectMenu
                aria-label={t('meetings.platform')}
                value={newMeetingPlatform}
                onChange={setNewMeetingPlatform}
                options={[
                  { value: 'In-person', label: t('meetings.inPerson') },
                  { value: 'Zoom', label: 'Zoom' },
                  { value: 'Phone', label: t('meetings.phone') },
                ]}
              />
            </div>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('common.date')}</label>
              <input
                type="date"
                className={styles.textInput}
                value={newMeetingDate}
                onChange={(e) => setNewMeetingDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('meetings.time')}</label>
              <input
                type="time"
                className={styles.textInput}
                value={newMeetingTime}
                onChange={(e) => setNewMeetingTime(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('meetings.duration')}</label>
              <SelectMenu
                aria-label={t('meetings.duration')}
                value={newMeetingDuration}
                onChange={setNewMeetingDuration}
                options={[
                  { value: '30m', label: t('meetings.dur30m') },
                  { value: '45m', label: t('meetings.dur45m') },
                  { value: '1h', label: t('meetings.dur1h') },
                  { value: '1h 30m', label: t('meetings.dur90m') },
                  { value: '2h', label: t('meetings.dur2h') },
                ]}
              />
            </div>
          </div>
          {newMeetingPhone !== undefined && newMeetingPlatform === 'Phone' ? (
            <div className={styles.formGroup}>
              <label>{t('meetings.phoneLabel')}</label>
              <input
                type="tel"
                className={styles.textInput}
                placeholder={t('meetings.phonePlaceholder')}
                value={newMeetingPhone}
                onChange={(e) => setNewMeetingPhone(e.target.value)}
              />
            </div>
          ) : (
            <div className={styles.formGroup}>
              <label>{newMeetingPlatform === 'Zoom' ? t('meetings.zoomLinkLabel') : t('meetings.addressLabel')}</label>
              <input
                type="text"
                className={styles.textInput}
                placeholder={newMeetingPlatform === 'Zoom' ? t('meetings.zoomLinkPlaceholder') : t('meetings.addressPlaceholder')}
                value={newMeetingLocation}
                onChange={(e) => setNewMeetingLocation(e.target.value)}
              />
              {newMeetingPlatform === 'In-person' && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  {t('meetings.addressHint')}
                </span>
              )}
            </div>
          )}
          <div className={styles.formGroup}>
            <label>{t('meetings.clientLabel')}</label>
            <input
              type="text"
              className={styles.textInput}
              placeholder={t('meetings.clientPlaceholder')}
              value={newMeetingClient}
              onChange={(e) => setNewMeetingClient(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t('meetings.clientEmailLabel')}</label>
            <input
              type="email"
              className={styles.textInput}
              placeholder={t('meetings.clientEmailPlaceholder')}
              value={newMeetingClientEmail}
              onChange={(e) => setNewMeetingClientEmail(e.target.value)}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>{t('meetings.clientEmailHint')}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};
