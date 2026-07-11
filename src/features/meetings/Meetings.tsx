import React, { useMemo, useState } from 'react';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { CalendarBlank as CalendarIcon, CaretLeft, CaretRight, Plus, MapPin, User, VideoCamera, ArrowsClockwise, Clock, FileText } from '@phosphor-icons/react';
import type { MeetingDTO } from '../../core/types';
import { meetingsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import styles from './Meetings.module.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fmtTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDateLong = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';

interface DayCell { inMonth: boolean; day?: number; iso?: string; isToday?: boolean; events: MeetingDTO[] }

export const Meetings: React.FC = () => {
  const { data, loading, error } = useFetch<MeetingDTO[]>(() => meetingsApi.list(), []);
  const meetings = useMemo(() => data ?? [], [data]);

  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMeetingType, setNewMeetingType] = useState('meeting');
  const [newMeetingPlatform, setNewMeetingPlatform] = useState('In-person');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDTO | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();

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

  const monthTitle = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) => setViewDate(new Date(viewYear, viewMonth + delta, 1));

  const pillClass = (kind: string) =>
    kind === 'viewing' ? styles.eventViewing : kind === 'signing' ? styles.eventSigning : styles.eventMeeting;

  const handleSync = () => {
    setIsSyncing(true);
    // Google Takvim entegrasyonu ayrı bir faz — şimdilik simüle.
    setTimeout(() => { setIsSyncing(false); toast.info('Google Takvim senkronu ayrı entegrasyon fazında bağlanacak.'); }, 900);
  };

  const openMeetingDetails = (m: MeetingDTO) => { setSelectedMeeting(m); setShowDetailsModal(true); };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Meetings & Calendar</h1>
          <p className={styles.subtitle}>Manage your schedule, viewings, and client appointments</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.syncBadge}>
            <CalendarIcon size={16} />
            Google Calendar (coming soon)
          </div>
          <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
            <ArrowsClockwise size={16} className={isSyncing ? 'spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> New Appointment
          </Button>
        </div>
      </div>

      {error ? (
        <div className={styles.errorState}>Toplantılar yüklenemedi: {error}</div>
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
              <button className={`${styles.viewBtn} ${styles.viewBtnActive}`}>Month</button>
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
          {loading && <div className={styles.calendarLoading}>Takvim yükleniyor…</div>}
        </Card>

        {/* Sidebar: Yaklaşan */}
        <Card className={styles.sidebarList}>
          <div className={styles.sidebarHeader}>
            <h3 className={styles.sidebarTitle}>Upcoming Appointments</h3>
          </div>
          <div className={styles.sidebarContent}>
            {!loading && upcoming.length === 0 && (
              <div style={{ padding: 'var(--sp-4)', color: 'var(--text-muted)' }}>Yaklaşan toplantı yok.</div>
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
          title="Meeting Details"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>Close</Button>
              <Button variant="primary" onClick={() => toast.info('Toplantı düzenleme sonraki adımda bağlanacak.')}>Edit Meeting</Button>
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
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Client</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  <User size={14} /> {selectedMeeting.client || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Location / Platform</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {selectedMeeting.platform === 'Zoom' ? <VideoCamera size={14} /> : <MapPin size={14} />}
                  {selectedMeeting.location || selectedMeeting.platform || 'N/A'}
                </span>
              </div>
            </div>

            <div>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
                <FileText size={16} /> Notes
              </span>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                {selectedMeeting.notes || 'No notes provided for this meeting.'}
              </p>
            </div>

            {selectedMeeting.platform === 'Zoom' && (
              <Button variant="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => toast.info('Zoom toplantısına katılınıyor…')}>
                <VideoCamera size={16} /> Join Zoom Meeting
              </Button>
            )}
          </div>
        </Modal>
      )}

      {/* Yeni Randevu Modalı (create sonraki adımda bağlanacak) */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Schedule New Appointment"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              toast.info('Randevu oluşturma sonraki adımda (tasks create) bağlanacak.');
              setShowAddModal(false);
            }}>Schedule Appointment</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.formGroup}>
            <label>Meeting Title / Purpose</label>
            <input type="text" className={styles.textInput} placeholder="e.g. Property Viewing - Marina Vista" />
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Meeting Type</label>
              <SelectMenu
                aria-label="Meeting Type"
                value={newMeetingType}
                onChange={setNewMeetingType}
                options={[
                  { value: 'meeting', label: 'Consultation' },
                  { value: 'viewing', label: 'Property Viewing' },
                  { value: 'signing', label: 'Contract Signing' },
                ]}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Platform</label>
              <SelectMenu
                aria-label="Platform"
                value={newMeetingPlatform}
                onChange={setNewMeetingPlatform}
                options={[
                  { value: 'In-person', label: 'In-person' },
                  { value: 'Zoom', label: 'Zoom' },
                ]}
              />
            </div>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Date</label>
              <input type="date" className={styles.textInput} />
            </div>
            <div className={styles.formGroup}>
              <label>Time</label>
              <input type="time" className={styles.textInput} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>Location / Link</label>
            <input type="text" className={styles.textInput} placeholder="Link or exact address" />
          </div>
        </div>
      </Modal>
    </div>
  );
};
