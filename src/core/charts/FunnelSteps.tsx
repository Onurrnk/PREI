import React from 'react';
import { fmtCompact } from './theme';
import styles from './Charts.module.css';

export interface FunnelStep {
  label: string;
  value: number;
}

interface FunnelStepsProps {
  steps: FunnelStep[];
  color?: string;
}

/**
 * Dikey dönüşüm hunisi (Design System §6.2): her adım yatay bar,
 * adımlar arasında dönüşüm yüzdesi mono etiket. Reklam → kapanış zinciri.
 */
export const FunnelSteps: React.FC<FunnelStepsProps> = ({
  steps,
  color = 'var(--chart-1)',
}) => {
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className={styles.funnel}>
      {steps.map((step, i) => {
        const widthPct = Math.max((step.value / max) * 100, 2.5);
        const conversion =
          i > 0 && steps[i - 1].value > 0
            ? ((step.value / steps[i - 1].value) * 100).toFixed(1)
            : null;
        // Derinlik hissi: her adımda hafif soluklaşan tek renk (rampa karnavalı değil)
        const opacity = 1 - i * (0.55 / Math.max(steps.length - 1, 1));

        return (
          <React.Fragment key={step.label}>
            {conversion && (
              <div className={styles.funnelConversion}>{conversion}%</div>
            )}
            <div className={styles.funnelStep}>
              <span className={styles.funnelLabel}>{step.label}</span>
              <div className={styles.funnelTrackless}>
                <div
                  className={styles.funnelBar}
                  style={{ width: `${widthPct}%`, background: color, opacity }}
                />
              </div>
              <span className={styles.funnelValue}>{fmtCompact(step.value)}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
