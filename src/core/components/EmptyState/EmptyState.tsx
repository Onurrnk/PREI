// =====================================================================
// PREI | EmptyState — boş kartlar için tutarlı, davetkâr boş-durum.
// Duotone ikon + başlık + (ops.) açıklama + (ops.) CTA. Design System v1:
// nötr zemin, marka moru accent; "kırık/eksik" değil "henüz veri yok" hissi.
// =====================================================================
import React from 'react';
import { Button } from '../Button/Button';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Kart içinde daha kompakt (liste widget'ları için). */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon, title, description, actionLabel, onAction, compact,
}) => (
  <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
    <div className={styles.icon}>{icon}</div>
    <p className={styles.title}>{title}</p>
    {description && <p className={styles.description}>{description}</p>}
    {actionLabel && onAction && (
      <Button variant="outline" size="sm" onClick={onAction} className={styles.action}>
        {actionLabel}
      </Button>
    )}
  </div>
);
