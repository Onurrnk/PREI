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

  // Mini ay takvimi: randevu olan günler işaretli (Komuta Merkezi'nde).
  const miniCal = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const firstWeekday = (new Date(y, mo, 1).getDay() + 6) % 7; // Pzt=0
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const meetingDays = new Set<number>();
    for (const m of meetingsData ?? []) {
      if (!m.date) continue;
      const d = new Date(m.date);
      if (d.getFullYear() === y && d.getMonth() === mo) meetingDays.add(d.getDate());
    }
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return {
      cells, meetingDays, today: now.getDate(),
      monthLabel: now.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }),
    };
  }, [meetingsData, dateLocale]);

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
            {/* Mini ay takvimi — randevu olan günler vurgulu; her güne tıklayınca Toplantılar */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {miniCal.monthLabel}
                </span>
                <button
                  onClick={() => navigate('/meetings')}
                  style={{ border: 'none', background: 'transparent', color: 'var(--brand-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {t('dashboard.openCalendar')}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, maxWidth: 280 }}>
                {[t('dashboard.dow.mon'), t('dashboard.dow.tue'), t('dashboard.dow.wed'), t('dashboard.dow.thu'), t('dashboard.dow.fri'), t('dashboard.dow.sat'), t('dashboard.dow.sun')].map((d, i) => (
                  <div key={`h${i}`} style={{ textAlign: 'center', fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 500, paddingBottom: 2 }}>{d}</div>
                ))}
                {miniCal.cells.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} />;
                  const isToday = d === miniCal.today;
                  const hasMeeting = miniCal.meetingDays.has(d);
                  return (
                    <button
                      key={`d${d}`}
                      onClick={() => navigate('/meetings')}
                      title={hasMeeting ? t('dashboard.hasAppointment') : t('dashboard.openCalendar')}
                      className={styles.miniCalDay}
                      style={{
                        position: 'relative', height: 30, width: '100%', border: 'none', cursor: 'pointer',
                        borderRadius: 'var(--radius-control, 6px)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                        background: isToday ? 'var(--brand-primary)' : hasMeeting ? 'var(--brand-primary-soft, rgba(155,91,179,0.14))' : 'transparent',
                        color: isToday ? 'var(--on-brand, #fff)' : 'var(--text-primary)',
                        fontWeight: isToday || hasMeeting ? 600 : 400,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {d}
                      {hasMeeting && !isToday && (
                        <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--brand-primary)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
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
