// =====================================================================
// PREI | PublishingPlanService — haftalık yayın akışı.
//
// Akış: rapor → Claude planı yazar (4 LinkedIn postu + 2-3 karusel) →
// günlere dağıtılır → LinkedIn dosyaları Google Drive'a yüklenir →
// karusel görselleri Nano Banana ile üretilir → Onur haftalık kontrol
// eder ve ELLE paylaşır.
//
// Sistem HİÇBİR ŞEY YAYINLAMAZ. Ne LinkedIn'e (ban riski), ne Meta'ya
// (izin yok + Onur elle paylaşmayı seçti). Yalnız hazırlar ve planlar.
// =====================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import type { ReportSection } from './intel-report';
import { buildContentPrompt } from './content-pack';
import { DriveService, type DriveFile } from './drive.service';
import { GeminiImageService } from './gemini-image.service';
import {
  PLAN_SCHEMA, PLAN_SYSTEM, calendarRows, clampCounts, distributeWeek,
  postToTextFile, weekOverview, weekStart, addDays, type PlanSlot,
} from './publishing-plan';

/**
 * Drive bağlı değilken verilen tek mesaj. Sebep neredeyse her zaman aynı:
 * drive.file kapsamı uygulamaya SONRADAN eklendi, mevcut Google oturumu
 * onu taşımıyor. Yeniden bağlanmaktan başka çözümü yok.
 */
const DRIVE_NOT_CONNECTED =
  'Google Drive bağlı değil. PREI > Ayarlar > Google hesabını YENİDEN bağlayın — ' +
  'Drive izni sonradan eklendi, mevcut oturum onu taşımıyor. Klasör o hesapta açılır.';

interface PlanPost {
  title: string; hook: string; body: string; hashtags: string[];
  marketCode: string | null; sourceSection: string; instagramCaption: string;
}
interface PlanCarousel {
  title: string; caption: string; hashtags: string[];
  marketCode: string | null; sourceSection: string;
  slides: Array<{ index: number; headline: string; body: string; imagePrompt: string }>;
}
interface PlanOutput {
  linkedinPosts: PlanPost[];
  carousels: PlanCarousel[];
  skipped: Array<{ topic: string; reason: string }>;
}

export interface PlanItem {
  id: string;
  scheduledDate: string;
  dayName: string;
  kind: 'post' | 'carousel';
  orderIndex: number;
  forLinkedin: boolean;
  forMeta: boolean;
  title: string;
  hook: string | null;
  body: string | null;
  instagramCaption: string | null;
  hashtags: string[];
  marketCode: string | null;
  sourceSection: string | null;
  slides: PlanCarousel['slides'];
  driveFileLink: string | null;
  status: 'ready' | 'published' | 'skipped';
  publishedAt: string | null;
  /** Karusel görselleri hazır mı (kaç slayt / kaç görsel). */
  imageCount?: number;
}

export interface PublishingPlan {
  id: string;
  reportId: string | null;
  weekStart: string;
  weekEnd: string;
  status: string;
  driveFolderLink: string | null;
  skipped: Array<{ topic: string; reason: string }>;
  items: PlanItem[];
  createdAt: string;
}

export interface GenerateResult {
  ok: boolean;
  message?: string;
  plan?: PublishingPlan;
  /** Drive yüklemesinin ayrı durumu — plan üretilse de Drive başarısız olabilir. */
  drive?: { ok: boolean; message?: string; folderLink?: string };
  /** Görsel üretiminin ayrı durumu. */
  images?: { ok: boolean; message?: string; generated: number; total: number };
}

@Injectable()
export class PublishingPlanService {
  private readonly logger = new Logger(PublishingPlanService.name);
  private client: Anthropic | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly drive: DriveService,
    private readonly images: GeminiImageService,
  ) {}

  private anthropic(): Anthropic | null {
    const { apiKey } = this.config.get('anthropic', { infer: true });
    if (!apiKey) return null;
    if (!this.client) this.client = new Anthropic({ apiKey });
    return this.client;
  }

  /**
   * Planı yazdırır. Önce Claude (tercih edilen), yoksa OpenAI.
   *
   * Neden yedek: Anthropic anahtarı gelene kadar haftalık akışın komple
   * durmasının anlamı yok — OpenAI anahtarı zaten sunucuda ve Eylül onu
   * kullanıyor. Hangi modelin yazdığı plan kaydında saklanır.
   */
  private async writePlan(
    prompt: string,
  ): Promise<{ ok: true; plan: PlanOutput; model: string } | { ok: false; message: string }> {
    const client = this.anthropic();
    if (client) {
      const { model } = this.config.get('anthropic', { infer: true });
      try {
        // Opus 5: temperature/top_p GÖNDERİLMEZ (400 döner).
        const res = await client.messages.create({
          model,
          max_tokens: 20000,
          system: PLAN_SYSTEM,
          output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
          messages: [{ role: 'user', content: prompt }],
        });
        if (res.stop_reason === 'refusal') {
          return { ok: false, message: 'Model isteği reddetti.' };
        }
        const text = res.content.find((b) => b.type === 'text');
        if (!text || text.type !== 'text') {
          return { ok: false, message: 'Model metin döndürmedi.' };
        }
        return { ok: true, plan: JSON.parse(text.text) as PlanOutput, model };
      } catch (e) {
        const message = (e as Error).message;
        this.logger.error(`Claude ile plan üretilemedi: ${message}`);
        return { ok: false, message };
      }
    }

    const openai = this.config.get('openai', { infer: true });
    if (!openai.apiKey) {
      return {
        ok: false,
        message: 'ANTHROPIC_API_KEY (veya OPENAI_API_KEY) tanımlı değil — ' +
                 'yayın akışı üretilemedi.',
      };
    }

    this.logger.warn('ANTHROPIC_API_KEY yok — plan OpenAI ile yazılıyor.');
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openai.apiKey}`,
        },
        body: JSON.stringify({
          model: openai.chatModel,
          messages: [
            { role: 'system', content: PLAN_SYSTEM },
            { role: 'user', content: prompt },
          ],
          // strict:true minItems/maxItems'i REDDEDER (400). Sayı kısıtı
          // zaten aşağıda kodla uygulanıyor, şema yönlendirme olarak kalıyor.
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'yayin_akisi', strict: false, schema: PLAN_SCHEMA },
          },
        }),
      });
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        error?: { message?: string };
      };
      if (!res.ok || json.error) {
        return { ok: false, message: json.error?.message ?? `OpenAI HTTP ${res.status}` };
      }
      const content = json.choices?.[0]?.message?.content;
      if (!content) return { ok: false, message: 'OpenAI metin döndürmedi.' };
      return { ok: true, plan: JSON.parse(content) as PlanOutput, model: openai.chatModel };
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`OpenAI ile plan üretilemedi: ${message}`);
      return { ok: false, message };
    }
  }

  /**
   * Rapordan haftalık yayın akışı üretir.
   *
   * Yayın haftası: rapor bitiş tarihinin ERTESİ pazartesi. Rapor 24 Temmuz
   * (Cuma) biterse yayın 27 Temmuz Pazartesi başlar — geçmişe post
   * planlamayız.
   */
  async generate(
    ctx: RequestContext, reportId: string, opts: { weekStart?: string; uploadDrive?: boolean; generateImages?: boolean } = {},
  ): Promise<GenerateResult> {
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

    const anchor = report.period_end ?? report.report_date;
    // Rapor haftasının pazartesisi + 7 → ERTESİ hafta.
    const monday = opts.weekStart ?? addDays(weekStart(anchor), 7);
    const sunday = addDays(monday, 6);
    const weekLabel = `${monday} — ${sunday}`;
    const sections = Array.isArray(report.sections) ? report.sections : [];

    const prompt =
      `${buildContentPrompt(report.title, weekLabel, sections)}\n\n` +
      `Yayın haftası: ${weekLabel}. Bu hafta için yayın akışını kur.`;

    const written = await this.writePlan(prompt);
    if (!written.ok) return { ok: false, message: written.message };
    const model = written.model;

    // Sağlayıcı şemadaki sayı kısıtına uymayabilir → burada oturt.
    const capped = clampCounts(written.plan.linkedinPosts, written.plan.carousels);
    if (capped.trimmed > 0) {
      this.logger.warn(`Model fazla içerik üretti, ${capped.trimmed} kalem kırpıldı.`);
    }
    const out: PlanOutput = {
      linkedinPosts: capped.posts,
      carousels: capped.carousels,
      skipped: Array.isArray(written.plan.skipped) ? written.plan.skipped : [],
    };
    if (out.linkedinPosts.length === 0 && out.carousels.length === 0) {
      return { ok: false, message: 'Model bu rapordan paylaşılabilir içerik çıkaramadı.' };
    }

    const slots = distributeWeek(monday, out.linkedinPosts.length, out.carousels.length);

    // Planı yaz. Aynı hafta varsa ÜZERİNE YAZ (yeniden üretim desteklenir).
    const planId = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO publishing_plans
           (tenant_id, report_id, week_start, week_end, status, model, skipped, created_by, updated_by)
         VALUES ($1,$2,$3,$4,'ready',$5,$6::jsonb,$7,$7)
         ON CONFLICT (tenant_id, week_start) DO UPDATE SET
           report_id = EXCLUDED.report_id, status = 'ready', model = EXCLUDED.model,
           skipped = EXCLUDED.skipped, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING id`,
        [ctx.tenantId, reportId, monday, sunday, model,
         JSON.stringify(out.skipped ?? []), ctx.userId],
      );
      const id = rows[0].id;
      // Yeniden üretimde eski kalemleri temizle (görseller CASCADE ile gider).
      await c.query(`DELETE FROM publishing_plan_items WHERE plan_id = $1`, [id]);

      for (const slot of slots) {
        if (slot.kind === 'post') {
          const p = out.linkedinPosts[slot.order - 1];
          if (!p) continue;
          await c.query(
            `INSERT INTO publishing_plan_items
               (tenant_id, plan_id, scheduled_date, day_name, kind, order_index,
                for_linkedin, for_meta, title, hook, body, instagram_caption,
                hashtags, market_code, source_section, created_by, updated_by)
             VALUES ($1,$2,$3,$4,'post',$5,true,true,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
            [ctx.tenantId, id, slot.date, slot.dayName, slot.order,
             p.title, p.hook, p.body, p.instagramCaption,
             p.hashtags ?? [], p.marketCode, p.sourceSection, ctx.userId],
          );
        } else {
          const cr = out.carousels[slot.order - 1];
          if (!cr) continue;
          await c.query(
            `INSERT INTO publishing_plan_items
               (tenant_id, plan_id, scheduled_date, day_name, kind, order_index,
                for_linkedin, for_meta, title, instagram_caption, hashtags,
                market_code, source_section, slides, created_by, updated_by)
             VALUES ($1,$2,$3,$4,'carousel',$5,false,true,$6,$7,$8,$9,$10,$11::jsonb,$12,$12)`,
            [ctx.tenantId, id, slot.date, slot.dayName, slot.order,
             cr.title, cr.caption, cr.hashtags ?? [], cr.marketCode,
             cr.sourceSection, JSON.stringify(cr.slides ?? []), ctx.userId],
          );
        }
      }
      return id;
    });

    this.logger.log(
      `Yayın akışı kuruldu (${weekLabel}): ${out.linkedinPosts.length} post, ` +
      `${out.carousels.length} karusel, ${out.skipped?.length ?? 0} atlanan`,
    );

    // Önce görseller — Drive klasörüne onlar da gitsin.
    let imageResult: GenerateResult['images'];
    if (opts.generateImages !== false) {
      imageResult = await this.buildImages(ctx, planId);
    }

    let driveResult: GenerateResult['drive'];
    if (opts.uploadDrive !== false) {
      driveResult = await this.pushToDrive(ctx, planId, report.title, weekLabel);
      // Takvim yalnız klasör yazıldıysa anlamlı.
      if (driveResult.ok) await this.syncCalendar(ctx);
    }

    return {
      ok: true,
      plan: await this.get(ctx, planId),
      drive: driveResult,
      images: imageResult,
    };
  }

  /** LinkedIn dosyalarını + hafta özetini Drive'a yükler. */
  async pushToDrive(
    ctx: RequestContext, planId: string, reportTitle: string, weekLabel: string,
  ): Promise<{ ok: boolean; message?: string; folderLink?: string }> {
    const plan = await this.get(ctx, planId);
    const posts = plan.items.filter((i) => i.kind === 'post');
    const carousels = plan.items.filter((i) => i.kind === 'carousel');

    const files: DriveFile[] = [];

    // Hafta özeti — tek bakışta akış.
    files.push({
      name: '00 - Hafta Ozeti.md',
      mimeType: 'text/markdown',
      content: weekOverview(
        weekLabel, reportTitle,
        plan.items.map((i) => ({
          dayIndex: 0, dayName: i.dayName, date: i.scheduledDate,
          kind: i.kind, order: i.orderIndex,
          linkedin: i.forLinkedin, meta: i.forMeta,
        })) as PlanSlot[],
        posts.map((p) => p.title), carousels.map((c) => c.title),
        plan.skipped,
      ),
    });

    // LinkedIn postları — her biri ayrı dosya, gün adıyla.
    for (const p of posts) {
      files.push({
        name: `${p.scheduledDate} ${p.dayName} - LinkedIn ${p.orderIndex}.txt`,
        mimeType: 'text/plain',
        content: postToTextFile(
          {
            title: p.title, hook: p.hook ?? '', body: p.body ?? '',
            hashtags: p.hashtags, marketCode: p.marketCode,
            sourceSection: p.sourceSection ?? '',
          },
          { dayName: p.dayName, date: p.scheduledDate },
        ),
      });
    }

    // Meta içeriği (Instagram metinleri) — tek dosyada, günlere göre.
    const metaLines: string[] = ['# Meta (Instagram/Facebook) — günlük metinler', ''];
    for (const i of plan.items) {
      metaLines.push(`## ${i.dayName} · ${i.scheduledDate} — ${i.title}`);
      metaLines.push('');
      metaLines.push(i.instagramCaption ?? '(metin yok)');
      metaLines.push('');
      if (i.hashtags.length > 0) {
        metaLines.push(i.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' '));
        metaLines.push('');
      }
      if (i.kind === 'carousel' && i.slides.length > 0) {
        metaLines.push('Slaytlar:');
        for (const s of i.slides) metaLines.push(`  ${s.index}. ${s.headline} — ${s.body}`);
        metaLines.push('');
      }
      metaLines.push('---');
      metaLines.push('');
    }
    files.push({ name: '01 - Meta Gunluk Metinler.md', mimeType: 'text/markdown', content: metaLines.join('\n') });

    // Karusel görselleri — slayt sırasıyla, Meta'ya yüklenecek hâlde.
    if (carousels.length > 0) {
      const stored = await this.images.stored(ctx, carousels.map((c) => c.id));
      for (const img of stored) {
        if (!img.data) continue;
        const owner = carousels.find((c) => c.id === img.itemId);
        if (!owner) continue;
        const ext = (img.mimeType || 'image/png').split('/')[1] || 'png';
        files.push({
          name: `${owner.scheduledDate} karusel${owner.orderIndex}-slayt${img.slideIndex}.${ext}`,
          mimeType: img.mimeType || 'image/png',
          data: Buffer.from(img.data, 'base64'),
        });
      }
    }

    // Drive kullanıcıya bağlıdır ama akışı yerel betik (agent anahtarı)
    // tetikliyor — oturum yok. Bu yüzden Drive iznini vermiş kullanıcıyı
    // buluyoruz; klasör onun Drive'ında yaşıyor.
    const owner = await this.drive.resolveOwner();
    if (!owner) {
      return { ok: false, message: DRIVE_NOT_CONNECTED };
    }

    const res = await this.drive.uploadWeek(owner.userId, weekLabel, files);
    if (res.folderId) {
      await this.db.withContext(ctx, (c) =>
        c.query(
          `UPDATE publishing_plans SET drive_folder_id = $2, drive_folder_link = $3,
                  updated_by = $4 WHERE id = $1`,
          [planId, res.folderId, res.folderLink, ctx.userId],
        ),
      );
      // Post dosyalarının bağlantılarını kalemlere işle.
      for (const f of res.files) {
        const m = f.name.match(/LinkedIn (\d+)\.txt$/);
        if (!m || !f.id) continue;
        await this.db.withContext(ctx, (c) =>
          c.query(
            `UPDATE publishing_plan_items SET drive_file_id = $3, drive_file_link = $4
              WHERE plan_id = $1 AND kind = 'post' AND order_index = $2`,
            [planId, Number(m[1]), f.id, f.link],
          ),
        );
      }
    }
    return { ok: res.ok, message: res.message, folderLink: res.folderLink };
  }

  /** Drive kökündeki içerik takvimini tüm haftalardan yeniden yazar. */
  async syncCalendar(ctx: RequestContext): Promise<{ ok: boolean; message?: string; link?: string }> {
    const owner = await this.drive.resolveOwner();
    if (!owner) return { ok: false, message: DRIVE_NOT_CONNECTED };

    const plans = await this.list(ctx, 52);
    const rows = calendarRows(
      plans.flatMap((p) => p.items.map((i) => ({
        scheduledDate: i.scheduledDate, dayName: i.dayName, kind: i.kind,
        title: i.title, marketCode: i.marketCode, forLinkedin: i.forLinkedin,
        forMeta: i.forMeta, status: i.status, slideCount: i.slides.length,
        driveFileLink: i.driveFileLink,
      }))),
    );
    return this.drive.writeCalendar(owner.userId, rows);
  }

  /** Karusel slaytlarının görsellerini üretir. */
  async buildImages(
    ctx: RequestContext, planId: string,
  ): Promise<{ ok: boolean; message?: string; generated: number; total: number }> {
    const plan = await this.get(ctx, planId);
    const carousels = plan.items.filter((i) => i.kind === 'carousel');
    const total = carousels.reduce((s, c) => s + c.slides.length, 0);
    if (total === 0) return { ok: true, generated: 0, total: 0 };

    const res = await this.images.generateForItems(
      ctx,
      carousels.map((c) => ({
        itemId: c.id, marketCode: c.marketCode, slides: c.slides,
      })),
    );
    return { ok: res.ok, message: res.message, generated: res.generated, total };
  }

  /** Planı kalemleriyle döndürür. */
  async get(ctx: RequestContext, planId: string): Promise<PublishingPlan> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; report_id: string | null; week_start: string; week_end: string;
        status: string; drive_folder_link: string | null;
        skipped: Array<{ topic: string; reason: string }>; created_at: string;
      }>(
        `SELECT id, report_id, week_start::text, week_end::text, status,
                drive_folder_link, skipped, created_at::text
           FROM publishing_plans WHERE id = $1 AND deleted_at IS NULL`,
        [planId],
      );
      const p = rows[0];
      if (!p) throw new NotFoundException('Yayın akışı bulunamadı');

      const { rows: items } = await c.query<{
        id: string; scheduled_date: string; day_name: string; kind: 'post' | 'carousel';
        order_index: number; for_linkedin: boolean; for_meta: boolean;
        title: string; hook: string | null; body: string | null;
        instagram_caption: string | null; hashtags: string[];
        market_code: string | null; source_section: string | null;
        slides: PlanCarousel['slides']; drive_file_link: string | null;
        status: 'ready' | 'published' | 'skipped'; published_at: string | null;
        image_count: string;
      }>(
        `SELECT i.id, i.scheduled_date::text, i.day_name, i.kind, i.order_index,
                i.for_linkedin, i.for_meta, i.title, i.hook, i.body,
                i.instagram_caption, i.hashtags, i.market_code, i.source_section,
                i.slides, i.drive_file_link, i.status, i.published_at::text,
                (SELECT count(*) FROM intel_carousel_images img
                  WHERE img.plan_item_id = i.id AND img.image_data IS NOT NULL)::text AS image_count
           FROM publishing_plan_items i
          WHERE i.plan_id = $1 ORDER BY i.scheduled_date, i.order_index`,
        [planId],
      );

      return {
        id: p.id, reportId: p.report_id,
        weekStart: p.week_start, weekEnd: p.week_end, status: p.status,
        driveFolderLink: p.drive_folder_link,
        skipped: Array.isArray(p.skipped) ? p.skipped : [],
        createdAt: p.created_at,
        items: items.map((i) => ({
          id: i.id, scheduledDate: i.scheduled_date, dayName: i.day_name,
          kind: i.kind, orderIndex: i.order_index,
          forLinkedin: i.for_linkedin, forMeta: i.for_meta,
          title: i.title, hook: i.hook, body: i.body,
          instagramCaption: i.instagram_caption, hashtags: i.hashtags ?? [],
          marketCode: i.market_code, sourceSection: i.source_section,
          slides: Array.isArray(i.slides) ? i.slides : [],
          driveFileLink: i.drive_file_link, status: i.status,
          publishedAt: i.published_at, imageCount: Number(i.image_count),
        })),
      };
    });
  }

  /** Haftalık planları listeler (en yeniden eskiye). */
  async list(ctx: RequestContext, limit = 12): Promise<PublishingPlan[]> {
    const ids = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `SELECT id FROM publishing_plans WHERE deleted_at IS NULL
          ORDER BY week_start DESC LIMIT $1`,
        [Math.min(Math.max(limit, 1), 52)],
      );
      return rows.map((r) => r.id);
    });
    return Promise.all(ids.map((id) => this.get(ctx, id)));
  }

  /** Bugünün kalemleri — "bugün ne paylaşacağım". */
  async today(ctx: RequestContext): Promise<PlanItem[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ plan_id: string }>(
        `SELECT DISTINCT plan_id FROM publishing_plan_items
          WHERE scheduled_date = CURRENT_DATE`,
      );
      if (rows.length === 0) return [];
      const plans = await Promise.all(rows.map((r) => this.get(ctx, r.plan_id)));
      return plans.flatMap((p) => p.items)
        .filter((i) => i.scheduledDate === new Date().toISOString().slice(0, 10));
    });
  }

  /** "Paylaştım" / "atladım" işaretleme — sistem yayınlamaz, Onur işaretler. */
  async markItem(
    ctx: RequestContext, itemId: string, status: 'ready' | 'published' | 'skipped',
  ): Promise<{ ok: true }> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE publishing_plan_items
            SET status = $2,
                published_at = CASE WHEN $2 = 'published' THEN now() ELSE NULL END,
                updated_by = $3
          WHERE id = $1`,
        [itemId, status, ctx.userId],
      );
      if (!rowCount) throw new NotFoundException('Plan kalemi bulunamadı');
      return { ok: true };
    });
  }
}
