import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { useToast } from '../../core/components/Toast/ToastProvider';
import {
  TrendingUp, Users, Briefcase, Mail, Calendar,
  CheckSquare, ArrowRight, Video, MapPin, DollarSign
} from 'lucide-react';
import styles from './Dashboard.module.css';

// Mock Data specific for "This Week" Focus
const weeklyKPIs = [
  { id: 'k1', title: 'Sales This Week', value: '4', trend: 'up', percentage: 25 },
  { id: 'k2', title: 'Leads This Week', value: '12', trend: 'up', percentage: 10 },
  { id: 'k3', title: 'Total Sales (YTD)', value: '42', trend: 'neutral', percentage: 0 },
  { id: 'k4', title: 'Pending Sales', value: '5', trend: 'down', percentage: -2 },
];

const mockEmails = [
  { id: 'e1', sender: 'John Doe', subject: 'Re: Beachfront Property Offer', preview: 'Hi Sarah, I reviewed the SPA and I am ready to move forward...', time: '10:30 AM', unread: true },
  { id: 'e2', sender: 'Emaar Developer', subject: 'New Project Launch: Downtown View', preview: 'Exclusive broker briefing tomorrow at 10 AM. Please register...', time: '09:15 AM', unread: true },
  { id: 'e3', sender: 'Jane Smith', subject: 'Viewing Confirmation', preview: 'Looking forward to seeing the Marina villa at 3 PM today.', time: 'Yesterday', unread: false },
  { id: 'e4', sender: 'Legal Dept', subject: 'Contract Approved (CL-10024)', preview: 'The revisions for Mr. Al Fayed are approved and ready to sign.', time: 'Yesterday', unread: false },
];

const mockMeetings = [
  { id: 'm1', title: 'Client Viewing: Marina Vista', time: '14:00 - 15:30', type: 'In-person', location: 'Dubai Marina', color: '#3b82f6' },
  { id: 'm2', title: 'Negotiation Call: John Doe', time: '16:00 - 16:45', type: 'Zoom', location: 'Online Link', color: '#10b981' },
  { id: 'm3', title: 'Developer Briefing: Emaar', time: 'Tomorrow, 10:00', type: 'In-person', location: 'Downtown', color: '#8b5cf6' },
];

const mockTasks = [
  { id: 't1', title: 'Send revised SPA to Legal', status: 'Urgent', done: false },
  { id: 't2', title: 'Follow up with Jane Smith', status: 'Today', done: false },
  { id: 't3', title: 'Prepare Q2 Performance Report', status: 'This Week', done: false },
  { id: 't4', title: 'Update CRM for new leads', status: 'Done', done: true },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Weekly Control Center</h1>
        <p className={styles.subtitle}>Your schedule, communications, and performance for this week.</p>
      </div>

      {/* This Week's KPIs */}
      <div className={styles.kpiGrid}>
        {weeklyKPIs.map((kpi) => (
          <Card key={kpi.id} padding="md">
            <div className={styles.kpiCard}>
              <h3 className={styles.kpiTitle}>{kpi.title}</h3>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{kpi.value}</span>
                <span className={`${styles.kpiTrend} ${styles[kpi.trend]}`}>
                  {kpi.trend === 'up' && <TrendingUp size={16} />}
                  {kpi.trend === 'down' && <TrendingUp size={16} style={{ transform: 'rotate(180deg)' }} />}
                  {kpi.percentage}%
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className={styles.mainGrid}>
        {/* Left Column (2fr) */}
        <div className={styles.leftCol}>
          
          {/* Quick Navigation Links */}
          <div className={styles.quickLinksGrid}>
            <div className={styles.quickLinkCard} onClick={() => navigate('/leads')}>
              <div className={`${styles.quickLinkIcon} ${styles.iconBlue}`}><Users size={24} /></div>
              <span className={styles.quickLinkLabel}>Leads & Clients</span>
            </div>
            <div className={styles.quickLinkCard} onClick={() => navigate('/projects')}>
              <div className={`${styles.quickLinkIcon} ${styles.iconPurple}`}><Briefcase size={24} /></div>
              <span className={styles.quickLinkLabel}>Projects</span>
            </div>
            <div className={styles.quickLinkCard} onClick={() => navigate('/financials')}>
              <div className={`${styles.quickLinkIcon} ${styles.iconGreen}`}><DollarSign size={24} /></div>
              <span className={styles.quickLinkLabel}>Financials</span>
            </div>
            <div className={styles.quickLinkCard} onClick={() => navigate('/meetings')}>
              <div className={`${styles.quickLinkIcon} ${styles.iconOrange}`}><Video size={24} /></div>
              <span className={styles.quickLinkLabel}>Meetings</span>
            </div>
          </div>

          {/* Email Widget */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={18} /> Recent Emails
                </div>
                <Button variant="ghost" size="sm" onClick={() => toast.info('Mail modülü yakında gelecek')}>
                  View All Inbox <ArrowRight size={14} style={{ marginLeft: '4px' }}/>
                </Button>
              </div>
            </CardHeader>
            <CardBody padding="none">
              <div className={styles.listWidget}>
                {mockEmails.map(email => (
                  <div key={email.id} className={styles.listItem} onClick={() => toast.info('E-posta açılıyor…')}>
                    <div className={styles.itemAvatar}>{email.sender.charAt(0)}</div>
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle}>
                        <span style={{ fontWeight: email.unread ? 700 : 500 }}>{email.sender}</span>
                        <span className={styles.itemTime}>{email.time}</span>
                      </div>
                      <div className={styles.itemSubtitle} style={{ fontWeight: email.unread ? 600 : 400, color: email.unread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {email.subject}
                      </div>
                      <div className={styles.itemTime}>{email.preview}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column (1fr) */}
        <div className={styles.rightCol}>
          
          {/* Calendar / Meetings Widget */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} /> This Week's Schedule
              </div>
            </CardHeader>
            <CardBody padding="none">
              <div className={styles.listWidget}>
                {mockMeetings.map(meeting => (
                  <div key={meeting.id} className={styles.listItem} onClick={() => navigate('/meetings')}>
                    <div className={styles.itemIcon} style={{ backgroundColor: meeting.color + '20', color: meeting.color }}>
                      {meeting.type === 'Zoom' ? <Video size={20} /> : <MapPin size={20} />}
                    </div>
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle}>{meeting.title}</div>
                      <div className={styles.itemTime}>{meeting.time} • {meeting.location}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Tasks Widget */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={18} /> Pending Tasks
              </div>
            </CardHeader>
            <CardBody padding="none">
              <div className={styles.listWidget}>
                {mockTasks.map(task => (
                  <div key={task.id} className={styles.listItem} style={{ opacity: task.done ? 0.6 : 1 }}>
                    <div className={styles.itemIcon} style={{ color: task.done ? 'var(--color-success)' : 'var(--text-muted)' }}>
                      <CheckSquare size={20} />
                    </div>
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle} style={{ textDecoration: task.done ? 'line-through' : 'none' }}>
                        {task.title}
                        <span className={styles.itemStatus} style={{ 
                          backgroundColor: task.status === 'Urgent' ? '#fecaca' : '',
                          color: task.status === 'Urgent' ? '#b91c1c' : ''
                        }}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

        </div>
      </div>
    </div>
  );
};
