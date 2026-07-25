// =====================================================================
// PREI | ContentPackService — haftalık rapordan içerik üretimi.
//
// Claude post metinlerini ve karusel planlarını yazar; Gemini (Nano Banana)
// karusel görsellerini üretir. Anahtarlar SUNUCUDA durur — yerel betik
// yalnız sonucu indirir, hiçbir anahtar bilgisayara inmez.
//
// İki anahtar da yoksa akış çökmez: paket üretilemediğini dürüstçe söyler,
// yerel betik yine de raporu ve haber kalemlerini klasöre yazar.
// =====================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import type { ReportSection } from './intel-report';
import {
  CONTENT_SCHEMA, CONTENT_SYSTEM, buildContentPrompt, imagePromptFor,
  packToMarkdown, type ContentPack,
} from './content-pack';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface PackResult {
  ok: boolean;
  message?: string;
  packId?: string;
  pack?: ContentPack;
  markdown?: string;
  reportTitle: string;
  periodLabel: string;
}

export interface CarouselImage {
  carouselIndex: number;
  slideIndex: number;
  /** base64 — yerel betik dosyaya yazar. */
  data: string | null;
  mimeType: string;
  error: string | null;
}

@Injectable()
export class ContentPackService {
  private readonly logger = new Logger(ContentPackService.name);
  private anthropicClient: Anthropic | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private anthropic(): Anthropic | null {
    const { apiKey } = this.config.get('anthropic', { infer: true });
    if (!apiKey) return null;
    if (!this.anthropicClient) this.anthropicClient = new Anthropic({ apiKey });
    return this.anthropicClient;
  }

  private periodLabel(start: string | null, end: string | null, date: string): string {
    if (start && end) return `${start} – ${end}`;
    return end ?? date;
  }

  /** Rapordan post metinleri + karusel planları üretir. */
  async generate(ctx: RequestContext, reportId: string): Promise<PackResult> {
    const report = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        title: string; sections: ReportSection[];
        period_start: string | null; period_end: string | null; report_date: string;
      }>(
        `SELECT title, sections, period_start::text, period_end::text, report_date::text
           FROM intel_reports WHERE id = $1 AND deleted_at IS NULL`,
        [reportId],
      );
      if (rows.length === 0) throw new NotFoundException('Rapor bulunamadı');
      return rows[0];
    });

    const periodLabel = this.periodLabel(
      report.period_start, report.period_end, report.report_date);
    const sections = Array.isArray(report.sections) ? report.sections : [];

    const client = this.anthropic();
    if (!client) {
      return {
        ok: false,
        message: 'ANTHROPIC_API_KEY tanımlı değil — post metinleri üretilemedi.',
        reportTitle: report.title, periodLabel,
      };
    }
    const { model } = this.config.get('anthropic', { infer: true });

    let pack: ContentPack;
    try {
      // Opus 5: temperature/top_p GÖNDERİLMEZ (400 döner).
      const res = await client.messages.create({
        model,
        max_tokens: 16000,
        system: CONTENT_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: CONTENT_SCHEMA } },
        messages: [{
          role: 'user',
          content: buildContentPrompt(report.title, periodLabel, sections),
        }],
      });
      if (res.stop_reason === 'refusal') {
        return { ok: false, message: 'Model isteği reddetti.', reportTitle: report.title, periodLabel };
      }
      const text = res.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') {
        return { ok: false, message: 'Model metin döndürmedi.', reportTitle: report.title, periodLabel };
      }
      pack = JSON.parse(text.text) as ContentPack;
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`İçerik paketi üretilemedi (${reportId}): ${message}`);
      return { ok: false, message, reportTitle: report.title, periodLabel };
    }

    const packId = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO intel_content_packs
           (tenant_id, report_id, pack, model, post_count, carousel_count, created_by)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7) RETURNING id`,
        [ctx.tenantId, reportId, JSON.stringify(pack), model,
         pack.posts?.length ?? 0, pack.carousels?.length ?? 0, ctx.userId],
      );
      return rows[0].id;
    });

    this.logger.log(
      `İçerik paketi üretildi: ${pack.posts?.length ?? 0} post, ` +
      `${pack.carousels?.length ?? 0} karusel, ${pack.skipped?.length ?? 0} atlanan`,
    );

    return {
      ok: true, packId, pack,
      markdown: packToMarkdown(pack, report.title, periodLabel),
      reportTitle: report.title, periodLabel,
    };
  }

  /** Kayıtlı paketi döndürür (yerel betik tekrar üretmesin). */
  async latestPack(ctx: RequestContext, reportId: string): Promise<PackResult> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; pack: ContentPack; title: string;
        period_start: string | null; period_end: string | null; report_date: string;
      }>(
        `SELECT p.id, p.pack, r.title, r.period_start::text, r.period_end::text, r.report_date::text
           FROM intel_content_packs p JOIN intel_reports r ON r.id = p.report_id
          WHERE p.report_id = $1 ORDER BY p.created_at DESC LIMIT 1`,
        [reportId],
      );
      if (rows.length === 0) throw new NotFoundException('Bu rapor için içerik paketi yok');
      const r = rows[0];
      const periodLabel = this.periodLabel(r.period_start, r.period_end, r.report_date);
      return {
        ok: true, packId: r.id, pack: r.pack,
        markdown: packToMarkdown(r.pack, r.title, periodLabel),
        reportTitle: r.title, periodLabel,
      };
    });
  }

  /**
   * Karusel görselleri — Nano Banana (Gemini image generation).
   * Üretilenler saklanır; aynı slayt için tekrar istenirse yeniden
   * üretilmez (kota boşa gitmesin).
   */
  async carouselImages(
    ctx: RequestContext, packId: string, force = false,
  ): Promise<{ ok: boolean; message?: string; images: CarouselImage[] }> {
    const { apiKey, imageModel } = this.config.get('google', { infer: true });

    const pack = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ pack: ContentPack }>(
        `SELECT pack FROM intel_content_packs WHERE id = $1`, [packId]);
      if (rows.length === 0) throw new NotFoundException('İçerik paketi bulunamadı');
      return rows[0].pack;
    });

    const carousels = pack.carousels ?? [];
    if (carousels.length === 0) {
      return { ok: true, message: 'Bu pakette karusel yok.', images: [] };
    }

    // Zaten üretilmiş olanları getir.
    const existing = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        carousel_index: number; slide_index: number;
        image_data: Buffer | null; mime_type: string; error: string | null;
      }>(
        `SELECT carousel_index, slide_index, image_data, mime_type, error
           FROM intel_carousel_images WHERE pack_id = $1`, [packId]);
      return new Map(rows.map((r) => [`${r.carousel_index}-${r.slide_index}`, r]));
    });

    if (!apiKey) {
      // Anahtar yok: planları döndür, hangisinin üretilemediğini söyle.
      const images: CarouselImage[] = [];
      for (const [ci, c] of carousels.entries()) {
        for (const s of c.slides) {
          images.push({
            carouselIndex: ci + 1, slideIndex: s.index, data: null,
            mimeType: 'image/png',
            error: 'GOOGLE_AI_API_KEY tanımlı değil — görsel üretilemedi.',
          });
        }
      }
      return {
        ok: false,
        message: 'GOOGLE_AI_API_KEY tanımlı değil. Slayt metinleri hazır; görseller anahtar gelince üretilir.',
        images,
      };
    }

    const images: CarouselImage[] = [];
    for (const [ci, carousel] of carousels.entries()) {
      const carouselIndex = ci + 1;
      for (const slide of carousel.slides) {
        const key = `${carouselIndex}-${slide.index}`;
        const prev = existing.get(key);
        if (!force && prev?.image_data) {
          images.push({
            carouselIndex, slideIndex: slide.index,
            data: prev.image_data.toString('base64'),
            mimeType: prev.mime_type, error: null,
          });
          continue;
        }

        const prompt = imagePromptFor(slide, carousel.marketCode);
        const result = await this.generateImage(apiKey, imageModel, prompt);

        await this.db.withContext(ctx, (c) =>
          c.query(
            `INSERT INTO intel_carousel_images
               (tenant_id, pack_id, carousel_index, slide_index, prompt,
                mime_type, image_data, error, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (pack_id, carousel_index, slide_index) DO UPDATE SET
               prompt = EXCLUDED.prompt, mime_type = EXCLUDED.mime_type,
               image_data = EXCLUDED.image_data, error = EXCLUDED.error`,
            [ctx.tenantId, packId, carouselIndex, slide.index, prompt,
             result.mimeType, result.data ? Buffer.from(result.data, 'base64') : null,
             result.error, ctx.userId],
          ),
        );

        images.push({
          carouselIndex, slideIndex: slide.index,
          data: result.data, mimeType: result.mimeType, error: result.error,
        });
      }
    }

    const failed = images.filter((i) => i.error).length;
    this.logger.log(
      `Karusel görselleri: ${images.length - failed}/${images.length} üretildi`);
    return {
      ok: failed === 0,
      message: failed > 0 ? `${failed} görsel üretilemedi.` : undefined,
      images,
    };
  }

  /** Tek görsel üretimi (Gemini image generation / "Nano Banana"). */
  private async generateImage(
    apiKey: string, model: string, prompt: string,
  ): Promise<{ data: string | null; mimeType: string; error: string | null }> {
    try {
      const res = await fetch(
        `${GEMINI}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
        },
      );
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
        error?: { message?: string };
      };
      if (!res.ok || json.error) {
        return { data: null, mimeType: 'image/png', error: json.error?.message ?? `HTTP ${res.status}` };
      }
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) {
        return { data: null, mimeType: 'image/png', error: 'Model görsel döndürmedi.' };
      }
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? 'image/png',
        error: null,
      };
    } catch (e) {
      return { data: null, mimeType: 'image/png', error: (e as Error).message };
    }
  }
}
