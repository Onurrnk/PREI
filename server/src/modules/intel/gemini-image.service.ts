// =====================================================================
// PREI | GeminiImageService — karusel görselleri (Nano Banana).
//
// Görseller sunucuda saklanır; aynı slayt tekrar istenirse yeniden
// üretilmez (kota boşa gitmesin). Anahtar yoksa akış çökmez: hangi
// slaytın neden üretilemediği kaydedilir ve dürüstçe bildirilir.
// =====================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import { imagePromptFor } from './content-pack';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface SlideSpec {
  index: number;
  headline: string;
  body: string;
  imagePrompt: string;
}

export interface ItemSlides {
  itemId: string;
  marketCode: string | null;
  slides: SlideSpec[];
}

export interface ImageResult {
  itemId: string;
  slideIndex: number;
  /** base64 — indirilecek. */
  data: string | null;
  mimeType: string;
  error: string | null;
}

@Injectable()
export class GeminiImageService {
  private readonly logger = new Logger(GeminiImageService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Plan kalemlerinin slaytları için görsel üretir. */
  async generateForItems(
    ctx: RequestContext, items: ItemSlides[], force = false,
  ): Promise<{ ok: boolean; message?: string; generated: number; images: ImageResult[] }> {
    const { apiKey, imageModel } = this.config.get('google', { infer: true });
    const images: ImageResult[] = [];

    if (!apiKey) {
      for (const it of items) {
        for (const s of it.slides) {
          images.push({
            itemId: it.itemId, slideIndex: s.index, data: null, mimeType: 'image/png',
            error: 'GOOGLE_AI_API_KEY tanımlı değil.',
          });
        }
      }
      return {
        ok: false,
        message: 'GOOGLE_AI_API_KEY tanımlı değil. Slayt metinleri hazır; ' +
                 'görseller anahtar gelince üretilir.',
        generated: 0, images,
      };
    }

    // Zaten üretilmiş olanları getir (kalem bazında).
    const done = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        plan_item_id: string; slide_index: number;
        image_data: Buffer | null; mime_type: string;
      }>(
        `SELECT plan_item_id, slide_index, image_data, mime_type
           FROM intel_carousel_images
          WHERE plan_item_id = ANY($1::uuid[]) AND image_data IS NOT NULL`,
        [items.map((i) => i.itemId)],
      );
      return new Map(rows.map((r) => [`${r.plan_item_id}-${r.slide_index}`, r]));
    });

    let generated = 0;
    for (const it of items) {
      for (const slide of it.slides) {
        const key = `${it.itemId}-${slide.index}`;
        const prev = done.get(key);
        if (!force && prev?.image_data) {
          images.push({
            itemId: it.itemId, slideIndex: slide.index,
            data: prev.image_data.toString('base64'),
            mimeType: prev.mime_type, error: null,
          });
          continue;
        }

        const prompt = imagePromptFor(slide, it.marketCode);
        const res = await this.generateOne(apiKey, imageModel, prompt);
        if (res.data) generated++;

        await this.db.withContext(ctx, (c) =>
          c.query(
            `INSERT INTO intel_carousel_images
               (tenant_id, plan_item_id, carousel_index, slide_index, prompt,
                mime_type, image_data, error, created_by)
             VALUES ($1,$2,0,$3,$4,$5,$6,$7,$8)`,
            [ctx.tenantId, it.itemId, slide.index, prompt, res.mimeType,
             res.data ? Buffer.from(res.data, 'base64') : null, res.error, ctx.userId],
          ),
        ).catch((e) => this.logger.warn(`Görsel kaydedilemedi: ${(e as Error).message}`));

        images.push({
          itemId: it.itemId, slideIndex: slide.index,
          data: res.data, mimeType: res.mimeType, error: res.error,
        });
      }
    }

    const failed = images.filter((i) => i.error).length;
    this.logger.log(`Karusel görselleri: ${images.length - failed}/${images.length}`);
    return {
      ok: failed === 0,
      message: failed > 0 ? `${failed} görsel üretilemedi.` : undefined,
      generated, images,
    };
  }

  /** Kayıtlı görselleri döndürür (yeniden üretmeden). */
  async stored(ctx: RequestContext, itemIds: string[]): Promise<ImageResult[]> {
    if (itemIds.length === 0) return [];
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        plan_item_id: string; slide_index: number;
        image_data: Buffer | null; mime_type: string; error: string | null;
      }>(
        `SELECT plan_item_id, slide_index, image_data, mime_type, error
           FROM intel_carousel_images
          WHERE plan_item_id = ANY($1::uuid[])
          ORDER BY plan_item_id, slide_index`,
        [itemIds],
      );
      return rows.map((r) => ({
        itemId: r.plan_item_id, slideIndex: r.slide_index,
        data: r.image_data ? r.image_data.toString('base64') : null,
        mimeType: r.mime_type, error: r.error,
      }));
    });
  }

  private async generateOne(
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
