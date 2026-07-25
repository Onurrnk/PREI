// =====================================================================
// PREI | İstihbarat raporu ayrıştırma — saf (yan etkisiz) parçalar.
//
// Onur'un Co-work ile ürettiği rapor 15 numaralı bölümden oluşuyor
// (Yönetici Özeti … Nihai Değerlendirme) ve spekülatif içeriği AYRI bir
// bölümde etiketliyor. Bu yapı korunmalı: arşivde bölüm bölüm okunabilsin,
// spekülatif haber "doğrulanmış" gibi sosyal medyaya düşmesin.
// =====================================================================

export interface ReportSection {
  index: number;
  heading: string;
  body: string;
}

export interface ParsedReport {
  title: string;
  reportDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  markets: string[];
  sections: ReportSection[];
  fullText: string;
}

/**
 * Türkçe metni ASCII'ye katlar — eşleştirme için tek kanonik biçim.
 *
 * NEDEN ŞART (canlı raporda ikisi de ısırdı):
 *  1. JavaScript'in /i bayrağı 'İ' (U+0130) karakterini 'i'ye KATLAMAZ;
 *     /izlenen/i deseni "İzlenen Pazarlar" ile eşleşmez.
 *  2. 'İspanya' içindeki İ ile 'i' + birleşen nokta (U+0307) FARKLI
 *     karakterlerdir; naif desen İspanya ve İngiltere'yi kaçırır.
 * Bu yüzden tüm Türkçe eşleştirme katlanmış metin üzerinde yapılır.
 */
export function foldTr(s: string): string {
  return s
    .normalize('NFD')
    // Birleşen aksanları at (ayrışan İ → I + U+0307 dahil)
    .replace(/[̀-ͯ]/g, '')
    .replace(/[İIı]/g, 'i')
    .replace(/[Çç]/g, 'c').replace(/[Ğğ]/g, 'g')
    .replace(/[Öö]/g, 'o').replace(/[Şş]/g, 's')
    .replace(/[Üü]/g, 'u')
    .toLowerCase();
}

/** Pazar adı → ISO kodu. Desenler ASCII-katlanmış metne uygulanır. */
const MARKET_MAP: [RegExp, string][] = [
  [/turkiye|turkey/, 'TR'],
  // Dubai/Abu Dhabi şart: rapor pazarı çoğu yerde şehir adıyla anıyor
  [/\bbae\b|birlesik arap|uae|emirlik|dubai|abu dhabi|abudabi/, 'AE'],
  [/ispanya|spain/, 'ES'],
  [/ingiltere|united kingdom|\buk\b/, 'GB'],
  [/hollanda|netherlands/, 'NL'],
  [/almanya|germany/, 'DE'],
  [/tayland|thailand/, 'TH'],
  [/global|kuresel/, 'GLOBAL'],
];

/** Ay adları — anahtarlar foldTr() çıktısıyla aynı biçimde (ASCII, küçük). */
const TR_MONTHS: Record<string, string> = {
  ocak: '01', subat: '02', mart: '03', nisan: '04', mayis: '05',
  haziran: '06', temmuz: '07', agustos: '08', eylul: '09',
  ekim: '10', kasim: '11', aralik: '12',
};

/** "24 Temmuz 2026" → "2026-07-24". Tanınmazsa null. */
export function parseTurkishDate(s: string): string | null {
  const m = foldTr(s).match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = TR_MONTHS[m[2]];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

/**
 * "Kapsam Dönemi: 17 – 24 Temmuz 2026" → başlangıç ve bitiş.
 * Ay yalnız sonda yazılıyor (17 – 24 Temmuz), başlangıca da o ay uygulanır.
 */
export function parsePeriod(text: string): { start: string | null; end: string | null } {
  // Tire, en-dash, em-dash ve eksi işareti — hepsi ayraç olabilir.
  const m = foldTr(text).match(
    /(\d{1,2})\s*[–—\-−]\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})/,
  );
  if (m) {
    const month = TR_MONTHS[m[3]];
    if (month) {
      return {
        start: `${m[4]}-${month}-${m[1].padStart(2, '0')}`,
        end: `${m[4]}-${month}-${m[2].padStart(2, '0')}`,
      };
    }
  }
  // Tek tarih varsa onu bitiş kabul et.
  const single = parseTurkishDate(text);
  return { start: null, end: single };
}

/** Metinden izlenen pazarları çıkarır (yalnız "İzlenen Pazarlar" satırı). */
export function detectMarkets(text: string): string[] {
  const folded = text.split('\n').map(foldTr);
  const idx = folded.findIndex((l) => /izlenen pazarlar|monitored markets/.test(l));
  // "İzlenen Pazarlar" satırı varsa yalnız onu kullan (kesin liste);
  // yoksa başlık bloğuna bak.
  const scope = idx >= 0 ? folded[idx] : foldTr(text.slice(0, 1200));
  const out: string[] = [];
  for (const [re, code] of MARKET_MAP) {
    if (re.test(scope) && !out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Numaralı bölüm başlıklarını bulup metni böler.
 * Rapor "1. Yönetici Özeti" biçiminde; içindekiler tablosu da aynı desende
 * olduğu için İLK geçişler atlanır — asıl bölüm başlıkları içerik taşır.
 */
export function splitSections(text: string): ReportSection[] {
  const lines = text.split('\n');
  // Aday satırlar: "12. Yatırım Fırsatları" gibi, kısa ve numaralı.
  const heads: Array<{ line: number; index: number; heading: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^(\d{1,2})[.)]\s+(.{3,80})$/);
    if (m) heads.push({ line: i, index: Number(m[1]), heading: m[2].trim() });
  }
  if (heads.length === 0) return [];

  // İçindekiler bloğunu ele: aynı numara iki kez geçiyorsa İKİNCİSİ gerçek
  // bölümdür (ilki içindekiler satırı). Numara başına son geçişi al.
  const lastByIndex = new Map<number, { line: number; index: number; heading: string }>();
  for (const h of heads) {
    const prev = lastByIndex.get(h.index);
    // Aynı numaradan birden fazla varsa daha SONRAKİni tut — ama yalnız
    // aradaki mesafe anlamlıysa (içindekiler satırları birbirine yakındır).
    if (!prev || h.line - prev.line > 3) lastByIndex.set(h.index, h);
  }
  const real = [...lastByIndex.values()].sort((a, b) => a.line - b.line);

  const sections: ReportSection[] = [];
  for (let i = 0; i < real.length; i++) {
    const from = real[i].line + 1;
    const to = i + 1 < real.length ? real[i + 1].line : lines.length;
    const body = lines.slice(from, to).join('\n').trim();
    // Gövdesi olmayan başlık = içindekiler kalıntısı; atla.
    if (body.length < 40) continue;
    sections.push({ index: real[i].index, heading: real[i].heading, body });
  }
  return sections;
}

/** Bölüm başlığı spekülatif içerik mi işaret ediyor? */
export function isSpeculativeSection(heading: string): boolean {
  return /spekulatif|soylenti|rumor|unverified|dogrulanmam/.test(foldTr(heading));
}

/**
 * Bölümün gövdesinden paylaşılabilir haber kalemleri çıkarır.
 * Model kullanmaz — cümle/paragraf yapısına dayanır. Sayı veya yüzde
 * içeren cümleler öncelikli: sosyal medyada "haber" olan onlar.
 */
export function extractNewsItems(
  section: ReportSection, maxItems = 6,
): Array<{ headline: string; detail: string | null }> {
  const speculative = isSpeculativeSection(section.heading);
  const paras = section.body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 60);

  const scored = paras.map((p) => {
    // Rakam/yüzde/para birimi taşıyan paragraf haber değeri yüksektir.
    const numeric = (p.match(/%\s?\d|[\d.,]{3,}\s?(TL|USD|EUR|GBP|AED|milyar|milyon|adet)/gi) ?? []).length;
    return { p, score: numeric };
  }).sort((a, b) => b.score - a.score);

  const out: Array<{ headline: string; detail: string | null }> = [];
  for (const { p } of scored.slice(0, maxItems)) {
    // İlk cümle başlık, kalanı detay.
    const dot = p.search(/[.!?]\s/);
    const headline = (dot > 20 ? p.slice(0, dot + 1) : p).trim();
    const detail = dot > 20 ? p.slice(dot + 1).trim() : null;
    out.push({
      headline: headline.length > 200 ? `${headline.slice(0, 200)}…` : headline,
      detail: detail && detail.length > 0 ? detail : null,
    });
  }
  // Spekülatif bölümden gelenler ayrıca işaretlenecek (servis katmanı).
  void speculative;
  return out;
}

/** Bölüm gövdesinden pazar kodu tahmini (başlık + gövde ilk 300 karakter). */
export function sectionMarket(section: ReportSection): string | null {
  const scope = foldTr(`${section.heading} ${section.body.slice(0, 300)}`);
  for (const [re, code] of MARKET_MAP) if (re.test(scope)) return code;
  return null;
}

/** Ham metinden tam raporu ayrıştırır. */
export function parseReportText(text: string, fallbackTitle: string): ParsedReport {
  const clean = text.replace(/\r\n/g, '\n').replace(/ /g, ' ');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  // Başlık: "HAFTALIK ... RAPORU" satırı, yoksa dosya adı.
  const titleLine = lines.find((l) => /rapor/.test(foldTr(l)) && l.length < 120);
  const dateLine = lines.find((l) => /rapor tarihi/.test(foldTr(l))) ?? '';
  const periodLine = lines.find((l) => /kapsam donemi|kapsam/.test(foldTr(l))) ?? '';

  const period = parsePeriod(periodLine);
  return {
    title: titleLine ?? fallbackTitle,
    reportDate: parseTurkishDate(dateLine) ?? period.end,
    periodStart: period.start,
    periodEnd: period.end,
    markets: detectMarkets(clean),
    sections: splitSections(clean),
    fullText: clean,
  };
}
