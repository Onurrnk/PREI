import React from 'react';
import styles from './Charts.module.css';

// Recharts'ın Tooltip content'ine geçtiği payload'un bize gereken kesiti.
interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
  payload?: { fill?: string };
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  formatValue?: (value: number) => string;
  /** Tek serili grafiklerde seri adı satırı gereksizdir; kapatmak için false. */
  showName?: boolean;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  label,
  payload,
  formatValue,
  showName = true,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className={styles.tooltip}>
      {label !== undefined && label !== '' && (
        <div className={styles.tooltipLabel}>{label}</div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className={styles.tooltipRow}>
          <span
            className={styles.tooltipChip}
            style={{
              background:
                entry.color ?? entry.fill ?? entry.payload?.fill ?? 'var(--chart-1)',
            }}
          />
          {showName && entry.name !== undefined && (
            <span className={styles.tooltipName}>{entry.name}</span>
          )}
          <span className={styles.tooltipValue}>
            {typeof entry.value === 'number' && formatValue
              ? formatValue(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};
