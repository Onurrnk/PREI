// =====================================================================
// Araştırma raporlarını RAG'a hazırlar: PDF → sayfa metni → parça (chunk)
// → künyeli JSON. Gömme ve yazma SUNUCUDA yapılır (OpenAI anahtarı orada).
//
// Künye sözleşmesi provenance.ts ile aynı: source (yayıncı), title,
// last_verified (yayın tarihi), country, category, page.
// =====================================================================
import { extractText, getDocumentProxy } from 'unpdf';
import fs from 'node:fs';
import path from 'node:path';
import { chunkText, isProse } from './chunk.mjs';

const SRC = 'C:/Users/onurr/OneDrive/Masaüstü/Araştırma Kaynakları';
const OUT = path.join(import.meta.dirname, 'chunks.json');

// Birinci öncelik dosyaları + künyeleri. JLL earnings ve JPM redacted
// BİLEREK yok (konu dışı / bir yıl eski siyaset yorumu).
const FILES = [
  {
    file: '146631_the-wealth-report-2026---knight-frank.pdf',
    source: 'Knight Frank', title: 'The Wealth Report 2026',
    last_verified: '2026-01-01', country: 'GLOBAL', category: 'market_intel',
  },
  {
    file: 'the-wealth-report_2025.pdf',
    source: 'Knight Frank', title: 'The Wealth Report 2025',
    last_verified: '2025-01-01', country: 'GLOBAL', category: 'market_intel',
  },
  {
    file: 'World-Research-Prime-Residential-Index-World-Cities-2025.pdf',
    source: 'Knight Frank', title: 'Prime Residential Index — World Cities 2025',
    last_verified: '2025-01-01', country: 'GLOBAL', category: 'market_intel',
  },
  {
    file: 'IGD-2026-gayrimenkul-piyasasi-raporu.pdf',
    // Künye PDF'in kendi kolofonundan: "İGD © İstanbul Gayrimenkul
    // Değerleme ve Danışmanlık A.Ş. — Gayrimenkul Piyasası Raporu XVI"
    source: 'İGD — İstanbul Gayrimenkul Değerleme ve Danışmanlık',
    title: '2026 Gayrimenkul Piyasası Raporu (XVI)',
    last_verified: '2026-01-01', country: 'TR', category: 'market_intel',
  },
  {
    file: 'Impacts-2025-Downloadable-issue.pdf',
    source: 'Savills', title: 'Impacts 2025',
    last_verified: '2025-01-01', country: 'GLOBAL', category: 'market_intel',
  },
];

const all = [];
let dropped = 0;

for (const meta of FILES) {
  const full = path.join(SRC, meta.file);
  if (!fs.existsSync(full)) { console.error('YOK:', meta.file); continue; }
  const buf = new Uint8Array(fs.readFileSync(full));
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: false });
  let kept = 0;
  text.forEach((pageText, idx) => {
    for (const c of chunkText(pageText)) {
      if (!isProse(c)) { dropped++; continue; }
      all.push({
        content: c,
        metadata: {
          source: meta.source,
          source_type: 'external_report',
          title: meta.title,
          last_verified: meta.last_verified,
          country: meta.country,
          category: meta.category,
          page: idx + 1,
          filename: meta.file,
          language: /[çğıöşüÇĞİÖŞÜ]/.test(c) ? 'tr' : 'en',
        },
      });
      kept++;
    }
  });
  console.error(`${meta.title}: ${text.length} sayfa → ${kept} parça`);
}

fs.writeFileSync(OUT, JSON.stringify(all));
console.error(`ELENEN (grafik/tablo artığı): ${dropped}`);
console.error(`TOPLAM ${all.length} parça → ${OUT}`);
