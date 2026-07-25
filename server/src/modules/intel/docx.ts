// =====================================================================
// PREI | .docx metin çıkarma. docx = ZIP; word/document.xml içindeki
// <w:p> paragrafları düz metne çevrilir. Tablolar da paragraf içerir,
// onlar da gelir. Görsel/biçim atılır — arşiv metni istiyoruz.
// =====================================================================
import JSZip from 'jszip';

/** XML varlıklarını çözer (&apos; &amp; gibi). */
function decodeEntities(s: string): string {
  return s
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');
}

/** .docx buffer → düz metin (paragraf başına bir satır). */
export async function docxToText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('Geçersiz .docx — word/document.xml yok');
  const xml = await doc.async('string');

  const paras = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const out: string[] = [];
  for (const p of paras) {
    // <w:t> düğümleri metni taşır; <w:tab/> ve <w:br/> boşluk olur.
    const withBreaks = p.replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>/g, ' ');
    const texts = withBreaks.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
    const line = texts
      .map((t) => t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
      .join('');
    const clean = decodeEntities(line).replace(/\s+/g, ' ').trim();
    if (clean) out.push(clean);
  }
  return out.join('\n');
}
