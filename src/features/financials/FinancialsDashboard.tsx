import React, { useState } from 'react';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { FunnelSimple, DownloadSimple, TrendUp, TrendDown } from '@phosphor-icons/react';
import { TrendArea, DonutMetric, HBarCompare, fmtCompact } from '../../core/charts';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
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

// Pazarlar (K-6): TR, UAE, ES, UK aktif; TH ve DE yolda
const salesByMarket = [
  { name: 'Dubai (UAE)', value: 9_800_000 },
  { name: 'Türkiye', value: 7_400_000 },
  { name: 'Spain', value: 4_300_000 },
  { name: 'United Kingdom', value: 3_000_000 },
];

const salesByProject = [
  { name: 'Palm Beach Towers · DXB', value: 2_500_000 },
  { name: 'Nişantaşı Koru · IST', value: 1_800_000 },
  { name: 'Marina Vista · DXB', value: 1_200_000 },
  { name: 'La Zagaleta Villas · MRB', value: 950_000 },
  { name: 'Nine Elms Residences · LDN', value: 700_000 },
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
          <div className={styles.timeframeSelect}>
            <SelectMenu
              aria-label="Timeframe"
              value={timeframe}
              onChange={setTimeframe}
              options={[
                { value: 'Q1', label: 'Q1 2026' },
                { value: 'Q2', label: 'Q2 2026' },
                { value: 'YTD', label: 'Year to Date' },
                { value: '1Y', label: 'Last 12 Months' },
              ]}
            />
          </div>
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
            <h2 className={styles.cardTitle}>Sales by Market</h2>
          </div>
          <DonutMetric
            data={salesByMarket}
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
