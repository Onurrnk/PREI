import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import {
  TrendUp,
  TrendDown,
  VideoCamera,
  MapPin,
  CheckSquare,
  CalendarBlank,
  ChartBar,
} from '@phosphor-icons/react';
import { TrendArea, Sparkline, DonutMetric, HBarCompare, fmtEUR } from '../../core/charts';
import styles from './Dashboard.module.css';

// ---------------------------------------------------------------------
// Mock veri — Faz 1'de gerçek API'ye bağlanacak. Sayılar temsilidir.
// ---------------------------------------------------------------------

interface KPI {
  id: string;
  label: string;
  value: string;
  delta: number; // yüzde
  spark: number[];
}

const kpis: KPI[] = [
  { id: 'pipeline', label: 'Pipeline Value', value: '€4.72M', delta: 8.4, spark: [3.1, 3.3, 3.2, 3.6, 3.5, 3.9, 4.1, 4.0, 4.3, 4.5, 4.6, 4.72] },
  { id: 'leads', label: 'Active Leads', value: '28', delta: 12.0, spark: [19, 21, 20, 22, 24, 23, 25, 24, 26, 27, 26, 28] },
  { id: 'meetings', label: 'Meetings This Week', value: '6', delta: -14.3, spark: [8, 7, 9, 6, 7, 8, 7, 9, 8, 7, 7, 6] },
  { id: 'closed', label: 'Closed Won (YTD)', value: '€12.4M', delta: 6.1, spark: [7.2, 7.8, 8.1, 8.9, 9.4, 9.8, 10.3, 10.9, 11.2, 11.8, 12.1, 12.4] },
];

const pipelineTrend = [
  { label: 'W14', value: 3_120_000 },
  { label: 'W15', value: 3_310_000 },
  { label: 'W16', value: 3_240_000 },
  { label: 'W17', value: 3_580_000 },
  { label: 'W18', value: 3_460_000 },
  { label: 'W19', value: 3_890_000 },
  { label: 'W20', value: 4_070_000 },
  { label: 'W21', value: 3_980_000 },
  { label: 'W22', value: 4_310_000 },
  { label: 'W23', value: 4_490_000 },
  { label: 'W24', value: 4_570_000 },
  { label: 'W25', value: 4_720_000 },
];

const marketSplit = [
  { name: 'Türkiye', value: 2_740_000 },
  { name: 'Dubai (UAE)', value: 1_980_000 },
];

const leadSources = [
  { name: 'WhatsApp', value: 14 },
  { name: 'Instagram', value: 9 },
  { name: 'Referral', value: 6 },
  { name: 'Website', value: 4 },
  { name: 'Direct', value: 3 },
];

const meetings = [
  { id: 'm1', title: 'Client Viewing: Marina Vista 2B', with: 'Selin Vural', time: '14:00', kind: 'in-person' as const },
  { id: 'm2', title: 'Negotiation Call', with: 'Khalid Al Mansoori', time: '16:00', kind: 'video' as const },
  { id: 'm3', title: 'Developer Briefing: Emaar', with: 'Rania Haddad', time: 'Tomorrow 10:00', kind: 'in-person' as const },
];

const tasks = [
  { id: 't1', title: 'Send revised SPA to legal — Al Reem 1204', status: 'Urgent' as const },
  { id: 't2', title: 'Follow up: Selin Vural (Kadıköy 3+1)', status: 'Today' as const },
  { id: 't3', title: 'Prepare Q3 portfolio report', status: 'This Week' as const },
  { id: 't4', title: 'Verify title deed copy — DXB-0117', status: 'This Week' as const },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Command Center</h1>
          <p className={styles.subtitle}>Pipeline, schedule and portfolio at a glance.</p>
        </div>
        <span className={styles.headerDate}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>

      {/* KPI şeridi — Design System §5.1 anatomisi */}
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <Card key={kpi.id} padding="md">
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{kpi.value}</span>
                <span className={`${styles.kpiDelta} ${kpi.delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
                  {kpi.delta >= 0 ? <TrendUp size={14} /> : <TrendDown size={14} />}
                  {Math.abs(kpi.delta).toFixed(1)}%
                </span>
              </div>
              <div className={styles.kpiSpark}>
                <Sparkline data={kpi.spark} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Ana grid: trend + pazar dağılımı */}
      <div className={styles.mainGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Pipeline Momentum</h2>
            <span className={styles.cardMeta}>last 12 weeks</span>
          </div>
          <TrendArea data={pipelineTrend} formatValue={fmtEUR} name="Pipeline" height={280} />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Portfolio by Market</h2>
          </div>
          <DonutMetric
            data={marketSplit}
            centerValue="€4.72M"
            centerLabel="Total"
            formatValue={fmtEUR}
            height={192}
          />
        </Card>
      </div>

      {/* Alt grid: kaynaklar + takvim + görevler */}
      <div className={styles.bottomGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>
              <ChartBar size={16} className={styles.titleIcon} /> Lead Sources
            </h2>
            <span className={styles.cardMeta}>30 days</span>
          </div>
          <HBarCompare data={leadSources} />
        </Card>

        <Card padding="none">
          <CardHeader>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>
                <CalendarBlank size={16} className={styles.titleIcon} /> Schedule
              </h2>
            </div>
          </CardHeader>
          <CardBody padding="none">
            <div className={styles.listWidget}>
              {meetings.map((m) => (
                <button key={m.id} className={styles.listItem} onClick={() => navigate('/meetings')}>
                  <span className={styles.itemIcon}>
                    {m.kind === 'video' ? <VideoCamera size={18} /> : <MapPin size={18} />}
                  </span>
                  <span className={styles.itemContent}>
                    <span className={styles.itemTitle}>{m.title}</span>
                    <span className={styles.itemSub}>{m.with}</span>
                  </span>
                  <span className={styles.itemTime}>{m.time}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card padding="none">
          <CardHeader>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>
                <CheckSquare size={16} className={styles.titleIcon} /> Priority Tasks
              </h2>
            </div>
          </CardHeader>
          <CardBody padding="none">
            <div className={styles.listWidget}>
              {tasks.map((t) => (
                <button key={t.id} className={styles.listItem} onClick={() => navigate('/tasks')}>
                  <span className={styles.itemContent}>
                    <span className={styles.itemTitle}>{t.title}</span>
                  </span>
                  <span className={`${styles.statusChip} ${t.status === 'Urgent' ? styles.statusUrgent : ''}`}>
                    {t.status}
                  </span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
