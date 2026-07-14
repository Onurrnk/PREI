import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  { id: 'revenue', labelKey: 'financials.kpi.totalRevenue', value: '$24.5M', delta: 12.5 },
  { id: 'sales', labelKey: 'financials.kpi.totalSales', value: '18', delta: 8.3 },
  { id: 'conversion', labelKey: 'financials.kpi.conversionRate', value: '8.9%', delta: 1.2 },
  { id: 'dealSize', labelKey: 'financials.kpi.avgDealSize', value: '$1.36M', delta: -2.1 },
  { id: 'commission', labelKey: 'financials.kpi.commissionEarned', value: '$735K', delta: 15.2 },
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

const targets = [
  { id: 'leads', titleKey: 'financials.targets.monthlyLeads', actual: 45, target: 50, fmt: (v: number) => `${v}` },
  { id: 'units', titleKey: 'financials.targets.monthlySales', actual: 4, target: 5, fmt: (v: number) => `${v}` },
  { id: 'monthlyRev', titleKey: 'financials.targets.monthlyRevenue', actual: 6_500_000, target: 10_000_000, fmt: fmtUSD },
  { id: 'yearlyRev', titleKey: 'financials.targets.yearlyRevenue', actual: 24_500_000, target: 50_000_000, fmt: fmtUSD },
];

export const FinancialsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [timeframe, setTimeframe] = useState('YTD');

  const monthlyRevenue = [
    { label: t('financials.months.jan'), value: 1_200_000 },
    { label: t('financials.months.feb'), value: 1_900_000 },
    { label: t('financials.months.mar'), value: 1_500_000 },
    { label: t('financials.months.apr'), value: 2_200_000 },
    { label: t('financials.months.may'), value: 2_800_000 },
    { label: t('financials.months.jun'), value: 2_450_000 },
  ];

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
              onChange={setTimeframe}
              options={[
                { value: 'Q1', label: t('financials.timeframe.q1') },
                { value: 'Q2', label: t('financials.timeframe.q2') },
                { value: 'YTD', label: t('financials.timeframe.ytd') },
                { value: '1Y', label: t('financials.timeframe.last12') },
              ]}
            />
          </div>
          <Button variant="outline"><FunnelSimple size={16} /> {t('financials.filters')}</Button>
          <Button variant="outline"><DownloadSimple size={16} /> {t('financials.exportReport')}</Button>
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
                <span className={`${styles.kpiDelta} ${kpi.delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
                  {kpi.delta >= 0 ? <TrendUp size={13} /> : <TrendDown size={13} />}
                  {Math.abs(kpi.delta).toFixed(1)}%
                </span>
                <span className={styles.kpiMeta}>{t('financials.vsLastPeriod')}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Hedefler — ince çizgi göstergesi; kalın dolgu track yasak (§6.2) */}
      <div className={styles.targetsGrid}>
        {targets.map((tg) => {
          const pct = Math.min((tg.actual / tg.target) * 100, 100);
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
        <TrendArea data={monthlyRevenue} formatValue={fmtUSD} name={t('financials.revenue')} height={280} />
      </Card>

      {/* Dağılımlar — donut + yatay bar karışımı (tek tip tekrar yok) */}
      <div className={styles.chartsGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('financials.salesByMarket')}</h2>
          </div>
          <DonutMetric
            data={salesByMarket}
            centerValue="$24.5M"
            centerLabel={t('financials.total')}
            formatValue={fmtUSD}
            height={180}
          />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('financials.salesByProject')}</h2>
          </div>
          <HBarCompare data={salesByProject} formatValue={fmtUSD} labelWidth={128} />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('financials.offPlanVsResale')}</h2>
          </div>
          <DonutMetric
            data={propertyTypeSplit}
            centerValue="$10M"
            centerLabel={t('financials.ytd')}
            formatValue={fmtUSD}
            height={180}
          />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('financials.salesByPurpose')}</h2>
          </div>
          <HBarCompare data={purposeSplit} formatValue={fmtUSD} labelWidth={128} />
        </Card>
      </div>
    </div>
  );
};
