import React, { useId } from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

/**
 * KPI kartı mini trendi: eksensiz, tooltipsiz, 28px (Design System §5.1).
 * Animasyon kapalı — sparkline dekor değil, anlık okuma aracıdır.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = 'var(--chart-1)',
  height = 28,
}) => {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const points = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
