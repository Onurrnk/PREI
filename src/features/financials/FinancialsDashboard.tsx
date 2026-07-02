import React, { useState } from 'react';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { FunnelSimple, DownloadSimple, TrendUp, TrendDown } from '@phosphor-icons/react';
import { TrendArea, DonutMetric, HBarCompare, fmtCompact } from '../../core/charts';
import { Select } from '../../core/components/Form/Form';
import styles from './Financials.module.css';

const fmtUSD = (v: number): string => `$${fmtCompact(v)}`;

// ---------------------------------------------------------------------
// Mock veri — Faz 1'de gerçek API'ye bağlanacak (para birimi B-7'de EUR
// bazına normalize edilecek). Sayılar temsilidir.
// ---------------------------------------------------------------------

const kpis = [
  { id: 'revenue', label: 'Total Revenue', value: '$24.5M', delta: 12.5 },
  { id: 'sales', label: 'Total Sales (Units)', value: '18', delta: 8.3 },
  { id: 'conversion', label: 'Conversion Rate', value: '8.9%', delta: 1.2 },
  { id: 'dealSize', label: 'Avg. Deal Size', value: '$1.36M', delta: -2.1 },
  { id: 'commission', label: 'Commission Earned', value: '$735K', delta: 15.2 },
];

const salesByRegion = [
  { name: 'Downtown Dubai', value: 8_500_000 },
  { name: 'Dubai Marina', value: 6_200_000 },
  { name: 'Palm Jumeirah', value: 5_800_000 },
  { name: 'Business Bay', value: 4_000_000 },
];

const salesByProject = [
  { name: 'Burj Khalifa Res.', value: 2_500_000 },
  { name: 'Palm Beach Towers', value: 1_800_000 },
  { name: 'Marina Vista', value: 1_200_000 },
  { name: 'Safa Two', value: 900_000 },
  { name: 'Other', value: 600_000 },
];

const propertyTypeSplit = [
  { name: 'Off-plan', value: 6_500_000 },
  { name: 'Resale', value: 3_500_000 },
];

const purposeSplit = [
  { name: 'Investment', value: 4_000_000 },
  { name: 'Golden Visa', value: 2_500_000 },
  { name: 'Holiday Home', value: 1_500_000 },
  { name: 'CBI', value: 1_000_000 },
  { name: 'Lifestyle', value: 1_000_000 },
];

const monthlyRevenue = [
  { label: 'Jan', value: 1_200_000 },
  { label: 'Feb', value: 1_900_000 },
  { label: 'Mar', value: 1_500_000 },
  { label: 'Apr', value: 2_200_000 },
  { label: 'May', value: 2_800_000 },
  { label: 'Jun', value: 2_450_000 },
];

const targets = [
  { id: 'leads', title: 'Monthly Leads', actual: 45, target: 50, fmt: (v: number) => `${v}` },
  { id: 'units', title: 'Monthly Sales (Units)', actual: 4, target: 5, fmt: (v: number) => `${v}` },
  { id: 'monthlyRev', title: 'Monthly Revenue', actual: 6_500_000, target: 10_000_000, fmt: fmtUSD },
  { id: 'yearlyRev', title: 'Yearly Revenue', actual: 24_500_000, target: 50_000_000, fmt: fmtUSD },
];

export const FinancialsDashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState('YTD');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Financial Performance</h1>
          <p className={styles.subtitle}>Track revenue, sales velocity, and regional distribution</p>
        </div>
        <div className={styles.headerActions}>
          <Select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className={styles.timeframeSelect}
          >
            <option value="Q1">Q1 2026</option>
            <option value="Q2">Q2 2026</option>
            <option value="YTD">Year to Date</option>
            <option value="1Y">Last 12 Months</option>
          </Select>
          <Button variant="outline"><FunnelSimple size={16} /> Filters</Button>
          <Button variant="outline"><DownloadSimple size={16} /> Export Report</Button>
        </div>
      </div>

      {/* KPI şeridi (Design System §5.1) */}
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <Card key={kpi.id} padding="md">
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <span className={styles.kpiValue}>{kpi.value}</span>
              <div className={styles.kpiFooter}>
                <span className={`${styles.kpiDelta} ${kpi.delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
                  {kpi.delta >= 0 ? <TrendUp size={13} /> : <TrendDown size={13} />}
                  {Math.abs(kpi.delta).toFixed(1)}%
                </span>
                <span className={styles.kpiMeta}>vs last period</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Hedefler — ince çizgi göstergesi; kalın dolgu track yasak (§6.2) */}
      <div className={styles.targetsGrid}>
        {targets.map((t) => {
          const pct = Math.min((t.actual / t.target) * 100, 100);
          return (
            <Card key={t.id} padding="md">
              <div className={styles.targetCard}>
                <div className={styles.targetHeader}>
                  <span className={styles.targetTitle}>{t.title}</span>
                  <span className={styles.targetNumbers}>
                    {t.fmt(t.actual)} / {t.fmt(t.target)}
                  </span>
                </div>
                <div className={styles.targetTrack}>
                  <div className={styles.targetFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.targetPct}>{Math.round(pct)}% achieved</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Gelir trendi — imza grafik */}
      <Card padding="md">
        <div className={styles.cardTitleRow}>
          <h2 className={styles.cardTitle}>Monthly Revenue Trend</h2>
          <span className={styles.cardMeta}>{timeframe}</span>
        </div>
        <TrendArea data={monthlyRevenue} formatValue={fmtUSD} name="Revenue" height={280} />
      </Card>

      {/* Dağılımlar — donut + yatay bar karışımı (tek tip tekrar yok) */}
      <div className={styles.chartsGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Sales by Region</h2>
          </div>
          <DonutMetric
            data={salesByRegion}
            centerValue="$24.5M"
            centerLabel="Total"
            formatValue={fmtUSD}
            height={180}
          />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Sales by Project</h2>
          </div>
          <HBarCompare data={salesByProject} formatValue={fmtUSD} labelWidth={128} />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Off-plan vs Resale</h2>
          </div>
          <DonutMetric
            data={propertyTypeSplit}
            centerValue="$10M"
            centerLabel="YTD"
            formatValue={fmtUSD}
            height={180}
          />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Sales by Purpose</h2>
          </div>
          <HBarCompare data={purposeSplit} formatValue={fmtUSD} labelWidth={128} />
        </Card>
      </div>
    </div>
  );
};
