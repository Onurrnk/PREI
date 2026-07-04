import React, { useState } from 'react';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { CalendarBlank as CalendarIcon, CaretLeft, CaretRight, Plus, MapPin, User, VideoCamera, ArrowsClockwise, Clock, FileText } from '@phosphor-icons/react';
import styles from './Meetings.module.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Takvim hücresi ve "upcoming" kartlarının ortak şekli — detay modalı ikisini de açar.
interface MeetingItem {
  id: number;
  title: string;
  time: string;
  client: string;
  location: string;
  platform: string;
  notes: string;
  type?: string;
  duration?: string;
  date?: string;
  icon?: React.ReactNode;
}

export const Meetings: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();

  // Generating a mock 35-day grid (5 weeks)
  const currentMonthDays = Array.from({ length: 35 }, (_, i) => {
    const day = i - 2; // Offset to simulate previous month days
    return {
      date: day,
      isCurrentMonth: day > 0 && day <= 30,
      isToday: day === 15,
      events: day === 12 ? [
        { id: 1, title: 'Viewing: Marina Vista', type: 'viewing', time: '10:00 AM', duration: '1h', client: 'John Doe', location: 'Marina Vista Tower B', platform: 'In-person', notes: 'Client is interested in 3BR units with sea view.' },
        { id: 2, title: 'Consultation: M. Smith', type: 'meeting', time: '02:00 PM', duration: '45m', client: 'Michael Smith', location: 'Zoom', platform: 'Zoom', notes: 'Initial consultation regarding off-plan investments.' }
      ] : day === 15 ? [
        { id: 3, title: 'Contract Signing', type: 'signing', time: '11:30 AM', duration: '1h', client: 'Elena Rodriguez', location: 'Emaar Sales Center', platform: 'In-person', notes: 'Ensure all SPA documents are printed and ready.' }
      ] : day === 22 ? [
        { id: 4, title: 'Zoom: Project Pitch', type: 'meeting', time: '04:00 PM', duration: '1h', client: 'Michael Smith', location: 'Zoom', platform: 'Zoom', notes: 'Pitching Safa Two project.' }
      ] : []
    };
  });

  const upcomingMeetings = [
    { id: 3, title: 'Contract Signing: Marina Vista', date: 'Today, Jun 15', time: '11:30 AM - 12:30 PM', client: 'Elena Rodriguez (VIP Investor)', location: 'Emaar Sales Center', platform: 'In-person', icon: <MapPin size={14} />, notes: 'Ensure all SPA documents are printed and ready.' },
    { id: 4, title: 'Project Pitch: Safa Two', date: 'Next Week, Jun 22', time: '04:00 PM - 05:00 PM', client: 'Michael Smith', location: 'Zoom', platform: 'Zoom', icon: <VideoCamera size={14} />, notes: 'Pitching Safa Two project.' }
  ];

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success("Google Takvim senkronizasyonu tamamlandı");
    }, 1500);
  };

  const openMeetingDetails = (meeting: MeetingItem) => {
    setSelectedMeeting(meeting);
    setShowDetailsModal(true);
  };

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
            Synced with Google Calendar
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

      <div className={styles.layout}>
        {/* Main Calendar Area */}
        <Card className={styles.calendarCard}>
          <div className={styles.calendarHeader}>
            <div className={styles.monthNav}>
              <button className={styles.navBtn}><CaretLeft size={20} /></button>
              <h2 className={styles.monthTitle}>June 2026</h2>
              <button className={styles.navBtn}><CaretRight size={20} /></button>
            </div>
            <div className={styles.viewToggles}>
              <button className={`${styles.viewBtn} ${styles.viewBtnActive}`}>Month</button>
              <button className={styles.viewBtn}>Week</button>
              <button className={styles.viewBtn}>Day</button>
            </div>
          </div>
          
          <div className={styles.calendarGrid}>
            {DAYS.map(day => (
              <div key={day} className={styles.dayName}>{day}</div>
            ))}
            
            {currentMonthDays.map((dayObj, idx) => (
              <div 
                key={idx} 
                className={`${styles.dayCell} ${!dayObj.isCurrentMonth ? styles.dayCellOtherMonth : ''}`}
              >
                <div className={styles.dayHeader}>
                  <span className={`${styles.dayNumber} ${dayObj.isToday ? styles.dayNumberToday : ''}`}>
                    {dayObj.date > 0 && dayObj.date <= 30 ? dayObj.date : dayObj.date <= 0 ? 31 + dayObj.date : dayObj.date - 30}
                  </span>
                </div>
                <div className={styles.dayEvents}>
                  {dayObj.events.map(event => (
                    <div 
                      key={event.id} 
                      className={`${styles.eventPill} ${
                        event.type === 'viewing' ? styles.eventViewing :
                        event.type === 'signing' ? styles.eventSigning : styles.eventMeeting
                      }`}
                      title={`${event.time} - ${event.title}`}
                      onClick={() => openMeetingDetails({...event, date: `June ${dayObj.date > 0 && dayObj.date <= 30 ? dayObj.date : ''}, 2026`})}
                      style={{ cursor: 'pointer' }}
                    >
                      {event.time} {event.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Sidebar: Upcoming List */}
        <Card className={styles.sidebarList}>
          <div className={styles.sidebarHeader}>
            <h3 className={styles.sidebarTitle}>Upcoming Appointments</h3>
          </div>
          <div className={styles.sidebarContent}>
            
            {upcomingMeetings.map((meeting, i) => (
              <div key={i} className={styles.dateSection}>
                <div className={styles.dateHeader}>{meeting.date}</div>
                
                <div 
                  className={styles.meetingCard} 
                  onClick={() => openMeetingDetails(meeting)}
                  style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div className={styles.meetingTime}>{meeting.time}</div>
                  <div className={styles.meetingTitle}>{meeting.title}</div>
                  <div className={styles.meetingClient}>
                    <User size={14} /> {meeting.client}
                  </div>
                  <div className={styles.meetingMeta}>
                    <div className={styles.metaItem}>
                      {meeting.icon} {meeting.location}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          </div>
        </Card>
      </div>

      {/* Meeting Details Modal */}
      {selectedMeeting && (
        <Modal 
          isOpen={showDetailsModal} 
          onClose={() => setShowDetailsModal(false)}
          title="Meeting Details"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>Close</Button>
              <Button variant="primary">Edit Meeting</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{selectedMeeting.title}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={16} /> {selectedMeeting.date}
              </p>
              <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} /> {selectedMeeting.time} {selectedMeeting.duration ? `(${selectedMeeting.duration})` : ''}
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
                  {selectedMeeting.location || 'N/A'}
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

      {/* New Appointment Modal */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        title="Schedule New Appointment"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              toast.success("Randevu oluşturuldu ve Google Takvim ile senkronlandı");
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
              <label>Client</label>
              <select className={styles.selectInput}>
                <option value="">Select a client...</option>
                <option value="1">Elena Rodriguez</option>
                <option value="2">Michael Smith</option>
                <option value="new">+ Add New Client</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Meeting Type</label>
              <select className={styles.selectInput}>
                <option value="consultation">Initial Consultation</option>
                <option value="viewing">Property Viewing</option>
                <option value="signing">Contract Signing</option>
                <option value="handover">Key Handover</option>
              </select>
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
            <label>Location / Platform</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select className={styles.selectInput} style={{ width: '150px' }}>
                <option value="office">HQ Office</option>
                <option value="site">Project Site</option>
                <option value="zoom">Zoom</option>
                <option value="teams">MS Teams</option>
              </select>
              <input type="text" className={styles.textInput} placeholder="Link or exact address" style={{ flex: 1 }} />
            </div>
          </div>
          
          <div className={styles.formGroup} style={{ marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
              <input type="checkbox" defaultChecked />
              Add to Google Calendar & Send Invitation to Client
            </label>
          </div>

        </div>
      </Modal>
    </div>
  );
};
