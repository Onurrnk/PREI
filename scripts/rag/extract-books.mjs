// =====================================================================
// İGD e-kitapları → RAG parçaları.
//
// Bunlar piyasa raporu DEĞİL, eğitim/metodoloji içeriği: category='education'
// ile ayrılır ki "Dubai kira getirisi" gibi veri sorgularında ilk sıraları
// işgal etmesinler. Yayın tarihi PDF'in kendi CreationDate'inden okunur —
// tahmin edilmez.
// =====================================================================
import { extractText, getDocumentProxy } from 'unpdf';
import fs from 'node:fs';
import path from 'node:path';
import { chunkText, isProse, pdfDate } from './chunk.mjs';

const SRC = 'C:/Users/onurr/OneDrive/Masaüstü/Araştırma Kaynakları';
const OUT = path.join(import.meta.dirname, 'chunks-books.json');

const BOOKS = [
  {
    file: 'ekitap-konut-degerleme-teknikleri-g97st4.pdf',
    title: 'Konut Değerleme Teknikleri',
    topic: 'degerleme',
  },
  {
    file: 'nereden-konut-almali-ceviz-kurdu-olmali-mi-olmamali-mi-ms2mkh.pdf',
    title: 'Nereden Konut Almalı? Ceviz Kurdu Olmalı mı, Olmamalı mı',
    topic: 'lokasyon_secimi',
  },
  {
    file: 'barinma-ihtiyacina-bakis-karincalar-ve-konutlar-ya2ojw.pdf',
    title: 'Barınma İhtiyacına Bakış — Karıncalar ve Konutlar',
    topic: 'barinma_talebi',
  },
  {
    file: 'bitcoin-ile-ev-alamaz-miyim-bir-kripto-para-gayrimenkul-hikayesi-bfceqk.pdf',
    title: 'Bitcoin ile Ev Alamaz mıyım? Bir Kripto Para–Gayrimenkul Hikâyesi',
    topic: 'kripto_gayrimenkul',
    // İçindeki örnekler 2017–2020 kripto dönemine ait; yayın tarihi taze olsa
    // bile rakamları güncel sanılmasın diye açık not düşüyoruz.
    freshness_note:
      'Anlatılan kripto para örnekleri 2017–2020 dönemine aittir; güncel fiyat için piyasa verisine bakın.',
  },
];

const all = [];
let dropped = 0;

for (const book of BOOKS) {
  const full = path.join(SRC, book.file);
  if (!fs.existsSync(full)) { console.error('YOK:', book.file); continue; }
  const doc = await getDocumentProxy(new Uint8Array(fs.readFileSync(full)));
  const meta = await doc.getMetadata().catch(() => null);
  const published = pdfDate(meta?.info?.CreationDate);
  if (!published) { console.error('TARİH OKUNAMADI, atlanıyor:', book.file); continue; }
  const { text } = await extractText(doc, { mergePages: false });

  let kept = 0;
  text.forEach((pageText, idx) => {
    for (const c of chunkText(pageText)) {
      if (!isProse(c)) { dropped++; continue; }
      all.push({
        content: c,
        metadata: {
          source: 'İGD — İstanbul Gayrimenkul Değerleme ve Danışmanlık (e-kitap)',
          source_type: 'ebook',
          title: book.title,
          last_verified: published,
          country: 'TR',
          category: 'education',
          topic: book.topic,
          page: idx + 1,
          filename: book.file,
          language: 'tr',
          ...(book.freshness_note ? { freshness_note: book.freshness_note } : {}),
        },
      });
      kept++;
    }
  });
  console.error(`${book.title} (${published}): ${text.length} sayfa → ${kept} parça`);
}

fs.writeFileSync(OUT, JSON.stringify(all));
console.error(`ELENEN: ${dropped}`);
console.error(`TOPLAM ${all.length} parça → ${OUT}`);
