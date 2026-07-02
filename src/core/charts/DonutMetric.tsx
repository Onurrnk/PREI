import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { CHART_SERIES, ANIMATION_MS } from './theme';
import styles from './Charts.module.css';

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

interface DonutMetricProps {
  data: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  height?: number;
  formatValue?: (v: number) => string;
}

/**
 * Merkez-metrikli donut (Design System §6.2): 12px halka, ortada toplam,
 * altında inline legend. Pasta grafiği yasak — bu bileşen tek istisnadır.
 */
export const DonutMetric: React.FC<DonutMetricProps> = ({
  data,
  centerValue,
  centerLabel,
  height = 200,
  formatValue,
}) => {
  const colorOf = (slice: DonutSlice, i: number): string =>
    slice.color ?? CHART_SERIES[i % CHART_SERIES.length];

  return (
    <div>
      <div className={styles.donutWrap} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="74%"
              outerRadius="90%"
              paddingAngle={2}
              strokeWidth={0}
              animationDuration={ANIMATION_MS}
            >
              {data.map((slice, i) => (
                <Cell key={slice.name} fill={colorOf(slice, i)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter}>
          <span className={styles.donutCenterValue}>{centerValue}</span>
          <span className={styles.donutCenterLabel}>{centerLabel}</span>
        </div>
      </div>
      <div className={styles.legend}>
        {data.map((slice, i) => (
          <div key={slice.name} className={styles.legendItem}>
            <span
              className={styles.legendChip}
              style={{ background: colorOf(slice, i) }}
            />
            <span>{slice.name}</span>
            <span className={styles.legendValue}>
              {formatValue ? formatValue(slice.value) : slice.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
