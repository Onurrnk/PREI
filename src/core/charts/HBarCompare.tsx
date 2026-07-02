import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts';
import { ANIMATION_MS, MOTION_OK } from './theme';

export interface HBarItem {
  name: string;
  value: number;
}

interface HBarCompareProps {
  data: HBarItem[];
  color?: string;
  formatValue?: (v: number) => string;
  /** Kategori etiket kolonu genişliği (px). */
  labelWidth?: number;
}

/**
 * Yatay karşılaştırma barları (Design System §6.2): 12px bar, değer barın
 * ucunda mono; arka plan track YASAK.
 */
export const HBarCompare: React.FC<HBarCompareProps> = ({
  data,
  color = 'var(--chart-1)',
  formatValue,
  labelWidth = 96,
}) => {
  const height = data.length * 34 + 8;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          width={labelWidth}
          tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-sans)' }}
        />
        <Bar
          dataKey="value"
          fill={color}
          barSize={12}
          radius={[6, 6, 6, 6]}
          isAnimationActive={MOTION_OK}
          animationDuration={ANIMATION_MS}
        >
          <LabelList
            dataKey="value"
            position="right"
            formatter={
              formatValue
                ? (label: React.ReactNode) => formatValue(Number(label))
                : undefined
            }
            style={{
              fill: 'var(--text-secondary)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
