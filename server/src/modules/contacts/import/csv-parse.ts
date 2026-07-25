// =====================================================================
// PREI | CSV ayrıştırıcı — saf, bağımsız.
//
// Neden hazır kütüphane değil: gelecek dosyalar ProDuality'nin gerçek
// defterinden çıkacak (Excel "CSV olarak kaydet", Google Kişiler dışa
// aktarımı, WhatsApp rehber dökümü). Bunların üçü de farklı huyda:
//
// · Türkçe Windows Excel ayırıcı olarak NOKTALI VİRGÜL yazar, virgül değil.
//   Bunu varsaymak yerine ölçüyoruz — yanlış ayırıcı tüm satırı tek kolona
//   çevirir ve "hiçbir kolon tanınmadı" diye sessizce boş içe aktarım olur.
// · Excel dosyanın başına UTF-8 BOM koyar; ilk başlık "﻿Ad" olur ve
//   kolon eşleşmesi tutmaz.
// · Adres/not alanlarında tırnak içinde satır sonu bulunur (RFC 4180).
//
// Ayırıcı seçimi tahminle değil puanla yapılır: her aday ayırıcıyla dosya
// baştan ayrıştırılır, başlıkla aynı kolon sayısını tutturan satır oranı
// puandır. Dosyalar birkaç bin satır; maliyeti önemsiz.
// =====================================================================

/** Denenen ayırıcılar — Türkçe Excel (;) ilk sırada değil, puan karar verir. */
const CANDIDATES = [',', ';', '\t', '|'] as const;

export interface ParsedCsv {
  /** Seçilen ayırıcı (arayüzde gösterilir — kullanıcı yanlışsa görsün). */
  delimiter: string;
  header: string[];
  rows: string[][];
}

/** Baştaki UTF-8 BOM'u atar. Excel'in her CSV'sine koyduğu görünmez karakter. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Tek ayırıcıyla ayrıştırma (RFC 4180).
 * Tırnak içinde ayırıcı, satır sonu ve "" ile kaçırılmış tırnak desteklenir.
 */
export function parseWith(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let started = false;   // bu satırda hiç karakter görüldü mü (boş satır ayıklama)

  const endField = (): void => { row.push(field); field = ''; };
  const endRow = (): void => {
    endField();
    // Tamamen boş satırı atla (dosya sonundaki fazladan yeni satır dahil).
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // "" → gerçek tırnak karakteri; tek " → alan bitti.
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === '') { inQuotes = true; started = true; continue; }
    if (ch === delimiter) { endField(); started = true; continue; }
    if (ch === '\r') continue;                 // CRLF → LF gibi davran
    if (ch === '\n') { endRow(); continue; }

    field += ch;
    started = true;
  }

  // Dosya yeni satırla bitmiyorsa son satır kaybolmasın.
  if (started || field !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * Ayırıcıyı ölçerek seçer.
 *
 * Puan = başlıkla aynı kolon sayısını tutturan veri satırı oranı.
 * Tek kolonluk sonuç (ayırıcı hiç geçmiyor) elenir: "her satır 1 kolon"
 * teknik olarak %100 tutarlıdır ama işe yaramaz.
 */
export function sniffDelimiter(text: string): string {
  let best = ',';
  let bestScore = -1;

  for (const d of CANDIDATES) {
    const rows = parseWith(text, d);
    if (rows.length === 0) continue;
    const cols = rows[0].length;
    if (cols < 2) continue;                    // ayırıcı bu dosyada yok

    const body = rows.slice(1);
    const consistent = body.filter((r) => r.length === cols).length;
    // Veri satırı yoksa (yalnız başlık) kolon sayısı tek başına karar verir.
    const ratio = body.length === 0 ? 1 : consistent / body.length;
    // Eşitlikte daha çok kolon üreten kazanır: ";" ile 6 kolon, "," ile 2
    // kolon çıkıyorsa doğru ayırıcı ";"dir.
    const score = ratio * 100 + cols;

    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/**
 * Metni başlık + satırlara ayırır. Ayırıcı verilmezse ölçülerek seçilir.
 *
 * Kısa satırlar başlık uzunluğuna kadar boş alanla tamamlanır, uzun satırlar
 * kırpılmaz (fazlası yok sayılır) — tek bozuk satır tüm içe aktarımı
 * düşürmesin.
 */
export function parseCsv(text: string, delimiter?: string): ParsedCsv {
  const clean = stripBom(text);
  const d = delimiter ?? sniffDelimiter(clean);
  const all = parseWith(clean, d);

  if (all.length === 0) return { delimiter: d, header: [], rows: [] };

  const header = all[0].map((h) => h.trim());
  const width = header.length;
  const rows = all.slice(1).map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push('');
    return out;
  });

  return { delimiter: d, header, rows };
}
