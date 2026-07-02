import React, { useId } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { AXIS_TICK, GRID_STROKE, ANIMATION_MS, MOTION_OK } from './theme';

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendAreaProps {
  data: TrendPoint[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  /** Tooltip'te görünen seri adı. */
  name?: string;
}

/**
 * İmza trend grafiği: gradyan dolgulu alan, yalnız yatay hairline ızgara,
 * mono eksen etiketleri (Design System §6.2).
 */
export const TrendArea: React.FC<TrendAreaProps> = ({
  data,
  height = 260,
  color = 'var(--chart-1)',
  formatValue,
  name = 'Value',
}) => {
  const gradientId = `trend-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={AXIS_TICK}
          dy={6}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={AXIS_TICK}
          width={52}
          tickFormatter={formatValue}
        />
        <Tooltip
          content={<ChartTooltip formatValue={formatValue} showName={false} />}
          cursor={{ stroke: 'var(--border-strong)' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={MOTION_OK}
          animationDuration={ANIMATION_MS}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
