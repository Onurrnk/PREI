import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { DownloadSimple, TrendUp, TrendDown } from '@phosphor-icons/react';
import { TrendArea, DonutMetric, HBarCompare, fmtEUR } from '../../core/charts';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { useFetch } from '../../core/hooks/useFetch';
import { financialsApi } from '../../core/api/resources';
import type { FinancialsSummaryDTO, FinancialsTimeframe } from '../../core/types';
import styles from './Financials.module.css';

export const FinancialsDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [timeframe, setTimeframe] = useState<FinancialsTimeframe>('YTD');
  const { data } = useFetch<FinancialsSummaryDTO>(() => financialsApi.summary(timeframe), [timeframe]);

  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';

  const kpis = useMemo(() => {
    const k = data?.kpis;
    return [
      { id: 'revenue', labelKey: 'financials.kpi.totalRevenue', value: k ? fmtEUR(k.totalRevenueEur) : '—', delta: k?.totalRevenueDeltaPct ?? null },
      { id: 'sales', labelKey: 'financials.kpi.totalSales', value: k ? String(k.totalSales) : '—', delta: k?.totalSalesDeltaPct ?? null },
      { id: 'conversion', labelKey: 'financials.kpi.conversionRate', value: k ? `${k.conversionRatePct.toFixed(1)}%` : '—', delta: k?.conversionRateDeltaPct ?? null },
      { id: 'dealSize', labelKey: 'financials.kpi.avgDealSize', value: k ? fmtEUR(k.avgDealSizeEur) : '—', delta: k?.avgDealSizeDeltaPct ?? null },
      { id: 'commission', labelKey: 'financials.kpi.commissionEarned', value: k ? fmtEUR(k.commissionEarnedEur) : '—', delta: k?.commissionEarnedDeltaPct ?? null },
    ];
  }, [data]);

  const targets = useMemo(() => {
    const tg = data?.targets;
    if (!tg) return [];
    return [
      { id: 'leads', titleKey: 'financials.targets.monthlyLeads', actual: tg.monthlyLeads.actual, target: tg.monthlyLeads.target, fmt: (v: number) => `${v}` },
      { id: 'units', titleKey: 'financials.targets.monthlySales', actual: tg.monthlySales.actual, target: tg.monthlySales.target, fmt: (v: number) => `${v}` },
      { id: 'monthlyRev', titleKey: 'financials.targets.monthlyRevenue', actual: tg.monthlyRevenueEur.actual, target: tg.monthlyRevenueEur.target, fmt: fmtEUR },
      { id: 'yearlyRev', titleKey: 'financials.targets.yearlyRevenue', actual: tg.yearlyRevenueEur.actual, target: tg.yearlyRevenueEur.target, fmt: fmtEUR },
    ];
  }, [data]);

  const monthlyRevenue = useMemo(
    () => (data?.monthlyRevenue ?? []).map((m) => {
      const d = new Date(`${m.month}-01T00:00:00Z`);
      const label = new Intl.DateTimeFormat(dateLocale, { month: 'short', timeZone: 'UTC' }).format(d);
      return { label, value: m.valueEur };
    }),
    [data, dateLocale],
  );

  const salesByMarket = useMemo(() => (data?.salesByMarket ?? []).map((m) => ({ name: m.name, value: m.valueEur })), [data]);
  const marketTotal = useMemo(() => salesByMarket.reduce((s, m) => s + m.value, 0), [salesByMarket]);
  const salesByProject = useMemo(() => (data?.salesByProject ?? []).map((p) => ({ name: p.name, value: p.valueEur })), [data]);
  const saleTypeSplit = useMemo(() => (data?.saleTypeSplit ?? []).map((s) => ({ name: s.name, value: s.valueEur })), [data]);
  const saleTypeTotal = useMemo(() => saleTypeSplit.reduce((s, m) => s + m.value, 0), [saleTypeSplit]);
  const purposeSplit = useMemo(() => (data?.purposeSplit ?? []).map((p) => ({ name: p.name, value: p.valueEur })), [data]);

  // CSV dışa aktarım — sayfada zaten yüklü olan veriden üretilir, ek uç
  // gerekmez. Hücre kaçışı: tırnak/virgül/satır sonu içeren alan çift
  // tırnağa alınır (RFC 4180).
  const csvCell = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRow = (cells: Array<string | number>): string => cells.map(csvCell).join(',');

  const handleExport = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push(csvRow([t('financials.title'), timeframe]));
    lines.push('');
    lines.push(csvRow(['KPI', 'Value', 'Delta %']));
    kpis.forEach((k) => lines.push(csvRow([t(k.labelKey), k.value, k.delta !== null ? k.delta.toFixed(1) : ''])));
    lines.push('');
    lines.push(csvRow([t('financials.revenueTrend')]));
    lines.push(csvRow(['Month', 'EUR']));
    monthlyRevenue.forEach((m) => lines.push(csvRow([m.label, m.value])));
    lines.push('');
    lines.push(csvRow([t('financials.salesByMarket')]));
    lines.push(csvRow(['Market', 'EUR']));
    salesByMarket.forEach((m) => lines.push(csvRow([m.name, m.value])));
    lines.push('');
    lines.push(csvRow([t('financials.salesByProject')]));
    lines.push(csvRow(['Project', 'EUR']));
    salesByProject.forEach((p) => lines.push(csvRow([p.name, p.value])));
    lines.push('');
    lines.push(csvRow([t('financials.offPlanVsResale')]));
    lines.push(csvRow(['Type', 'EUR']));
    saleTypeSplit.forEach((s) => lines.push(csvRow([s.name, s.value])));
    lines.push('');
    lines.push(csvRow([t('financials.salesByPurpose')]));
    lines.push(csvRow(['Purpose', 'EUR']));
    purposeSplit.forEach((p) => lines.push(csvRow([p.name, p.value])));

    const csv = '﻿' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prei-financials-${timeframe.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('financials.title')}</h1>
          <p className={styles.subtitle}>{t('financials.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.timeframeSelect}>
            <SelectMenu
              aria-label="Timeframe"
              value={timeframe}
              onChange={(v) => setTimeframe(v as FinancialsTimeframe)}
              options={[
                { value: 'Q1', label: t('financials.timeframe.q1') },
                { value: 'Q2', label: t('financials.timeframe.q2') },
                { value: 'YTD', label: t('financials.timeframe.ytd') },
                { value: '1Y', label: t('financials.timeframe.last12') },
              ]}
            />
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!data}>
            <DownloadSimple size={16} /> {t('financials.exportReport')}
          </Button>
        </div>
      </div>

      {/* KPI şeridi (Design System §5.1) */}
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <Card key={kpi.id} padding="md">
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(kpi.labelKey)}</span>
              <span className={styles.kpiValue}>{kpi.value}</span>
              <div className={styles.kpiFooter}>
                {kpi.delta !== null && (
                  <span className={`${styles.kpiDelta} ${kpi.delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
                    {kpi.delta >= 0 ? <TrendUp size={13} /> : <TrendDown size={13} />}
                    {Math.abs(kpi.delta).toFixed(1)}%
                  </span>
                )}
                <span className={styles.kpiMeta}>{t('financials.vsLastPeriod')}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Hedefler — ince çizgi göstergesi; kalın dolgu track yasak (§6.2) */}
      <div className={styles.targetsGrid}>
        {targets.map((tg) => {
          const pct = tg.target > 0 ? Math.min((tg.actual / tg.target) * 100, 100) : 0;
          return (
            <Card key={tg.id} padding="md">
              <div className={styles.targetCard}>
                <div className={styles.targetHeader}>
                  <span className={styles.targetTitle}>{t(tg.titleKey)}</span>
                  <span className={styles.targetNumbers}>
                    {tg.fmt(tg.actual)} / {tg.fmt(tg.target)}
                  </span>
                </div>
                <div className={styles.targetTrack}>
                  <div className={styles.targetFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.targetPct}>{t('financials.achieved', { pct: Math.round(pct) })}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Gelir trendi — imza grafik */}
      <Card padding="md">
        <div className={styles.cardTitleRow}>
          <h2 className={styles.cardTitle}>{t('financials.revenueTrend')}</h2>
          <span className={styles.cardMeta}>{timeframe}</span>
        </div>
        <TrendArea data={monthlyRevenue} formatValue={fmtEUR} name={t('financials.revenue')} height={280} />
      </Card>

      {/* Dağılımlar — donut + yatay bar karışımı (tek tip tekrar yok) */}
      <div className={styles.chartsGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('financials.salesByMarket')}</h2>
          </div>
          <DonutMetric
            data={salesByMarket}
            centerValue={fmtEUR(marketTotal)}
            centerLabel={t('financials.total')}
            formatValue={fmtEUR}
            height={180}
          />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('financials.salesByProject')}</h2>
          </div>
          <HBarCompare data={salesByProject} formatValue={fmtEUR} labelWidth={128} />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('financials.offPlanVsResale')}</h2>
          </div>
          <DonutMetric
            data={saleTypeSplit}
            centerValue={fmtEUR(saleTypeTotal)}
            centerLabel={t('financials.ytd')}
            formatValue={fmtEUR}
            height={180}
          />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('financials.salesByPurpose')}</h2>
          </div>
          <HBarCompare data={purposeSplit} formatValue={fmtEUR} labelWidth={128} />
        </Card>
      </div>
    </div>
  );
};
