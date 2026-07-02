import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { AXIS_TICK, GRID_STROKE, ANIMATION_MS, MOTION_OK } from './theme';

export interface ComboPoint {
  label: string;
  bar: number;
  line: number;
}

interface ComboSpendProps {
  data: ComboPoint[];
  barName: string;
  lineName: string;
  height?: number;
  formatBar?: (v: number) => string;
  formatLine?: (v: number) => string;
}

/**
 * Harcama (bar) × birim maliyet (çizgi) combo grafiği (Design System §6.2).
 * İkincil eksen sağda, soluk. Marketing modülünün imza grafiği.
 */
export const ComboSpend: React.FC<ComboSpendProps> = ({
  data,
  barName,
  lineName,
  height = 260,
  formatBar,
  formatLine,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
      <CartesianGrid stroke={GRID_STROKE} vertical={false} />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={6} />
      <YAxis
        yAxisId="bar"
        axisLine={false}
        tickLine={false}
        tick={AXIS_TICK}
        width={48}
        tickFormatter={formatBar}
      />
      <YAxis
        yAxisId="line"
        orientation="right"
        axisLine={false}
        tickLine={false}
        tick={{ ...AXIS_TICK, fill: 'var(--text-muted)' }}
        width={44}
        tickFormatter={formatLine}
      />
      <Tooltip
        content={<ChartTooltip />}
        cursor={{ fill: 'var(--chart-grid)' }}
      />
      <Bar
        yAxisId="bar"
        dataKey="bar"
        name={barName}
        fill="var(--chart-1)"
        barSize={16}
        radius={[4, 4, 0, 0]}
        isAnimationActive={MOTION_OK}
        animationDuration={ANIMATION_MS}
      />
      <Line
        yAxisId="line"
        dataKey="line"
        name={lineName}
        stroke="var(--chart-2)"
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4, strokeWidth: 0 }}
        isAnimationActive={MOTION_OK}
        animationDuration={ANIMATION_MS}
      />
    </ComposedChart>
  </ResponsiveContainer>
);
