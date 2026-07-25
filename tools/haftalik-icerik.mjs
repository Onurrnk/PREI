#!/usr/bin/env node
// =====================================================================
// PREI | Haftalık İçerik Paketi — YEREL BETİK
//
// Bu betik SİZİN BİLGİSAYARINIZDA çalışır, çünkü sunucu diskinize
// yazamaz. Yaptığı iş:
//
//   1. Co-work çıktı klasöründe EN YENİ .docx raporu bulur
//   2. PREI'ye yükler (arşivlenir, bölümlere ayrılır, haber çıkarılır)
//   3. PREI'den post metinleri + karusel planları ister (Claude)
//   4. Karusel görsellerini ister (Nano Banana / Gemini)
//   4b. Haftalık yayın akışını kurar (4 LinkedIn postu + 2-3 karusel)
//   5. Hepsini masaüstünüzde TARİHLİ BİR KLASÖRE yazar
//
// Yapay zekâ işini sunucu yapar — hiçbir API anahtarı bu bilgisayara
// inmez. Betik yalnız agent anahtarını kullanır (PREI'ye erişim için).
//
// KULLANIM:
//   node haftalik-icerik.mjs
//   node haftalik-icerik.mjs --rapor "C:\yol\rapor.docx"   (belirli dosya)
//   node haftalik-icerik.mjs --hedef "D:\Raporlar"          (başka klasör)
//   node haftalik-icerik.mjs --gorselsiz                    (görsel atla)
//
// AYAR: aynı klasörde .env dosyası ya da ortam değişkeni:
//   PREI_API_BASE   (varsayılan https://api.produality.com)
//   PREI_AGENT_KEY  (zorunlu)
//   COWORK_OUTPUTS  (rapor klasörü; verilmezse otomatik aranır)
//   HEDEF_KLASOR    (varsayılan: Masaüstü/ProDuality Haftalik Icerik)
// =====================================================================

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

// ---------------------------------------------------------------------
// Ayarlar
// ---------------------------------------------------------------------
function loadEnvFile() {
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  for (const name of ['.env', 'prei.env']) {
    const p = path.join(here, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnvFile();

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? true) : undefined;
};

const API = (process.env.PREI_API_BASE ?? 'https://api.produality.com').replace(/\/$/, '');
const KEY = process.env.PREI_AGENT_KEY ?? '';
const SKIP_IMAGES = args.includes('--gorselsiz');
/**
 * Masaüstünü bul. Windows'ta iki tuzak var: OneDrive masaüstünü kendine
 * taşır ve Türkçe kurulumda adı "Masaüstü" olur. İkisini de dene.
 */
function findDesktop() {
  const home = os.homedir();
  const candidates = [
    process.env.ONEDRIVE && path.join(process.env.ONEDRIVE, 'Masaüstü'),
    process.env.ONEDRIVE && path.join(process.env.ONEDRIVE, 'Desktop'),
    process.env.OneDriveConsumer && path.join(process.env.OneDriveConsumer, 'Masaüstü'),
    path.join(home, 'OneDrive', 'Masaüstü'),
    path.join(home, 'OneDrive', 'Desktop'),
    path.join(home, 'Masaüstü'),
    path.join(home, 'Desktop'),
  ].filter(Boolean);
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return home;
}

const DESKTOP = findDesktop();
const TARGET_ROOT = flag('hedef')
  ?? process.env.HEDEF_KLASOR
  ?? path.join(DESKTOP, 'ProDuality Haftalik Icerik');

const log = (...a) => console.log(...a);
const warn = (...a) => console.log('  ⚠ ', ...a);

// ---------------------------------------------------------------------
// .docx → metin (bağımlılıksız: docx bir ZIP'tir, zlib yerleşik)
// ---------------------------------------------------------------------
function readZipEntry(buf, wantName) {
  // ZIP merkezi dizinini sondan tara (End of Central Directory imzası).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Geçersiz .docx (ZIP dizini bulunamadı)');

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');

    if (name === wantName) {
      // Yerel başlıktan gerçek veri başlangıcını hesapla.
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      return method === 0 ? raw : zlib.inflateRawSync(raw);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`.docx içinde ${wantName} yok`);
}

function docxToText(buf) {
  const xml = readZipEntry(buf, 'word/document.xml').toString('utf8');
  const decode = (s) => s
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');

  const paras = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const out = [];
  for (const p of paras) {
    const withBreaks = p.replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>/g, ' ');
    const texts = withBreaks.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
    const line = texts.map((t) => t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')).join('');
    const clean = decode(line).replace(/\s+/g, ' ').trim();
    if (clean) out.push(clean);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------
// Raporu bul
// ---------------------------------------------------------------------
function findLatestReport() {
  const explicit = flag('rapor');
  if (typeof explicit === 'string') {
    if (!fs.existsSync(explicit)) throw new Error(`Dosya yok: ${explicit}`);
    return explicit;
  }

  const roots = [];
  if (process.env.COWORK_OUTPUTS) roots.push(process.env.COWORK_OUTPUTS);
  // Claude Co-work oturum klasörleri: .../local-agent-mode-sessions/**/outputs
  const sessions = path.join(
    os.homedir(), 'AppData', 'Roaming', 'Claude', 'local-agent-mode-sessions');
  if (fs.existsSync(sessions)) roots.push(sessions);
  roots.push(DESKTOP, path.join(os.homedir(), 'Downloads'));

  const found = [];
  const walk = (dir, depth) => {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (/\.docx$/i.test(e.name) && !e.name.startsWith('~$')) {
        try { found.push({ full, mtime: fs.statSync(full).mtimeMs }); } catch { /* atla */ }
      }
    }
  };
  for (const r of roots) walk(r, 0);

  if (found.length === 0) {
    throw new Error(
      'Hiç .docx rapor bulunamadı.\n' +
      '  Çözüm: --rapor "tam\\dosya\\yolu.docx" ver ya da COWORK_OUTPUTS ayarla.',
    );
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0].full;
}

// ---------------------------------------------------------------------
// PREI çağrıları
// ---------------------------------------------------------------------
async function callApi(method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: { 'X-Agent-Key': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → HTTP ${res.status}: ${json.message ?? text.slice(0, 200)}`);
  }
  return json;
}

// ---------------------------------------------------------------------
// Klasör yazımı
// ---------------------------------------------------------------------
function slug(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[İIı]/g, 'i').replace(/[Çç]/g, 'c').replace(/[Ğğ]/g, 'g')
    .replace(/[Öö]/g, 'o').replace(/[Şş]/g, 's').replace(/[Üü]/g, 'u')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function itemsToMarkdown(detail) {
  const L = [`# Haber Kalemleri — ${detail.title}`, ''];
  const byMarket = new Map();
  for (const it of detail.items ?? []) {
    const k = it.marketCode ?? 'Genel';
    if (!byMarket.has(k)) byMarket.set(k, []);
    byMarket.get(k).push(it);
  }
  for (const [market, items] of byMarket) {
    L.push(`## ${market}`, '');
    for (const it of items) {
      const flag = it.isSpeculative ? ' **[SPEKÜLATİF — paylaşma]**' : '';
      L.push(`- ${it.headline}${flag}`);
      if (it.detail) L.push(`  - ${it.detail}`);
      if (it.section) L.push(`  - _bölüm: ${it.section}_`);
    }
    L.push('');
  }
  return L.join('\n');
}

// ---------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------
async function main() {
  log('');
  log('  PREI · Haftalık İçerik Paketi');
  log('  ' + '─'.repeat(46));

  if (!KEY) {
    log('');
    log('  HATA: PREI_AGENT_KEY tanımlı değil.');
    log('  Bu betiğin yanına .env dosyası koyun:');
    log('    PREI_AGENT_KEY=...');
    process.exit(1);
  }

  // 1) Rapor
  const reportPath = findLatestReport();
  log(`  1/6  Rapor bulundu: ${path.basename(reportPath)}`);
  const buf = await fsp.readFile(reportPath);
  const text = docxToText(buf);
  log(`       ${text.length.toLocaleString('tr-TR')} karakter okundu`);

  // 2) PREI'ye yükle
  log('  2/6  PREI arşivine yükleniyor...');
  const report = await callApi('POST', '/api/agent/intel/reports', {
    fileName: path.basename(reportPath), text,
  });
  log(`       "${report.title}"`);
  log(`       ${report.sectionCount} bölüm · ${report.itemCount} haber · ${(report.markets ?? []).join(', ')}`);

  // 3) İçerik paketi
  log('  3/6  Post metinleri ve karusel planları üretiliyor...');
  let pack = null;
  try {
    pack = await callApi('POST', `/api/agent/intel/reports/${report.id}/content-pack`, {});
    if (pack.ok) {
      log(`       ${pack.pack.posts.length} post · ${pack.pack.carousels.length} karusel` +
          (pack.pack.skipped?.length ? ` · ${pack.pack.skipped.length} atlanan` : ''));
    } else {
      warn(pack.message);
    }
  } catch (e) {
    warn(`İçerik paketi alınamadı: ${e.message}`);
  }

  // 4) Karusel görselleri
  let images = [];
  if (!SKIP_IMAGES && pack?.ok && pack.packId && pack.pack.carousels.length > 0) {
    log('  4/6  Karusel görselleri üretiliyor (Nano Banana)...');
    try {
      const res = await callApi('POST', `/api/agent/intel/content-packs/${pack.packId}/images`, {});
      images = res.images ?? [];
      const ok = images.filter((i) => i.data).length;
      log(`       ${ok}/${images.length} görsel geldi`);
      if (res.message) warn(res.message);
    } catch (e) {
      warn(`Görseller alınamadı: ${e.message}`);
    }
  } else {
    log('  4/6  Görsel adımı atlandı');
  }

  // 5) Klasöre yaz
  const dateLabel = report.periodEnd ?? report.reportDate ?? new Date().toISOString().slice(0, 10);
  const dir = path.join(TARGET_ROOT, `${dateLabel} ${slug(report.title)}`);
  await fsp.mkdir(dir, { recursive: true });
  log(`  5/6  Yazılıyor: ${dir}`);

  // Raporun kopyası
  await fsp.copyFile(reportPath, path.join(dir, path.basename(reportPath)));

  // Haber kalemleri (paket üretilemese de bu her zaman yazılır)
  let detail = report;
  if (!detail.items) {
    try { detail = await callApi('GET', `/api/agent/intel/reports/${report.id}`); } catch { /* elimizdekiyle devam */ }
  }
  await fsp.writeFile(path.join(dir, 'haberler.md'), itemsToMarkdown(detail), 'utf8');
  log('       ✓ haberler.md');

  // Post metinleri
  if (pack?.ok && pack.markdown) {
    await fsp.writeFile(path.join(dir, 'postlar.md'), pack.markdown, 'utf8');
    log('       ✓ postlar.md');
    await fsp.writeFile(
      path.join(dir, 'icerik-paketi.json'), JSON.stringify(pack.pack, null, 2), 'utf8');
    log('       ✓ icerik-paketi.json');
  } else {
    await fsp.writeFile(
      path.join(dir, 'postlar-URETILEMEDI.txt'),
      `Post metinleri üretilemedi.\n\nSebep: ${pack?.message ?? 'bilinmiyor'}\n\n` +
      'Anahtar tanımlandıktan sonra bu betiği yeniden çalıştırın.\n', 'utf8');
    log('       ✓ postlar-URETILEMEDI.txt (sebep yazıldı)');
  }

  // Görseller
  let written = 0;
  for (const img of images) {
    if (!img.data) continue;
    const ext = (img.mimeType ?? 'image/png').split('/')[1] ?? 'png';
    const name = `karusel-${img.carouselIndex}-slayt-${img.slideIndex}.${ext}`;
    await fsp.writeFile(path.join(dir, name), Buffer.from(img.data, 'base64'));
    written++;
  }
  if (written > 0) log(`       ✓ ${written} görsel`);

  // 6) Haftalık yayın akışı — 4 LinkedIn postu + 2-3 karusel, günlere dağılmış.
  // Drive yüklemesi BURADAN yapılamaz (kullanıcının Google oturumunu ister);
  // PREI > Pazarlama > Haftalık Yayın Akışı'ndan "Drive'a yükle" ile yapılır.
  log('  6/6  Haftalık yayın akışı kuruluyor...');
  try {
    const res = await callApi(
      'POST', `/api/agent/intel/publishing/generate/${report.id}`, { generateImages: false });
    if (res.ok && res.plan) {
      const posts = res.plan.items.filter((i) => i.kind === 'post');
      const cars = res.plan.items.filter((i) => i.kind === 'carousel');
      log(`       ${res.plan.weekStart} – ${res.plan.weekEnd} · ` +
          `${posts.length} post · ${cars.length} karusel`);
      await fsp.writeFile(
        path.join(dir, 'yayin-akisi.md'), planToMarkdown(res.plan), 'utf8');
      log('       ✓ yayin-akisi.md');
      for (const p of posts) {
        const body = [p.hook, p.body,
          (p.hashtags ?? []).map((h) => `#${String(h).replace(/^#/, '')}`).join(' ')]
          .filter(Boolean).join('\n\n');
        await fsp.writeFile(
          path.join(dir, `linkedin-${p.scheduledDate}-${slug(p.dayName)}.txt`), body, 'utf8');
      }
      log(`       ✓ ${posts.length} LinkedIn metni (ayrı dosya)`);
      log("       → Drive'a yüklemek için: PREI > Pazarlama > Haftalık Yayın Akışı");
    } else {
      warn(res.message ?? 'Yayın akışı üretilemedi');
    }
  } catch (e) {
    warn(`Yayın akışı kurulamadı: ${e.message}`);
  }

  log('');
  log('  Bitti. Klasör:');
  log(`  ${dir}`);
  log('');
}

/** Yayın akışını tek bakışta okunacak markdown'a çevirir. */
function planToMarkdown(plan) {
  const L = [`# Yayın Akışı — ${plan.weekStart} – ${plan.weekEnd}`, ''];
  L.push('| Gün | Tarih | Tür | Konu | LinkedIn |');
  L.push('|---|---|---|---|---|');
  for (const i of plan.items) {
    L.push(`| ${i.dayName} | ${i.scheduledDate} | ` +
      `${i.kind === 'post' ? 'Post' : `Karusel (${i.slides.length} slayt)`} | ` +
      `${i.title} | ${i.forLinkedin ? 'evet' : '—'} |`);
  }
  L.push('');
  for (const i of plan.items) {
    L.push(`## ${i.dayName} · ${i.scheduledDate} — ${i.title}`);
    L.push('');
    if (i.kind === 'post') {
      L.push('**LinkedIn**', '', i.hook ?? '', '', i.body ?? '', '');
      L.push('**Instagram/Facebook**', '', i.instagramCaption ?? '', '');
    } else {
      L.push('**Slaytlar**', '');
      for (const s of i.slides) L.push(`${s.index}. **${s.headline}** — ${s.body}`);
      L.push('', '**Metin**', '', i.instagramCaption ?? '', '');
    }
    if ((i.hashtags ?? []).length > 0) {
      L.push(i.hashtags.map((h) => `#${String(h).replace(/^#/, '')}`).join(' '), '');
    }
    L.push('---', '');
  }
  if ((plan.skipped ?? []).length > 0) {
    L.push('## Bu hafta kullanılmayanlar', '');
    for (const s of plan.skipped) L.push(`- **${s.topic}** — ${s.reason}`);
  }
  return L.join('\n');
}

main().catch((e) => {
  log('');
  log(`  HATA: ${e.message}`);
  log('');
  process.exit(1);
});
