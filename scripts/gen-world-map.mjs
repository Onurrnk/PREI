// =====================================================================
// PREI | Dünya haritası üretici (tek seferlik, build-time).
// world-atlas (Natural Earth 110m) + d3-geo ile TEK bir SVG path üretir ve
// pazar ülkelerinin işaret koordinatlarını önceden hesaplar. Çıktı:
// src/core/components/GeoMap/world-map-data.ts (commit edilir; runtime'da
// d3/topojson BAĞIMLILIĞI YOKTUR — saf SVG).
// Çalıştırma: node scripts/gen-world-map.mjs
// =====================================================================
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import * as topojson from 'topojson-client';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const world = require('world-atlas/countries-110m.json');

const W = 820, H = 420;
const projection = geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' });
const path = geoPath(projection);

const land = topojson.merge(world, world.objects.countries.geometries);
const landPath = path(land);

// Pazar + olası müşteri ülkeleri — [lon, lat] yaklaşık merkezler
const MARKERS = {
  TR: [35.0, 39.0],   // Türkiye
  AE: [54.5, 24.2],   // BAE (Dubai)
  ES: [-3.7, 40.2],   // İspanya
  GB: [-1.5, 52.8],   // Birleşik Krallık
  US: [-98.5, 39.5],  // ABD
  DE: [10.3, 51.2],   // Almanya
  FR: [2.5, 46.8],    // Fransa
  RU: [50.0, 56.0],   // Rusya (Avrupa kısmı)
  SA: [45.0, 24.0],   // Suudi Arabistan
  QA: [51.2, 25.3],   // Katar
  KW: [47.6, 29.3],   // Kuveyt
  IR: [53.0, 32.5],   // İran
  AZ: [47.5, 40.3],   // Azerbaycan
  NL: [5.3, 52.2],    // Hollanda
  XX: [15.0, 5.0],    // Bilinmeyen — Afrika açıkları (nötr nokta)
};

const markers = Object.fromEntries(
  Object.entries(MARKERS).map(([code, lonlat]) => {
    const [x, y] = projection(lonlat);
    return [code, [Math.round(x * 10) / 10, Math.round(y * 10) / 10]];
  }),
);

const out = `// =====================================================================
// ÜRETİLMİŞ DOSYA — elle düzenleme. Kaynak: scripts/gen-world-map.mjs
// (world-atlas 110m + d3-geo, naturalEarth1). Runtime bağımlılığı yok.
// =====================================================================
export const WORLD_VIEWBOX = '0 0 ${W} ${H}';

/** Ülke kodu → SVG [x, y] işaret koordinatı (naturalEarth1 projeksiyonu). */
export const COUNTRY_XY: Record<string, [number, number]> = ${JSON.stringify(markers, null, 2)};

/** Tüm kara kütlesi — tek path (Natural Earth 110m, sadeleştirilmiş). */
export const WORLD_LAND_PATH = ${JSON.stringify(landPath)};
`;

writeFileSync(new URL('../src/core/components/GeoMap/world-map-data.ts', import.meta.url), out);
console.log('yazildi: src/core/components/GeoMap/world-map-data.ts');
console.log('path uzunlugu:', landPath.length, 'karakter');
