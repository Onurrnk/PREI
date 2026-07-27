// =====================================================================
// PREI | AdProposalsService — reklam öneri kuyruğu ve ONAY KAPISI.
//
// Onur'un kuralı: "Reklam maliyetleri ve ödemeler gibi kararlar kullanıcı
// onayı olmadan ASLA yapılmayacak."
//
// Bu servis o kuralı ÜÇ katmanda uygular:
//   1) Uygulama: publish() onaysız satırda çalışmaz, hata fırlatır.
//   2) Meta: kampanya/ad set/reklam DAİMA status=PAUSED yaratılır.
//      Yayına alma (ACTIVE) AYRI bir çağrı ve AYRI bir onay ister.
//   3) Veritabanı: 002y tetikleyicisi onaysız yayını ve onay-sonrası bütçe
//      değişikliğini reddeder (kod hatası bile geçemez).
// =====================================================================
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import { friendlyAiError } from '../../common/ai-error';

const GRAPH = 'https://graph.facebook.com';

export interface AdProposal {
  id: string;
  title: string;
  objective: string;
  marketCode: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  callToAction: string | null;
  creativeBrief: string | null;
  rationale: string | null;
  dailyBudget: number | null;
  currency: string;
  status: string;
  publishState: string;
  source: string;
  approvedAt: string | null;
  activatedAt: string | null;
  publishedAt: string | null;
  metaCampaignId: string | null;
  createdAt: string;
}

const SELECT_COLS = `
  id, title, objective, market_code, primary_text, headline, description,
  call_to_action, creative_brief, rationale, daily_budget, currency, status,
  publish_state, source, approved_at, activated_at, published_at,
  meta_campaign_id, created_at`;

interface Row {
  id: string; title: string; objective: string; market_code: string | null;
  primary_text: string | null; headline: string | null; description: string | null;
  call_to_action: string | null; creative_brief: string | null; rationale: string | null;
  daily_budget: string | null; currency: string; status: string; publish_state: string;
  source: string; approved_at: string | null; activated_at: string | null;
  published_at: string | null; meta_campaign_id: string | null; created_at: string;
}

const toProposal = (r: Row): AdProposal => ({
  id: r.id, title: r.title, objective: r.objective, marketCode: r.market_code,
  primaryText: r.primary_text, headline: r.headline, description: r.description,
  callToAction: r.call_to_action, creativeBrief: r.creative_brief, rationale: r.rationale,
  dailyBudget: r.daily_budget != null ? Number(r.daily_budget) : null,
  currency: r.currency, status: r.status, publishState: r.publish_state, source: r.source,
  approvedAt: r.approved_at, activatedAt: r.activated_at, publishedAt: r.published_at,
  metaCampaignId: r.meta_campaign_id, createdAt: r.created_at,
});

@Injectable()
export class AdProposalsService {
  private readonly logger = new Logger(AdProposalsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async list(ctx: RequestContext, status?: string): Promise<AdProposal[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Row>(
        `SELECT ${SELECT_COLS} FROM ad_proposals
          WHERE deleted_at IS NULL AND ($1::text IS NULL OR status = $1)
          ORDER BY created_at DESC LIMIT 200`,
        [status ?? null],
      );
      return rows.map(toProposal);
    });
  }

  private async byId(ctx: RequestContext, id: string): Promise<AdProposal> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Row>(
        `SELECT ${SELECT_COLS} FROM ad_proposals WHERE id = $1 AND deleted_at IS NULL`, [id]);
      if (rows.length === 0) throw new NotFoundException('Reklam önerisi bulunamadı');
      return toProposal(rows[0]);
    });
  }

  /**
   * ONAY. Bütçeyi Onur belirler — AI'nin önerisi bağlayıcı değildir.
   * dailyBudget verilirse o yazılır; verilmezse öneri korunur.
   */
  async approve(
    ctx: RequestContext, id: string, input: { dailyBudget?: number; note?: string },
  ): Promise<AdProposal> {
    return this.db.withContext(ctx, async (c) => {
      // Bütçe DEĞİŞİKLİĞİ ve ONAY aynı UPDATE'te olmalı: ayrı yazarsak
      // tetikleyici onayı düşürür (onay sonrası bütçe değişimi kuralı).
      const { rows } = await c.query<Row>(
        `UPDATE ad_proposals SET
           daily_budget = COALESCE($3, daily_budget),
           status = 'approved',
           approved_by = $2, approved_at = now(), updated_by = $2,
           metadata = metadata || jsonb_build_object('approvalNote', $4::text)
         WHERE id = $1 AND deleted_at IS NULL
           AND status IN ('draft','pending','rejected')
         RETURNING ${SELECT_COLS}`,
        [id, ctx.userId, input.dailyBudget ?? null, input.note ?? null],
      );
      if (rows.length === 0) {
        throw new BadRequestException('Öneri bulunamadı veya zaten onaylanmış/yayında.');
      }
      this.logger.log(`Reklam önerisi onaylandı: ${id} (bütçe ${rows[0].daily_budget ?? '-'})`);
      return toProposal(rows[0]);
    });
  }

  async reject(ctx: RequestContext, id: string, note?: string): Promise<AdProposal> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Row>(
        `UPDATE ad_proposals SET status = 'rejected', rejected_by = $2,
           rejected_at = now(), rejection_note = $3, updated_by = $2
         WHERE id = $1 AND deleted_at IS NULL AND published_at IS NULL
         RETURNING ${SELECT_COLS}`,
        [id, ctx.userId, note ?? null],
      );
      if (rows.length === 0) throw new BadRequestException('Öneri bulunamadı veya zaten yayında.');
      return toProposal(rows[0]);
    });
  }

  /**
   * Meta'ya gönderir — DAİMA DURDURULMUŞ (PAUSED) olarak.
   * Bu adım para HARCAMAZ: durdurulmuş kampanya gösterim almaz.
   * Onaysız satırda çalışmaz (hem burada hem tetikleyicide engellenir).
   */
  async publish(ctx: RequestContext, id: string): Promise<{ ok: boolean; message: string; proposal?: AdProposal }> {
    const p = await this.byId(ctx, id);
    if (p.status !== 'approved' || !p.approvedAt) {
      throw new BadRequestException('Onaylanmamış reklam yayına gönderilemez.');
    }
    if (p.publishedAt) {
      throw new BadRequestException('Bu öneri zaten Meta\'ya gönderilmiş.');
    }

    const ads = this.config.get('metaAds', { infer: true });
    if (!ads.accessToken || !ads.accountId) {
      return { ok: false, message: 'Meta reklam hesabı yapılandırılmamış (token/hesap kimliği yok).' };
    }
    const acct = ads.accountId.startsWith('act_') ? ads.accountId : `act_${ads.accountId}`;

    // Kampanya — DURDURULMUŞ. special_ad_categories zorunlu alan.
    let campaignId: string;
    try {
      const res = await fetch(`${GRAPH}/${ads.apiVersion}/${acct}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: p.title,
          objective: p.objective,
          status: 'PAUSED',                 // ← para harcamaz
          special_ad_categories: [],
          access_token: ads.accessToken,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: { message?: string } };
      if (!res.ok || !json.id) {
        const message = json.error?.message ?? `HTTP ${res.status}`;
        this.logger.warn(`Kampanya oluşturulamadı: ${message}`);
        return { ok: false, message };
      }
      campaignId = json.id;
    } catch (e) {
      return { ok: false, message: friendlyAiError(e) };
    }

    const updated = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<Row>(
        `UPDATE ad_proposals SET status = 'published', publish_state = 'paused',
           published_at = now(), meta_campaign_id = $2, updated_by = $3
         WHERE id = $1 RETURNING ${SELECT_COLS}`,
        [id, campaignId, ctx.userId],
      );
      return toProposal(rows[0]);
    });

    this.logger.log(`Reklam Meta'ya DURDURULMUŞ olarak gönderildi: ${id} → ${campaignId}`);
    return {
      ok: true,
      message: 'Kampanya Meta\'da DURDURULMUŞ olarak oluşturuldu. Gösterim almıyor, para harcamıyor. ' +
               'Yayına almak için ayrıca "Yayına al" onayı gerekir.',
      proposal: updated,
    };
  }

  /**
   * YAYINA ALMA — İKİNCİ ONAY. Para bu adımdan sonra harcanmaya başlar,
   * bu yüzden ayrı bir eylem ve ayrı bir denetim kaydı.
   */
  async activate(ctx: RequestContext, id: string): Promise<{ ok: boolean; message: string }> {
    const p = await this.byId(ctx, id);
    if (!p.metaCampaignId || !p.publishedAt) {
      throw new BadRequestException('Önce Meta\'ya gönderilmeli.');
    }
    if (p.publishState === 'active') {
      return { ok: true, message: 'Kampanya zaten yayında.' };
    }
    const ads = this.config.get('metaAds', { infer: true });

    try {
      const res = await fetch(`${GRAPH}/${ads.apiVersion}/${p.metaCampaignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE', access_token: ads.accessToken }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok || json.error) {
        return { ok: false, message: json.error?.message ?? `HTTP ${res.status}` };
      }
    } catch (e) {
      return { ok: false, message: friendlyAiError(e) };
    }

    await this.db.withContext(ctx, (c) =>
      c.query(
        `UPDATE ad_proposals SET publish_state = 'active',
           activated_by = $2, activated_at = now(), updated_by = $2 WHERE id = $1`,
        [id, ctx.userId],
      ),
    );
    this.logger.warn(`Reklam YAYINA ALINDI (harcama başlıyor): ${id} → ${p.metaCampaignId}`);
    return { ok: true, message: 'Kampanya yayına alındı. Harcama başladı.' };
  }

  /** Yayındaki kampanyayı durdurur — her zaman izinli (harcamayı kesmek güvenli). */
  async pause(ctx: RequestContext, id: string): Promise<{ ok: boolean; message: string }> {
    const p = await this.byId(ctx, id);
    if (!p.metaCampaignId) throw new BadRequestException('Meta kampanyası yok.');
    const ads = this.config.get('metaAds', { infer: true });

    try {
      const res = await fetch(`${GRAPH}/${ads.apiVersion}/${p.metaCampaignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAUSED', access_token: ads.accessToken }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok || json.error) return { ok: false, message: json.error?.message ?? `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: friendlyAiError(e) };
    }

    await this.db.withContext(ctx, (c) =>
      c.query(`UPDATE ad_proposals SET publish_state = 'paused', updated_by = $2 WHERE id = $1`,
        [id, ctx.userId]),
    );
    return { ok: true, message: 'Kampanya durduruldu. Harcama kesildi.' };
  }
}
