import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 14, radius, style }) => (
  <div
    className={styles.block}
    style={{ width, height, borderRadius: radius, ...style }}
    aria-hidden="true"
  />
);

/** Tablo görünümlü yükleme iskeleti: kolon genişlikleri değişken, satırlar ritmik. */
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className={styles.tableWrap} role="status" aria-label="Loading">
    <div className={styles.tableRow}>
      <Skeleton width="18%" height={10} />
      <Skeleton width="14%" height={10} />
      <Skeleton width="10%" height={10} />
      <Skeleton width="12%" height={10} />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={styles.tableRow}>
        <Skeleton width="22%" height={14} />
        <Skeleton width="16%" height={14} />
        <Skeleton width="12%" height={14} />
        <Skeleton width="14%" height={14} />
        <Skeleton width="10%" height={14} />
      </div>
    ))}
  </div>
);
