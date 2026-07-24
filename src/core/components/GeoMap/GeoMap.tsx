// =====================================================================
// PREI | GeoMap — Müşteri Coğrafyası dünya haritası (Komuta Merkezi).
// Saf SVG: build-time üretilmiş kara kütlesi path'i (world-map-data.ts) +
// ülke işaretleri. Runtime harita bağımlılığı YOK (CSP-temiz, hızlı).
// Design System v1: nötr zemin, mor accent (#9B5BB3), mono rakamlar.
// =====================================================================
import React, { useMemo, useState } from 'react';
import { WORLD_VIEWBOX, WORLD_LAND_PATH, COUNTRY_XY } from './world-map-data';
import type { GeographyItemDTO } from '../../types';
import { fmtEUR } from '../../charts';
import styles from './GeoMap.module.css';

interface GeoMapProps {
  items: GeographyItemDTO[];
}

/** İşaret yarıçapı: kişi+aday toplamına göre 7–15px arası (log ölçek yumuşatma). */
function radiusOf(item: GeographyItemDTO, max: number): number {
  const w = item.contacts + item.activeLeads;
  if (max <= 0 || w <= 0) return 7;
  return 7 + 8 * Math.sqrt(w / max);
}

export const GeoMap: React.FC<GeoMapProps> = ({ items }) => {
  const [active, setActive] = useState<string | null>(null);

  const placed = useMemo(() => {
    const known = items.filter((i) => COUNTRY_XY[i.code]);
    const maxW = Math.max(...known.map((i) => i.contacts + i.activeLeads), 1);
    return known.map((i) => {
      const [x, y] = COUNTRY_XY[i.code];
      return { ...i, x, y, r: radiusOf(i, maxW) };
    });
  }, [items]);

  const activeItem = placed.find((p) => p.code === active) ?? null;

  return (
    <div className={styles.wrap}>
      <svg viewBox={WORLD_VIEWBOX} className={styles.svg} role="img" aria-label="Müşteri coğrafyası haritası">
        {/* Kara kütlesi — sakin, düşük kontrast */}
        <path d={WORLD_LAND_PATH} className={styles.land} />

        {/* Ülke işaretleri */}
        {placed.map((p) => (
          <g
            key={p.code}
            className={`${styles.marker} ${active === p.code ? styles.markerActive : ''}`}
            transform={`translate(${p.x}, ${p.y})`}
            onMouseEnter={() => setActive(p.code)}
            onMouseLeave={() => setActive(null)}
          >
            <circle r={p.r + 6} className={styles.halo} />
            <circle r={p.r} className={styles.dot} />
            <text y={4} className={styles.dotLabel}>{p.contacts + p.activeLeads}</text>
          </g>
        ))}
      </svg>

      {/* Hover bilgi çubuğu — sabit yükseklik, zıplama yok */}
      <div className={styles.infoBar}>
        {activeItem ? (
          <>
            <span className={styles.infoName}>{activeItem.name}</span>
            <span className={styles.infoStat}>{activeItem.contacts} müşteri</span>
            <span className={styles.infoStat}>{activeItem.activeLeads} aday</span>
            <span className={styles.infoValue}>{fmtEUR(activeItem.pipelineEur)}</span>
          </>
        ) : (
          <span className={styles.infoHint}>Detay için bir ülkenin üzerine gelin</span>
        )}
      </div>
    </div>
  );
};
