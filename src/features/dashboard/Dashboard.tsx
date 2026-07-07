import React, { useMemo } from 'react';
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
import type { DashboardSummaryDTO, MeetingDTO, TaskDTO } from '../../core/types';
import { dashboardApi, meetingsApi, tasksApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import styles from './Dashboard.module.css';

// ---------------------------------------------------------------------
// KPI başlık değerleri, market dağılımı, Schedule ve Priority Tasks GERÇEK
// veriye bağlı. Trend/sparkline/delta ve Lead Sources zaman-serisi/kaynak
// geçmişi ister → onlar temsili kalır (veri biriktikçe gerçeğe döner).
// ---------------------------------------------------------------------

// Sparkline ve delta: temsili micro-trend (geçmiş veri yok).
const SPARK: Record<string, number[]> = {
  pipeline: [3.1, 3.3, 3.2, 3.6, 3.5, 3.9, 4.1, 4.0, 4.3, 4.5, 4.6, 4.72],
  leads: [19, 21, 20, 22, 24, 23, 25, 24, 26, 27, 26, 28],
  meetings: [8, 7, 9, 6, 7, 8, 7, 9, 8, 7, 7, 6],
  closed: [7.2, 7.8, 8.1, 8.9, 9.4, 9.8, 10.3, 10.9, 11.2, 11.8, 12.1, 12.4],
};

// Temsili: haftalık pipeline momentumu (gerçek trend zaman-serisi ister).
const pipelineTrend = [
  { label: 'W14', value: 3_120_000 }, { label: 'W15', value: 3_310_000 },
  { label: 'W16', value: 3_240_000 }, { label: 'W17', value: 3_580_000 },
  { label: 'W18', value: 3_460_000 }, { label: 'W19', value: 3_890_000 },
  { label: 'W20', value: 4_070_000 }, { label: 'W21', value: 3_980_000 },
  { label: 'W22', value: 4_310_000 }, { label: 'W23', value: 4_490_000 },
  { label: 'W24', value: 4_570_000 }, { label: 'W25', value: 4_720_000 },
];

// Temsili: lead kaynakları (seed lead'lerde source verisi yok).
const leadSources = [
  { name: 'WhatsApp', value: 14 }, { name: 'Instagram', value: 9 },
  { name: 'Referral', value: 6 }, { name: 'Website', value: 4 }, { name: 'Direct', value: 3 },
];

const fmtTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: summary } = useFetch<DashboardSummaryDTO>(() => dashboardApi.summary(), []);
  const { data: meetingsData } = useFetch<MeetingDTO[]>(() => meetingsApi.list(), []);
  const { data: tasksData } = useFetch<TaskDTO[]>(() => tasksApi.list(), []);

  const kpis = useMemo(() => [
    { id: 'pipeline', label: 'Pipeline Value', value: summary ? fmtEUR(summary.pipelineValueEur) : '—', delta: 8.4, spark: SPARK.pipeline },
    { id: 'leads', label: 'Active Leads', value: summary ? String(summary.activeLeads) : '—', delta: 12.0, spark: SPARK.leads },
    { id: 'meetings', label: 'Meetings This Week', value: summary ? String(summary.meetingsThisWeek) : '—', delta: -14.3, spark: SPARK.meetings },
    { id: 'closed', label: 'Closed Won', value: summary ? fmtEUR(summary.closedWonEur) : '—', delta: 6.1, spark: SPARK.closed },
  ], [summary]);

  const marketSplit = useMemo(
    () => (summary?.marketSplit ?? []).map((m) => ({ name: m.name, value: m.valueEur })),
    [summary],
  );
  const marketTotal = useMemo(() => marketSplit.reduce((s, m) => s + m.value, 0), [marketSplit]);

  // Schedule: bugünden sonraki gerçek toplantılar (ilk 3).
  const schedule = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return (meetingsData ?? [])
      .filter((m) => m.date && new Date(m.date) >= start)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
      .slice(0, 3);
  }, [meetingsData]);

  // Priority Tasks: tamamlanmamış gerçek görevler, önceliğe göre (ilk 4).
  const priorityTasks = useMemo(() => {
    return (tasksData ?? [])
      .filter((t) => t.status !== 'Completed')
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3))
      .slice(0, 4);
  }, [tasksData]);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Command Center</h1>
          <p className={styles.subtitle}>Pipeline, schedule and portfolio at a glance.</p>
        </div>
        <span className={styles.headerDate}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>

      {/* KPI şeridi — başlık değerleri gerçek; spark/delta temsili */}
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

      {/* Ana grid: trend (temsili) + pazar dağılımı (gerçek) */}
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
          {marketSplit.length > 0 ? (
            <DonutMetric
              data={marketSplit}
              centerValue={fmtEUR(marketTotal)}
              centerLabel="Total"
              formatValue={fmtEUR}
              height={192}
            />
          ) : (
            <div className={styles.emptyChart}>Aktif pipeline verisi yok.</div>
          )}
        </Card>
      </div>

      {/* Alt grid: kaynaklar (temsili) + takvim + görevler (gerçek) */}
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
              {schedule.length === 0 && <div className={styles.listEmpty}>Yaklaşan toplantı yok.</div>}
              {schedule.map((m) => (
                <button key={m.id} className={styles.listItem} onClick={() => navigate('/meetings')}>
                  <span className={styles.itemIcon}>
                    {m.platform === 'Zoom' ? <VideoCamera size={18} /> : <MapPin size={18} />}
                  </span>
                  <span className={styles.itemContent}>
                    <span className={styles.itemTitle}>{m.title}</span>
                    <span className={styles.itemSub}>{m.client || '—'}</span>
                  </span>
                  <span className={styles.itemTime}>{fmtTime(m.date)}</span>
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
              {priorityTasks.length === 0 && <div className={styles.listEmpty}>Bekleyen görev yok.</div>}
              {priorityTasks.map((t) => (
                <button key={t.id} className={styles.listItem} onClick={() => navigate('/tasks')}>
                  <span className={styles.itemContent}>
                    <span className={styles.itemTitle}>{t.title}</span>
                  </span>
                  <span className={`${styles.statusChip} ${t.priority === 'High' ? styles.statusUrgent : ''}`}>
                    {t.priority}
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
