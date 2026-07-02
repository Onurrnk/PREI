// =====================================================================
// PREI | Chart theme — tek doğruluk kaynağı (Design System §6)
// Feature kodunda çıplak recharts YASAK; grafikler bu katmandan geçer.
// =====================================================================

export const CHART_SERIES = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const;

export const AXIS_TICK = {
  fill: 'var(--text-muted)',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
} as const;

export const GRID_STROKE = 'var(--chart-grid)';
export const ANIMATION_MS = 600;

/** 1_240_000 → "1.2M", 45_300 → "45.3K" */
export const fmtCompact = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const m = v / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = v / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return `${v}`;
};

export const fmtEUR = (v: number): string => `€${fmtCompact(v)}`;
