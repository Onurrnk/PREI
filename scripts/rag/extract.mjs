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

/** ~1200 karakterlik, cümle sınırında kesilen parçalar; 150 karakter örtüşme. */
function chunkText(text, size = 1200, overlap = 150) {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const out = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + size, clean.length);
    if (end < clean.length) {
      // Cümle sonunda kes — yarım cümle gömmek anlamı bozar.
      const win = clean.slice(i, end);
      const cut = Math.max(win.lastIndexOf('. '), win.lastIndexOf('\n'), win.lastIndexOf('! '), win.lastIndexOf('? '));
      if (cut > size * 0.5) end = i + cut + 1;
    }
    const piece = clean.slice(i, end).trim();
    if (piece.length > 80) out.push(piece);   // çok kısa artıkları at
    // Sona ulaştıysak DUR: aksi hâlde i = len - overlap'te takılıp
    // son parçayı sonsuza dek yeniden üretiyordu.
    if (end >= clean.length) break;
    const next = end - overlap;
    i = next > i ? next : end;   // her turda ilerlemeyi garanti et
  }
  return out;
}

/**
 * Anlamsız parçaları eler. PDF'lerde grafik eksenleri ve tablo sütunları
 * düz metne "70.000 / 65.000 / 60.000…" diye düşüyor; bunlar aramada ilk
 * sıraları işgal edip Eylül'e bağlamsız rakam okutuyordu (ölçüldü).
 * Kural: metnin yarıdan fazlası harf olacak VE en az 15 gerçek kelime içerecek.
 */
function isProse(text) {
  const dense = text.replace(/\s/g, '');
  if (!dense) return false;
  const letters = (dense.match(/\p{L}/gu) ?? []).length;
  if (letters / dense.length < 0.55) return false;
  const words = text.match(/\p{L}{3,}/gu) ?? [];
  return words.length >= 15;
}

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
