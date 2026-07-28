// Konteyner içinde çalışır: /tmp/all-chunks.json → gömme → /tmp/docs.sql
// OpenAI anahtarı ortam değişkeninden gelir; ekrana asla basılmaz.
import fs from 'node:fs';

const IN = '/tmp/all-chunks.json';
const OUT = '/tmp/docs.sql';
const MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY yok'); process.exit(1); }

const chunks = JSON.parse(fs.readFileSync(IN, 'utf8'));
const BATCH = 96;
const vectors = [];

for (let i = 0; i < chunks.length; i += BATCH) {
  const slice = chunks.slice(i, i + BATCH);
  let res, json;
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, input: slice.map((c) => c.content) }),
    });
    json = await res.json();
    if (res.ok && json.data) break;
    // Hata mesajını basarken anahtar sızmasın diye yalnız message alanı.
    console.error(`deneme ${attempt} başarısız: ${res.status} ${json?.error?.message ?? ''}`);
    if (attempt === 4) process.exit(1);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  json.data.sort((a, b) => a.index - b.index);
  for (const d of json.data) vectors.push(d.embedding);
  console.error(`${vectors.length}/${chunks.length}`);
}

if (vectors.length !== chunks.length) {
  console.error(`UYUŞMAZLIK: ${vectors.length} vektör / ${chunks.length} parça`);
  process.exit(1);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const files = [...new Set(chunks.map((c) => c.metadata.filename))];

const out = [];
out.push('BEGIN;');
// Yeniden çalıştırma güvenliği: aynı dosyanın eski parçalarını sil, sonra yaz.
for (const f of files) out.push(`DELETE FROM documents WHERE metadata->>'filename' = ${q(f)};`);
for (let i = 0; i < chunks.length; i++) {
  out.push(
    `INSERT INTO documents (content, embedding, metadata) VALUES (${q(chunks[i].content)}, ` +
    `'[${vectors[i].join(',')}]'::vector, ${q(JSON.stringify(chunks[i].metadata))}::jsonb);`,
  );
}
out.push('COMMIT;');
fs.writeFileSync(OUT, out.join('\n'));
console.error(`SQL yazıldı: ${OUT} (${chunks.length} kayıt, ${files.length} dosya)`);
