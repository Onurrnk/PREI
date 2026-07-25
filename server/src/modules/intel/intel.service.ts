// =====================================================================
// PREI | IntelService — haftalık istihbarat raporu arşivi.
//
// Onur'un tarifi: rapor MÜŞTERİYE GİTMEZ. İki işi var —
//   1) bilgi bankası: "İspanya'da geçen çeyrek ne olmuş" sorulabilsin
//   2) içerik kaynağı: sosyal medya postu / video için haber çıkarılsın
//
// Spekülatif bölüm ayrı etiketlenir: doğrulanmamış bir haber "doğrulanmış"
// gibi sosyal medyaya düşmesin — raporun kendi editoryal kararı korunur.
// =====================================================================
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import { docxToText } from './docx';
import {
  extractNewsItems, isSpeculativeSection, parseReportText, sectionMarket,
  type ReportSection,
} from './intel-report';

export interface IntelReportSummary {
  id: string;
  title: string;
  reportDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  markets: string[];
  sectionCount: number;
  itemCount: number;
  source: string;
  createdAt: string;
}

export interface IntelReportDetail extends IntelReportSummary {
  sections: ReportSection[];
  items: IntelItem[];
}

export interface IntelItem {
  id: string;
  reportId: string;
  headline: string;
  detail: string | null;
  marketCode: string | null;
  section: string | null;
  isSpeculative: boolean;
  suggestedFormat: string | null;
  status: 'new' | 'queued' | 'published' | 'skipped';
  createdAt: string;
}

/** Arama sonucu — hangi raporun hangi bölümünde geçtiği. */
export interface IntelSearchHit {
  reportId: string;
  title: string;
  reportDate: string;
  sectionHeading: string | null;
  /** Eşleşen yerin çevresi — okumadan ne olduğu anlaşılsın. */
  snippet: string;
}

interface ItemRow {
  id: string; report_id: string; headline: string; detail: string | null;
  market_code: string | null; section: string | null; is_speculative: boolean;
  suggested_format: string | null; status: IntelItem['status']; created_at: string;
}

const toItem = (r: ItemRow): IntelItem => ({
  id: r.id, reportId: r.report_id, headline: r.headline, detail: r.detail,
  marketCode: r.market_code, section: r.section, isSpeculative: r.is_speculative,
  suggestedFormat: r.suggested_format, status: r.status, createdAt: r.created_at,
});

/**
 * Bölüm içeriğine göre format önerisi. Rakam yoğun bölüm carousel'e,
 * tek çarpıcı veri reel'e, uzun analiz video'ya uygun.
 */
function suggestFormat(section: ReportSection, itemCount: number): string {
  if (isSpeculativeSection(section.heading)) return 'story'; // kısa ömürlü, iddia
  if (itemCount >= 4) return 'carousel';
  if (section.body.length > 4000) return 'video';
  return 'reel';
}

@Injectable()
export class IntelService {
  private readonly logger = new Logger(IntelService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Rapor alımı: .docx veya düz metin → ayrıştır → arşivle → haber
   * kalemlerini çıkar. Aynı dönem tekrar yüklenirse ÜZERİNE YAZMAZ,
   * yeni sürüm olarak eklenir (rapor geçmişi kaybolmasın).
   */
  async ingest(
    ctx: RequestContext,
    input: { fileName: string; buffer?: Buffer; text?: string; source?: 'upload' | 'cowork' | 'manual' },
  ): Promise<IntelReportDetail> {
    let raw: string;
    if (input.buffer && /\.docx$/i.test(input.fileName)) {
      raw = await docxToText(input.buffer);
    } else if (input.text && input.text.trim().length > 0) {
      raw = input.text;
    } else if (input.buffer) {
      // .txt / .md gibi düz metin dosyaları
      raw = input.buffer.toString('utf8');
    } else {
      throw new BadRequestException('Dosya veya metin gerekli');
    }

    if (raw.trim().length < 200) {
      throw new BadRequestException('Rapor çok kısa — ayrıştırılamadı (en az 200 karakter)');
    }

    const parsed = parseReportText(raw, input.fileName);
    if (parsed.sections.length === 0) {
      throw new BadRequestException(
        'Numaralı bölüm başlığı bulunamadı. Rapor "1. Yönetici Özeti" biçiminde bölümlenmiş olmalı.',
      );
    }

    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string; created_at: string }>(
        `INSERT INTO intel_reports
           (tenant_id, title, period_start, period_end, report_date, markets,
            full_text, sections, source, metadata, created_by, updated_by)
         VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8::jsonb,$9,$10::jsonb,$11,$11)
         RETURNING id, created_at::text`,
        [ctx.tenantId, parsed.title, parsed.periodStart, parsed.periodEnd,
         parsed.reportDate, parsed.markets, parsed.fullText,
         JSON.stringify(parsed.sections), input.source ?? 'upload',
         JSON.stringify({ fileName: input.fileName, chars: parsed.fullText.length }),
         ctx.userId],
      );
      const reportId = rows[0].id;

      // Haber kalemleri: her bölümden çıkar, spekülatif olanı işaretle.
      let itemCount = 0;
      for (const section of parsed.sections) {
        const news = extractNewsItems(section);
        if (news.length === 0) continue;
        const speculative = isSpeculativeSection(section.heading);
        const market = sectionMarket(section);
        const format = suggestFormat(section, news.length);
        for (const n of news) {
          await c.query(
            `INSERT INTO intel_report_items
               (tenant_id, report_id, headline, detail, market_code, section,
                is_speculative, suggested_format, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
            [ctx.tenantId, reportId, n.headline, n.detail, market,
             section.heading, speculative, format, ctx.userId],
          );
          itemCount++;
        }
      }

      const { rows: itemRows } = await c.query<ItemRow>(
        `SELECT id, report_id, headline, detail, market_code, section,
                is_speculative, suggested_format, status, created_at::text
           FROM intel_report_items WHERE report_id = $1 ORDER BY created_at`,
        [reportId],
      );

      this.logger.log(
        `İstihbarat raporu arşivlendi: "${parsed.title}" — ` +
        `${parsed.sections.length} bölüm, ${itemCount} haber kalemi, pazarlar: ${parsed.markets.join(',')}`,
      );

      return {
        id: reportId, title: parsed.title,
        reportDate: parsed.reportDate ?? new Date().toISOString().slice(0, 10),
        periodStart: parsed.periodStart, periodEnd: parsed.periodEnd,
        markets: parsed.markets, sectionCount: parsed.sections.length,
        itemCount, source: input.source ?? 'upload', createdAt: rows[0].created_at,
        sections: parsed.sections, items: itemRows.map(toItem),
      };
    });
  }

  /** Arşiv listesi — en yeniden eskiye. */
  async list(ctx: RequestContext, limit = 50): Promise<IntelReportSummary[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; title: string; report_date: string;
        period_start: string | null; period_end: string | null;
        markets: string[]; section_count: string; item_count: string;
        source: string; created_at: string;
      }>(
        `SELECT r.id, r.title, r.report_date::text,
                r.period_start::text, r.period_end::text, r.markets,
                jsonb_array_length(r.sections)::text AS section_count,
                (SELECT count(*) FROM intel_report_items i WHERE i.report_id = r.id)::text AS item_count,
                r.source, r.created_at::text
           FROM intel_reports r
          WHERE r.deleted_at IS NULL
          ORDER BY r.report_date DESC, r.created_at DESC
          LIMIT $1`,
        [Math.min(Math.max(limit, 1), 200)],
      );
      return rows.map((r) => ({
        id: r.id, title: r.title, reportDate: r.report_date,
        periodStart: r.period_start, periodEnd: r.period_end,
        markets: r.markets ?? [], sectionCount: Number(r.section_count),
        itemCount: Number(r.item_count), source: r.source, createdAt: r.created_at,
      }));
    });
  }

  /** Tek rapor: bölümler + haber kalemleri. */
  async detail(ctx: RequestContext, id: string): Promise<IntelReportDetail> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; title: string; report_date: string;
        period_start: string | null; period_end: string | null; markets: string[];
        sections: ReportSection[]; source: string; created_at: string;
      }>(
        `SELECT id, title, report_date::text, period_start::text, period_end::text,
                markets, sections, source, created_at::text
           FROM intel_reports WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      const r = rows[0];
      if (!r) throw new NotFoundException('Rapor bulunamadı');

      const { rows: items } = await c.query<ItemRow>(
        `SELECT id, report_id, headline, detail, market_code, section,
                is_speculative, suggested_format, status, created_at::text
           FROM intel_report_items WHERE report_id = $1 ORDER BY created_at`,
        [id],
      );

      const sections = Array.isArray(r.sections) ? r.sections : [];
      return {
        id: r.id, title: r.title, reportDate: r.report_date,
        periodStart: r.period_start, periodEnd: r.period_end,
        markets: r.markets ?? [], sectionCount: sections.length,
        itemCount: items.length, source: r.source, createdAt: r.created_at,
        sections, items: items.map(toItem),
      };
    });
  }

  /**
   * Bilgi bankası araması. Tam metin üzerinde çalışır ve EŞLEŞEN BÖLÜMÜ
   * bulur — "İspanya'da geçen çeyrek ne olmuş" sorusunun cevabı doğrudan
   * o bölümdür, tüm rapor değil.
   */
  async search(
    ctx: RequestContext, q: string, market?: string, limit = 30,
  ): Promise<IntelSearchHit[]> {
    const needle = q.trim();
    if (needle.length < 2) return [];

    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; title: string; report_date: string; sections: ReportSection[];
      }>(
        `SELECT id, title, report_date::text, sections
           FROM intel_reports
          WHERE deleted_at IS NULL
            AND full_text ILIKE $1
            AND ($2::text IS NULL OR $2 = ANY(markets))
          ORDER BY report_date DESC
          LIMIT $3`,
        [`%${needle}%`, market ?? null, Math.min(Math.max(limit, 1), 100)],
      );

      const hits: IntelSearchHit[] = [];
      const low = needle.toLocaleLowerCase('tr');
      for (const r of rows) {
        const sections = Array.isArray(r.sections) ? r.sections : [];
        let matched = false;
        for (const s of sections) {
          const idx = s.body.toLocaleLowerCase('tr').indexOf(low);
          if (idx < 0) continue;
          matched = true;
          const from = Math.max(0, idx - 120);
          const to = Math.min(s.body.length, idx + needle.length + 200);
          hits.push({
            reportId: r.id, title: r.title, reportDate: r.report_date,
            sectionHeading: s.heading,
            snippet: `${from > 0 ? '…' : ''}${s.body.slice(from, to).trim()}${to < s.body.length ? '…' : ''}`,
          });
          if (hits.length >= limit) break;
        }
        // Bölümde değil başlıkta/başlık bloğunda geçiyorsa da bildir.
        if (!matched) {
          hits.push({
            reportId: r.id, title: r.title, reportDate: r.report_date,
            sectionHeading: null, snippet: '(rapor başlık bloğunda geçiyor)',
          });
        }
        if (hits.length >= limit) break;
      }
      return hits;
    });
  }

  /** İçerik kuyruğu: sosyal medyaya çıkarılacak haber kalemleri. */
  async items(
    ctx: RequestContext,
    f: { status?: string; market?: string; speculative?: boolean; limit?: number },
  ): Promise<IntelItem[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ItemRow>(
        `SELECT id, report_id, headline, detail, market_code, section,
                is_speculative, suggested_format, status, created_at::text
           FROM intel_report_items
          WHERE ($1::text IS NULL OR status = $1)
            AND ($2::text IS NULL OR market_code = $2)
            AND ($3::boolean IS NULL OR is_speculative = $3)
          ORDER BY is_speculative ASC, created_at DESC
          LIMIT $4`,
        [f.status ?? null, f.market ?? null, f.speculative ?? null,
         Math.min(Math.max(f.limit ?? 60, 1), 200)],
      );
      return rows.map(toItem);
    });
  }

  /** Kalem durumunu günceller (kuyruğa al / paylaşıldı / atla). */
  async updateItem(
    ctx: RequestContext, id: string, status: IntelItem['status'],
  ): Promise<IntelItem> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ItemRow>(
        `UPDATE intel_report_items SET status = $2, updated_by = $3
          WHERE id = $1
         RETURNING id, report_id, headline, detail, market_code, section,
                   is_speculative, suggested_format, status, created_at::text`,
        [id, status, ctx.userId],
      );
      if (rows.length === 0) throw new NotFoundException('Haber kalemi bulunamadı');
      return toItem(rows[0]);
    });
  }

  async remove(ctx: RequestContext, id: string): Promise<{ deleted: true }> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE intel_reports SET deleted_at = now(), updated_by = $2
          WHERE id = $1 AND deleted_at IS NULL`,
        [id, ctx.userId],
      );
      if (!rowCount) throw new NotFoundException('Rapor bulunamadı');
      return { deleted: true };
    });
  }
}
