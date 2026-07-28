// Dubai bölge getiri tablosu → bölge başına BİR parça.
// Satır bazlı bölmek bilinçli: "JVC kira getirisi ne?" sorusunda tüm
// tablo yerine yalnız o bölgenin satırı dönsün.
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/onurr/OneDrive/Masaüstü/Araştırma Kaynakları/DUBAİ DLD.xlsx';
const OUT = path.join(import.meta.dirname, 'chunks-dld.json');

/** Excel yüzde hücreleri sayı olarak geliyor (0.07) — insan okunur hâle çevir. */
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return `%${(v * 100).toFixed(1).replace(/\.0$/, '')}`;
  return String(v).trim();
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);
const ws = wb.worksheets[0];

const header = ws.getRow(1).values.slice(1).map((h) => String(h).trim());
const out = [];

ws.eachRow((row, i) => {
  if (i === 1) return;
  const cells = row.values.slice(1);
  const bolge = fmt(cells[0]);
  if (!bolge || bolge === '—') return;
  const lines = header.slice(1).map((h, k) => `${h}: ${fmt(cells[k + 1])}`);
  out.push({
    content: `Dubai — ${bolge} (yatırım getirisi özeti)\n${lines.join('\n')}`,
    metadata: {
      source: 'Dubai Land Department (DLD) verisiyle hazırlanan ProDuality bölge tablosu',
      source_type: 'external_report',
      title: 'Dubai Bölge Bazlı Getiri Tablosu',
      last_verified: '2025-05-01',   // dosya tarihi; 1 yıldan eski → ⚠ uyarısı çıkar
      country: 'AE',
      city: 'Dubai',
      region: bolge,
      category: 'market_intel',
      filename: 'DUBAİ DLD.xlsx',
      language: 'tr',
    },
  });
});

fs.writeFileSync(OUT, JSON.stringify(out));
console.error(`${out.length} bölge parçası → ${OUT}`);
console.error(out[0].content);
