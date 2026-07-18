// =====================================================================
// PREI | Marketing — CSV → ad_spend satırları (istemci tarafı ayrıştırma).
// Meta Ads Manager dışa aktarımı ("Campaign name", "Amount spent (EUR)",
// "Reporting starts"…) VE sade başlıklar (name, spend, period_start…) için
// esnek başlık eşleme. Ayrıştırma tarayıcıda yapılır; sonuç JSON olarak
// POST /api/marketing/campaigns/import'a gider (backend tekrar doğrular).
// =====================================================================
import type { CreateAdSpendInput } from '../../core/types';

/** Tek CSV satırını alanlara böler (RFC 4180: tırnaklı alan + "" kaçışı). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const MARKET_MAP: Record<string, string> = {
  tr: 'TR', turkey: 'TR', türkiye: 'TR', turkiye: 'TR',
  ae: 'AE', uae: 'AE', dubai: 'AE', 'birleşik arap emirlikleri': 'AE', bae: 'AE',
  es: 'ES', spain: 'ES', ispanya: 'ES', 'i̇spanya': 'ES', españa: 'ES',
  gb: 'GB', uk: 'GB', 'united kingdom': 'GB', england: 'GB', ingiltere: 'GB', 'i̇ngiltere': 'GB',
  th: 'TH', thailand: 'TH', tayland: 'TH',
  de: 'DE', germany: 'DE', almanya: 'DE',
};
export function normalizeMarket(v: string | undefined): string | undefined {
  if (!v) return undefined;
  return MARKET_MAP[v.trim().toLowerCase()] ?? undefined;
}

export function normalizeChannel(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (['meta', 'facebook', 'fb'].includes(s)) return 'meta';
  if (['instagram', 'ig'].includes(s)) return 'instagram';
  if (['google', 'google ads', 'adwords'].includes(s)) return 'google';
  return 'other';
}

export function normalizeStatus(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (['paused', 'pause', 'duraklatıldı', 'duraklatildi', 'pasif', 'inactive', 'off'].includes(s)) return 'paused';
  if (['active', 'aktif', 'on', 'running'].includes(s)) return 'active';
  return undefined;
}

/** Tarihi YYYY-MM-DD'ye normalize eder (YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, DD.MM.YYYY). */
export function normalizeDate(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s);
  if (m) {
    // Ayırıcı '.' ise DD.MM.YYYY (TR); '/' ise MM/DD/YYYY (Meta/US).
    const isDot = s.includes('.');
    const day = isDot ? m[1] : m[2];
    const month = isDot ? m[2] : m[1];
    return `${m[3]}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return undefined;
}

function parseNumber(v: string | undefined): number | undefined {
  if (v == null || v.trim() === '') return undefined;
  // "1.234,56" (TR) veya "1,234.56" (EN) veya "€1,280" → sayıya indir.
  const cleaned = v.replace(/[^\d,.\-]/g, '');
  let n: number;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Son ayırıcı ondalıktır.
    n = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? Number(cleaned.replace(/\./g, '').replace(',', '.'))
      : Number(cleaned.replace(/,/g, ''));
  } else if (cleaned.includes(',')) {
    // Yalnız virgül: ondalık say (1280,50) — ama 3 hane grubuysa binlik.
    n = /,\d{3}$/.test(cleaned) ? Number(cleaned.replace(/,/g, '')) : Number(cleaned.replace(',', '.'));
  } else {
    n = Number(cleaned);
  }
  return Number.isFinite(n) ? n : undefined;
}

/** Başlık adını kanonik alana eşler. */
function canonHeader(h: string): string | null {
  const s = h.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/(^| )campaign name$|^name$|^kampanya$|^campaign$/.test(s)) return 'name';
  if (/(campaign[_ ]?id|campaign[_ ]?ref|^ref$)/.test(s)) return 'campaignRef';
  if (/^market|pazar|country|ülke|ulke/.test(s)) return 'marketCode';
  if (/^channel|kanal|platform$/.test(s)) return 'channel';
  if (/^status|durum|delivery/.test(s)) return 'status';
  if (/reporting starts|period[_ ]?start|^start$|başlangıç|baslangic|start date/.test(s)) return 'periodStart';
  if (/reporting ends|period[_ ]?end|^end$|bitiş|bitis|end date/.test(s)) return 'periodEnd';
  if (/amount spent|^spend$|harcama|^amount$|cost|maliyet/.test(s)) return 'spend';
  if (/^currency|para( birimi)?$/.test(s)) return 'currency';
  if (/impression|gösterim|gosterim/.test(s)) return 'impressions';
  if (/link clicks|^clicks|tıklama|tiklama/.test(s)) return 'clicks';
  return null;
}

/** "Amount spent (EUR)" gibi başlıktan para birimini çıkarır. */
function currencyFromHeader(h: string): string | undefined {
  const m = /\(([A-Z]{3})\)/.exec(h);
  return m ? m[1] : undefined;
}

export interface CsvParseResult {
  rows: CreateAdSpendInput[];
  errors: string[];
}

/** CSV metnini ad_spend giriş satırlarına çevirir; hatalı satırları atlar, gerekçesini toplar. */
export function parseAdSpendCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) {
    return { rows: [], errors: ['CSV en az bir başlık ve bir veri satırı içermeli.'] };
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const headerMap = rawHeaders.map(canonHeader);
  let spendCurrency: string | undefined;
  rawHeaders.forEach((h, i) => { if (headerMap[i] === 'spend') spendCurrency = currencyFromHeader(h); });

  if (!headerMap.includes('name')) errors.push('Zorunlu "name/Campaign name" sütunu bulunamadı.');

  const rows: CreateAdSpendInput[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]);
    const rec: Record<string, string> = {};
    headerMap.forEach((key, i) => { if (key) rec[key] = cells[i] ?? ''; });

    const name = rec.name?.trim();
    const periodStart = normalizeDate(rec.periodStart);
    const periodEnd = normalizeDate(rec.periodEnd);
    if (!name) { errors.push(`Satır ${li + 1}: ad boş, atlandı.`); continue; }
    if (!periodStart || !periodEnd) { errors.push(`Satır ${li + 1} (${name}): geçerli tarih yok, atlandı.`); continue; }

    rows.push({
      name,
      campaignRef: rec.campaignRef?.trim() || undefined,
      marketCode: normalizeMarket(rec.marketCode),
      channel: normalizeChannel(rec.channel) ?? 'meta',
      status: normalizeStatus(rec.status) ?? 'active',
      periodStart,
      periodEnd,
      spend: parseNumber(rec.spend) ?? 0,
      currency: rec.currency?.trim().toUpperCase() || spendCurrency || 'EUR',
      impressions: parseNumber(rec.impressions),
      clicks: parseNumber(rec.clicks),
    });
  }

  return { rows, errors };
}
