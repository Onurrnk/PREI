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
import { useTranslation } from 'react-i18next';
import styles from './Dashboard.module.css';

// ---------------------------------------------------------------------
// TÜM kartlar gerçek veriye bağlı. Trend serileri backend'de mevcut
// kayıtlardan türetilir (durum geçmişi tablosu olmadığı için created_at/
// updated_at yaklaşımı — dashboard.service.ts başlığına bkz.).
// ---------------------------------------------------------------------

const fmtTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

// Son iki hafta arasındaki yüzde değişim; önceki 0 ise delta göstermeyiz.
const weeklyDelta = (series: number[] | undefined): number | null => {
  if (!series || series.length < 2) return null;
  const prev = series[series.length - 2];
  const last = series[series.length - 1];
  if (prev === 0) return null;
  return ((last - prev) / prev) * 100;
};

const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const { data: summary } = useFetch<DashboardSummaryDTO>(() => dashboardApi.summary(), []);
  const { data: meetingsData } = useFetch<MeetingDTO[]>(() => meetingsApi.list(), []);
  const { data: tasksData } = useFetch<TaskDTO[]>(() => tasksApi.list(), []);

  const trends = summary?.trends;
  const kpis = useMemo(() => [
    { id: 'pipeline', label: t('dashboard.kpi.pipelineValue'), value: summary ? fmtEUR(summary.pipelineValueEur) : '—', delta: weeklyDelta(trends?.pipelineEur), spark: trends?.pipelineEur ?? [] },
    { id: 'leads', label: t('dashboard.kpi.activeLeads'), value: summary ? String(summary.activeLeads) : '—', delta: weeklyDelta(trends?.activeLeads), spark: trends?.activeLeads ?? [] },
    { id: 'meetings', label: t('dashboard.kpi.meetingsWeek'), value: summary ? String(summary.meetingsThisWeek) : '—', delta: weeklyDelta(trends?.meetings), spark: trends?.meetings ?? [] },
    { id: 'closed', label: t('dashboard.kpi.closedWon'), value: summary ? fmtEUR(summary.closedWonEur) : '—', delta: weeklyDelta(trends?.closedWonEur), spark: trends?.closedWonEur ?? [] },
  ], [summary, trends, t]);

  // Haftalık pipeline momentumu — backend trend serisinden.
  const pipelineTrend = useMemo(
    () => (trends ? trends.weeks.map((label, i) => ({ label, value: trends.pipelineEur[i] ?? 0 })) : []),
    [trends],
  );

  const leadSources = summary?.leadSources ?? [];

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
          <h1 className={styles.title}>{t('dashboard.title')}</h1>
          <p className={styles.subtitle}>{t('dashboard.subtitle')}</p>
        </div>
        <span className={styles.headerDate}>{new Date().toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>

      {/* KPI şeridi — değer, delta ve sparkline gerçek trend serisinden */}
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <Card key={kpi.id} padding="md">
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{kpi.value}</span>
                {kpi.delta !== null && (
                  <span className={`${styles.kpiDelta} ${kpi.delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
                    {kpi.delta >= 0 ? <TrendUp size={14} /> : <TrendDown size={14} />}
                    {Math.abs(kpi.delta).toFixed(1)}%
                  </span>
                )}
              </div>
              {kpi.spark.length > 1 && (
                <div className={styles.kpiSpark}>
                  <Sparkline data={kpi.spark} />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Ana grid: trend (temsili) + pazar dağılımı (gerçek) */}
      <div className={styles.mainGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('dashboard.pipelineMomentum')}</h2>
            <span className={styles.cardMeta}>{t('dashboard.last12Weeks')}</span>
          </div>
          {pipelineTrend.length > 0 ? (
            <TrendArea data={pipelineTrend} formatValue={fmtEUR} name="Pipeline" height={280} />
          ) : (
            <div className={styles.emptyChart}>{t('dashboard.noPipelineData')}</div>
          )}
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('dashboard.portfolioByMarket')}</h2>
          </div>
          {marketSplit.length > 0 ? (
            <DonutMetric
              data={marketSplit}
              centerValue={fmtEUR(marketTotal)}
              centerLabel={t('common.total')}
              formatValue={fmtEUR}
              height={192}
            />
          ) : (
            <div className={styles.emptyChart}>{t('dashboard.noPipelineData')}</div>
          )}
        </Card>
      </div>

      {/* Alt grid: kaynaklar (temsili) + takvim + görevler (gerçek) */}
      <div className={styles.bottomGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>
              <ChartBar size={16} className={styles.titleIcon} /> {t('dashboard.leadSources')}
            </h2>
            <span className={styles.cardMeta}>{t('dashboard.days30')}</span>
          </div>
          {leadSources.length > 0 ? (
            <HBarCompare data={leadSources} />
          ) : (
            <div className={styles.emptyChart}>{t('dashboard.noLeadSources')}</div>
          )}
        </Card>

        <Card padding="none">
          <CardHeader>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>
                <CalendarBlank size={16} className={styles.titleIcon} /> {t('dashboard.schedule')}
              </h2>
            </div>
          </CardHeader>
          <CardBody padding="none">
            <div className={styles.listWidget}>
              {schedule.length === 0 && <div className={styles.listEmpty}>{t('dashboard.noMeetings')}</div>}
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
                <CheckSquare size={16} className={styles.titleIcon} /> {t('dashboard.priorityTasks')}
              </h2>
            </div>
          </CardHeader>
          <CardBody padding="none">
            <div className={styles.listWidget}>
              {priorityTasks.length === 0 && <div className={styles.listEmpty}>{t('dashboard.noTasks')}</div>}
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
