import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { EmptyState } from '../../core/components/EmptyState/EmptyState';
import {
  TrendUp,
  TrendDown,
  VideoCamera,
  MapPin,
  CheckSquare,
  CalendarBlank,
  ChartBar,
  ChartPieSlice,
  GlobeHemisphereWest,
  Megaphone,
  InstagramLogo,
  LinkedinLogo,
  XLogo,
  YoutubeLogo,
  TiktokLogo,
  FacebookLogo,
  TelegramLogo,
  ShareNetwork,
  UsersThree,
} from '@phosphor-icons/react';
import { GeoMap } from '../../core/components/GeoMap/GeoMap';
import { TaskPanel } from './components/TaskPanel';
import { TrendArea, Sparkline, DonutMetric, HBarCompare, fmtEUR } from '../../core/charts';
import type { DashboardSummaryDTO, MeetingDTO, TaskDTO, SocialSummaryDTO } from '../../core/types';
import { dashboardApi, meetingsApi, tasksApi, socialApi } from '../../core/api/resources';
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

// ISO-2 ülke kodu → bayrak emojisi (XX/bilinmeyen → küre).
const flagOf = (code: string): string =>
  /^[A-Z]{2}$/.test(code) && code !== 'XX'
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : '🌐';

// Platform kimlik renkleri — markaların kendi tonları (Design System: veri
// renkleri serbest; mor yalnız PREI accent'ı olarak kalır).
const PLATFORM_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  instagram: { label: 'Instagram', color: '#E1306C', icon: <InstagramLogo size={15} weight="fill" /> },
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', icon: <LinkedinLogo size={15} weight="fill" /> },
  x:         { label: 'X',         color: '#8B98A5', icon: <XLogo size={15} /> },
  youtube:   { label: 'YouTube',   color: '#E53935', icon: <YoutubeLogo size={15} weight="fill" /> },
  tiktok:    { label: 'TikTok',    color: '#4CC3C9', icon: <TiktokLogo size={15} weight="fill" /> },
  facebook:  { label: 'Facebook',  color: '#1877F2', icon: <FacebookLogo size={15} weight="fill" /> },
  telegram:  { label: 'Telegram',  color: '#229ED9', icon: <TelegramLogo size={15} weight="fill" /> },
};

const fmtCompact = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const { data: summary } = useFetch<DashboardSummaryDTO>(() => dashboardApi.summary(), []);
  const { data: meetingsData } = useFetch<MeetingDTO[]>(() => meetingsApi.list(), []);
  const { data: tasksData, refetch: refetchTasks } = useFetch<TaskDTO[]>(() => tasksApi.list(), []);
  const { data: social } = useFetch<SocialSummaryDTO>(() => socialApi.summary(), []);

  const trends = summary?.trends;
  const marketing = summary?.marketing;
  const kpis = useMemo(() => [
    { id: 'pipeline', label: t('dashboard.kpi.pipelineValue'), value: summary ? fmtEUR(summary.pipelineValueEur) : '—', delta: weeklyDelta(trends?.pipelineEur), spark: trends?.pipelineEur ?? [] },
    { id: 'leads', label: t('dashboard.kpi.activeLeads'), value: summary ? String(summary.activeLeads) : '—', delta: weeklyDelta(trends?.activeLeads), spark: trends?.activeLeads ?? [] },
    { id: 'meetings', label: t('dashboard.kpi.meetingsWeek'), value: summary ? String(summary.meetingsThisWeek) : '—', delta: weeklyDelta(trends?.meetings), spark: trends?.meetings ?? [] },
    { id: 'closed', label: t('dashboard.kpi.closedWon'), value: summary ? fmtEUR(summary.closedWonEur) : '—', delta: weeklyDelta(trends?.closedWonEur), spark: trends?.closedWonEur ?? [] },
    { id: 'adspend', label: t('dashboard.kpi.adSpend30d'), value: marketing ? (marketing.hasSpendData ? fmtEUR(marketing.adSpend30dEur) : '—') : '—', delta: null, spark: [] as number[] },
  ], [summary, trends, marketing, t]);

  const geography = useMemo(() => summary?.geography ?? [], [summary]);
  const geoTotalContacts = useMemo(() => geography.reduce((s, g) => s + g.contacts, 0), [geography]);

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

      {/* Coğrafya satırı: dünya haritası (gerçek müşteri/aday dağılımı) + sağda portföy & kanallar */}
      <div className={styles.geoGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>
              <GlobeHemisphereWest size={16} className={styles.titleIcon} /> {t('dashboard.geo.title')}
            </h2>
            <span className={styles.cardMeta}>
              {geography.filter((g) => g.code !== 'XX').length} {t('dashboard.geo.countries')} · {geoTotalContacts} {t('dashboard.geo.clients')}
            </span>
          </div>
          {geography.length > 0 ? (
            <>
              <GeoMap items={geography} />
              <div className={styles.countryList}>
                {geography.map((g) => (
                  <div key={g.code} className={styles.countryRow}>
                    <span className={styles.countryFlag}>{flagOf(g.code)}</span>
                    <span className={styles.countryName}>{g.name}</span>
                    <span className={styles.countryStat}>{g.contacts} {t('dashboard.geo.client')}</span>
                    <span className={styles.countryStat}>{g.activeLeads} {t('dashboard.geo.lead')}</span>
                    <span className={styles.countryValue}>{g.pipelineEur > 0 ? fmtEUR(g.pipelineEur) : '—'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.fillCenter}>
              <EmptyState
                icon={<GlobeHemisphereWest size={24} weight="duotone" />}
                title={t('dashboard.geo.emptyTitle')}
                description={t('dashboard.geo.emptyDesc')}
              />
            </div>
          )}
        </Card>

        <div className={styles.rightStack}>
          <Card padding="md">
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>{t('dashboard.portfolioByMarket')}</h2>
            </div>
            {marketSplit.length > 0 ? (
              <div className={styles.chartFill}>
                <DonutMetric
                  data={marketSplit}
                  centerValue={fmtEUR(marketTotal)}
                  centerLabel={t('common.total')}
                  formatValue={fmtEUR}
                  height={170}
                />
              </div>
            ) : (
              <div className={styles.fillCenter}>
                <EmptyState
                  icon={<ChartPieSlice size={24} weight="duotone" />}
                  title={t('dashboard.empty.portfolioTitle')}
                  description={t('dashboard.empty.portfolioDesc')}
                />
              </div>
            )}
          </Card>

          <Card padding="md">
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>
                <ChartBar size={16} className={styles.titleIcon} /> {t('dashboard.leadSources')}
              </h2>
              <span className={styles.cardMeta}>{t('dashboard.days30')}</span>
            </div>
            {leadSources.length > 0 ? (
              <div className={styles.chartFill}>
                <HBarCompare data={leadSources} />
              </div>
            ) : (
              <div className={styles.fillCenter}>
                <EmptyState
                  icon={<ChartBar size={24} weight="duotone" />}
                  title={t('dashboard.empty.leadSourcesTitle')}
                  description={t('dashboard.empty.leadSourcesDesc')}
                  actionLabel={t('dashboard.empty.addLead')}
                  onAction={() => navigate('/leads')}
                />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Ana grid: pipeline trendi + marketing özeti (entegrasyon) */}
      <div className={styles.mainGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('dashboard.pipelineMomentum')}</h2>
            <span className={styles.cardMeta}>{t('dashboard.last12Weeks')}</span>
          </div>
          {pipelineTrend.length > 0 ? (
            <div className={styles.chartFill}>
              <TrendArea data={pipelineTrend} formatValue={fmtEUR} name="Pipeline" height={240} />
            </div>
          ) : (
            <div className={styles.fillCenter}>
              <EmptyState
                icon={<TrendUp size={24} weight="duotone" />}
                title={t('dashboard.empty.pipelineTitle')}
                description={t('dashboard.empty.pipelineDesc')}
                actionLabel={t('dashboard.empty.addLead')}
                onAction={() => navigate('/leads')}
              />
            </div>
          )}
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>
              <Megaphone size={16} className={styles.titleIcon} /> {t('dashboard.mkt.title')}
            </h2>
            <span className={styles.cardMeta}>{t('dashboard.days30')}</span>
          </div>
          {marketing?.hasSpendData ? (
            <div className={styles.mktBody}>
              <div className={styles.mktStatRow}>
                <div className={styles.mktStat}>
                  <span className={styles.mktStatLabel}>{t('dashboard.mkt.spend')}</span>
                  <span className={styles.mktStatValue}>{fmtEUR(marketing.adSpend30dEur)}</span>
                </div>
                <div className={styles.mktStat}>
                  <span className={styles.mktStatLabel}>{t('dashboard.mkt.cpl')}</span>
                  <span className={styles.mktStatValue}>{marketing.avgCpl30dEur != null ? fmtEUR(marketing.avgCpl30dEur) : '—'}</span>
                </div>
                <div className={styles.mktStat}>
                  <span className={styles.mktStatLabel}>{t('dashboard.mkt.leads')}</span>
                  <span className={styles.mktStatValue}>{marketing.leads30d}</span>
                </div>
              </div>
              {marketing.spendByMarket.length > 0 && (
                <div className={styles.mktMarkets}>
                  {marketing.spendByMarket.map((m) => (
                    <div key={m.code} className={styles.countryRow}>
                      <span className={styles.countryFlag}>{flagOf(m.code)}</span>
                      <span className={styles.countryName}>{m.name}</span>
                      <span className={styles.countryValue}>{fmtEUR(m.valueEur)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button className={styles.mktLink} onClick={() => navigate('/marketing')}>
                {t('dashboard.mkt.open')}
              </button>
            </div>
          ) : (
            <div className={styles.fillCenter}>
              <EmptyState
                icon={<Megaphone size={24} weight="duotone" />}
                title={t('dashboard.mkt.emptyTitle')}
                description={t('dashboard.mkt.emptyDesc')}
                actionLabel={t('dashboard.mkt.open')}
                onAction={() => navigate('/marketing')}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Alt grid: sosyal medya + takvim + görevler */}
      <div className={styles.bottomGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>
              <ShareNetwork size={16} className={styles.titleIcon} /> {t('dashboard.social.title')}
            </h2>
            {social?.hasData && social.totalFollowers > 0 && (
              <span className={styles.socialTotal}>
                <UsersThree size={14} /> {fmtCompact(social.totalFollowers)}
                {social.totalDeltaPct != null && (
                  <span className={social.totalDeltaPct >= 0 ? styles.deltaUp : styles.deltaDown} style={{ padding: '1px 5px', fontSize: '0.6875rem' }}>
                    {social.totalDeltaPct >= 0 ? '+' : ''}{social.totalDeltaPct}%
                  </span>
                )}
              </span>
            )}
          </div>
          {social?.hasData ? (
            <div className={styles.socialBody}>
              {social.platforms.map((p) => {
                const meta = PLATFORM_META[p.platform] ?? { label: p.platform, color: 'var(--text-muted)', icon: <ShareNetwork size={15} /> };
                return (
                  <div key={p.platform} className={styles.socialRow}>
                    <span className={styles.socialIcon} style={{ color: meta.color }}>{meta.icon}</span>
                    <span className={styles.socialName}>{meta.label}</span>
                    <span className={styles.socialFollowers}>{fmtCompact(p.followers)}</span>
                    {p.deltaPct != null ? (
                      <span className={`${styles.socialDelta} ${p.deltaPct >= 0 ? styles.deltaUp : styles.deltaDown}`}>
                        {p.deltaPct >= 0 ? '+' : ''}{p.deltaPct}%
                      </span>
                    ) : (
                      <span className={styles.socialDeltaNone}>—</span>
                    )}
                  </div>
                );
              })}
              {social.topPosts.length > 0 && (
                <>
                  <div className={styles.socialSubhead}>{t('dashboard.social.topPosts')}</div>
                  {social.topPosts.slice(0, 3).map((p) => {
                    const meta = PLATFORM_META[p.platform];
                    return (
                      <div key={p.id} className={styles.socialPostRow} title={p.title}>
                        <span className={styles.socialIcon} style={{ color: meta?.color }}>{meta?.icon}</span>
                        <span className={styles.socialPostTitle}>{p.title}</span>
                        <span className={styles.socialPostStat}>{fmtCompact(p.engagements)} ♥</span>
                        {p.leads > 0 && (
                          <span className={styles.socialLeadBadge}>{p.leads} {t('dashboard.social.lead')}</span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              <button className={styles.mktLink} onClick={() => navigate('/marketing')}>
                {t('dashboard.social.manage')}
              </button>
            </div>
          ) : (
            <div className={styles.fillCenter}>
              <EmptyState
                compact
                icon={<ShareNetwork size={22} weight="duotone" />}
                title={t('dashboard.social.emptyTitle')}
                description={t('dashboard.social.emptyDesc')}
                actionLabel={t('dashboard.social.manage')}
                onAction={() => navigate('/marketing')}
              />
            </div>
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
          <CardBody padding="none" className={styles.fillBody}>
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
            <div className={`${styles.listWidget} ${schedule.length === 0 ? styles.fillCenter : ''}`}>
              {schedule.length === 0 && (
                <EmptyState
                  compact
                  icon={<CalendarBlank size={22} weight="duotone" />}
                  title={t('dashboard.noMeetings')}
                  actionLabel={t('dashboard.empty.scheduleMeeting')}
                  onAction={() => navigate('/meetings')}
                />
              )}
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
          <CardBody padding="none" className={styles.fillBody}>
            <TaskPanel
              tasks={tasksData ?? []}
              onChanged={refetchTasks}
              onSeeAll={() => navigate('/tasks')}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
