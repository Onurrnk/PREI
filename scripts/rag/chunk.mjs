// Parçalama ve kalite elemesi — extract.mjs ve extract-books.mjs ortak kullanır.

/** ~1200 karakterlik, cümle sınırında kesilen parçalar; 150 karakter örtüşme. */
export function chunkText(text, size = 1200, overlap = 150) {
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
 *
 * SINIR: rapor databank tablolarını sağlıklı metinden AYIRAMAZ (harf oranı
 * 0,58–0,74 çöp vs 0,72 sağlıklı). Agresif eşik denemeyin — künye + persona
 * kuralı o işi üstleniyor.
 */
export function isProse(text) {
  const dense = text.replace(/\s/g, '');
  if (!dense) return false;
  const letters = (dense.match(/\p{L}/gu) ?? []).length;
  if (letters / dense.length < 0.55) return false;
  const words = text.match(/\p{L}{3,}/gu) ?? [];
  return words.length >= 15;
}

/** PDF'in kendi CreationDate'i (D:20260723222226+03'00') → 2026-07-23. */
export function pdfDate(raw) {
  const m = /^D:(\d{4})(\d{2})(\d{2})/.exec(String(raw ?? ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
