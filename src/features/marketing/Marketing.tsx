import React from 'react';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { TrendUp, TrendDown, ChatCircle, WhatsappLogo, InstagramLogo } from '@phosphor-icons/react';
import { FunnelSteps, ComboSpend, DonutMetric, Sparkline, fmtEUR } from '../../core/charts';
import styles from './Marketing.module.css';

// ---------------------------------------------------------------------
// Mock veri — Faz 5'te Meta Insights API + lead_attributions'a bağlanacak.
// Sayılar temsilidir; kaynaklar: ad_insights_daily × leads × deals.
// ---------------------------------------------------------------------

const kpis = [
  { id: 'spend', label: 'Ad Spend (30d)', value: '€9.4K', delta: 12.6, spark: [6.2, 6.8, 6.5, 7.1, 7.4, 7.2, 7.9, 8.3, 8.1, 8.8, 9.1, 9.4] },
  { id: 'cpl', label: 'Avg. CPL', value: '€98.40', delta: -8.2, spark: [128, 121, 124, 116, 112, 115, 108, 104, 107, 101, 99, 98.4], invert: true },
  { id: 'qualified', label: 'Conv. → Qualified', value: '22.2%', delta: 3.4, spark: [16, 17, 16.5, 18, 17.8, 19, 19.5, 20.2, 20.8, 21.4, 21.9, 22.2] },
  { id: 'roas', label: 'ROAS (komisyon)', value: '4.1x', delta: 6.8, spark: [2.9, 3.1, 3.0, 3.3, 3.4, 3.3, 3.6, 3.7, 3.8, 3.9, 4.0, 4.1] },
];

const funnel = [
  { label: 'Impressions', value: 412_400 },
  { label: 'CTWA Clicks', value: 3_840 },
  { label: 'Conversations', value: 962 },
  { label: 'Qualified (75+)', value: 214 },
  { label: 'Meetings', value: 58 },
  { label: 'Closed Won', value: 11 },
];

const weeklySpendCpl = [
  { label: 'W14', bar: 1_420, line: 128 },
  { label: 'W15', bar: 1_560, line: 121 },
  { label: 'W16', bar: 1_480, line: 124 },
  { label: 'W17', bar: 1_720, line: 116 },
  { label: 'W18', bar: 1_690, line: 112 },
  { label: 'W19', bar: 1_840, line: 115 },
  { label: 'W20', bar: 1_910, line: 108 },
  { label: 'W21', bar: 2_050, line: 104 },
  { label: 'W22', bar: 1_980, line: 107 },
  { label: 'W23', bar: 2_140, line: 101 },
  { label: 'W24', bar: 2_260, line: 99 },
  { label: 'W25', bar: 2_310, line: 98 },
];

const spendByMarket = [
  { name: 'Dubai (UAE)', value: 4_120 },
  { name: 'Türkiye', value: 2_680 },
  { name: 'Spain', value: 1_540 },
  { name: 'United Kingdom', value: 1_060 },
];

interface Campaign {
  id: string;
  name: string;
  market: string;
  status: 'Active' | 'Paused';
  spend: number;
  leads: number;
  qualified: number;
  cpl: number;
  closed: number;
  roas: number;
}

const campaigns: Campaign[] = [
  { id: 'c1', name: 'Golden Visa · Dubai Off-Plan (TR)', market: 'UAE', status: 'Active', spend: 2_840, leads: 24, qualified: 11, cpl: 118.3, closed: 2, roas: 5.6 },
  { id: 'c2', name: 'Downtown Rental Yield (EN)', market: 'UAE', status: 'Active', spend: 1_280, leads: 14, qualified: 5, cpl: 91.4, closed: 1, roas: 3.9 },
  { id: 'c3', name: 'İstanbul Yatırım Fırsatları (TR)', market: 'TR', status: 'Active', spend: 1_620, leads: 21, qualified: 7, cpl: 77.1, closed: 1, roas: 3.4 },
  { id: 'c4', name: 'Bodrum Premium Villas (TR)', market: 'TR', status: 'Paused', spend: 1_060, leads: 9, qualified: 3, cpl: 117.8, closed: 0, roas: 0 },
  { id: 'c5', name: 'Marbella Golden Visa (EN/ES)', market: 'ES', status: 'Active', spend: 1_540, leads: 12, qualified: 6, cpl: 128.3, closed: 1, roas: 4.2 },
  { id: 'c6', name: 'London Off-Plan Nine Elms (EN)', market: 'UK', status: 'Active', spend: 1_060, leads: 8, qualified: 4, cpl: 132.5, closed: 1, roas: 4.7 },
];

interface Conversation {
  id: string;
  name: string;
  market: string;
  channel: 'whatsapp' | 'instagram';
  snippet: string;
  score: number;
  time: string;
}

const conversations: Conversation[] = [
  { id: 'cv1', name: 'Khalid Al Mansoori', market: 'UAE', channel: 'whatsapp', snippet: 'Golden Visa için minimum yatırım tutarını teyit edebilir misiniz?', score: 85, time: '12m' },
  { id: 'cv2', name: 'Carmen Ortega', market: 'ES', channel: 'whatsapp', snippet: 'Is the Marbella villa still available for a viewing next week?', score: 78, time: '41m' },
  { id: 'cv3', name: 'Stefan Brandt', market: 'UAE', channel: 'instagram', snippet: 'Interested in rental yields for Downtown 2BR units.', score: 62, time: '2h' },
  { id: 'cv4', name: 'Ayşe Demirok', market: 'TR', channel: 'whatsapp', snippet: 'Kadıköy projesinde 3+1 için ödeme planı nasıl işliyor?', score: 55, time: '3h' },
  { id: 'cv5', name: 'Edward Langley', market: 'UK', channel: 'whatsapp', snippet: 'Could you send the Nine Elms payment schedule?', score: 71, time: '5h' },
];

const scoreClass = (score: number): string =>
  score >= 75 ? 'scoreHigh' : score >= 50 ? 'scoreMid' : 'scoreLow';

export const Marketing: React.FC = () => {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Marketing Intelligence</h1>
          <p className={styles.subtitle}>Ad spend, attribution and conversation analytics across all markets.</p>
        </div>
        <span className={styles.headerMeta}>Meta Ads · last 30 days</span>
      </div>

      {/* KPI şeridi */}
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => {
          const positive = 'invert' in kpi && kpi.invert ? kpi.delta < 0 : kpi.delta > 0;
          return (
            <Card key={kpi.id} padding="md">
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>{kpi.label}</span>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{kpi.value}</span>
                  <span className={`${styles.kpiDelta} ${positive ? styles.deltaUp : styles.deltaDown}`}>
                    {kpi.delta > 0 ? <TrendUp size={14} /> : <TrendDown size={14} />}
                    {Math.abs(kpi.delta).toFixed(1)}%
                  </span>
                </div>
                <div className={styles.kpiSpark}>
                  <Sparkline data={kpi.spark} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Funnel + Harcama/CPL */}
      <div className={styles.mainGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Acquisition Funnel</h2>
            <span className={styles.cardMeta}>ad → close</span>
          </div>
          <FunnelSteps steps={funnel} />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Spend vs CPL</h2>
            <span className={styles.cardMeta}>weekly</span>
          </div>
          <ComboSpend
            data={weeklySpendCpl}
            barName="Spend"
            lineName="CPL"
            formatBar={fmtEUR}
            formatLine={(v) => `€${v}`}
            height={264}
          />
        </Card>
      </div>

      {/* Kampanya tablosu */}
      <Card padding="none">
        <CardHeader>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Campaign Performance</h2>
            <span className={styles.cardMeta}>6 campaigns · 4 markets</span>
          </div>
        </CardHeader>
        <CardBody padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Campaign</TableHeader>
                <TableHeader>Market</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader align="right">Spend</TableHeader>
                <TableHeader align="right">Leads</TableHeader>
                <TableHeader align="right">Qualified</TableHeader>
                <TableHeader align="right">CPL</TableHeader>
                <TableHeader align="right">Closed</TableHeader>
                <TableHeader align="right">ROAS</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell style={{ fontWeight: 500 }}>{c.name}</TableCell>
                  <TableCell><span className={styles.marketChip}>{c.market}</span></TableCell>
                  <TableCell>
                    <span className={`${styles.statusChip} ${c.status === 'Active' ? styles.statusActive : ''}`}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{fmtEUR(c.spend)}</span></TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{c.leads}</span></TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{c.qualified}</span></TableCell>
                  <TableCell align="right"><span className={styles.numCell}>€{c.cpl.toFixed(1)}</span></TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{c.closed}</span></TableCell>
                  <TableCell align="right">
                    <span className={`${styles.numCell} ${c.roas >= 4 ? styles.roasStrong : ''}`}>
                      {c.roas > 0 ? `${c.roas.toFixed(1)}x` : '·'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Pazar dağılımı + Eylül konuşmaları */}
      <div className={styles.bottomGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Spend by Market</h2>
          </div>
          <DonutMetric
            data={spendByMarket}
            centerValue="€9.4K"
            centerLabel="30 days"
            formatValue={fmtEUR}
            height={176}
          />
        </Card>

        <Card padding="none" className={styles.convCard}>
          <CardHeader>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>
                <ChatCircle size={16} className={styles.titleIcon} /> Live Conversations
              </h2>
              <span className={styles.cardMeta}>Eylül · AI qualifier</span>
            </div>
          </CardHeader>
          <CardBody padding="none">
            <div className={styles.convList}>
              {conversations.map((cv) => (
                <div key={cv.id} className={styles.convItem}>
                  <span className={styles.convChannel}>
                    {cv.channel === 'whatsapp' ? <WhatsappLogo size={18} /> : <InstagramLogo size={18} />}
                  </span>
                  <div className={styles.convBody}>
                    <div className={styles.convTop}>
                      <span className={styles.convName}>{cv.name}</span>
                      <span className={styles.marketChip}>{cv.market}</span>
                      <span className={styles.convTime}>{cv.time}</span>
                    </div>
                    <p className={styles.convSnippet}>{cv.snippet}</p>
                  </div>
                  <span className={`${styles.scoreChip} ${styles[scoreClass(cv.score)]}`}>
                    {cv.score}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
