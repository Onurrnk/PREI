// =====================================================================
// PREI | MarketingBrainService — Claude ile pazarlama analizi ve reklam
// önerisi üretimi.
//
// GÜVENLİK SINIRI: Bu servis HİÇBİR ŞEY YAYINLAMAZ ve HİÇBİR PARA HARCAMAZ.
// Yalnızca 'draft'/'pending' durumunda ad_proposals satırı yazar. Meta'ya
// gönderim ve bütçe kararı ayrı bir serviste, Onur'un açık onayından sonra
// olur (002y tetikleyicisi bunu veritabanı seviyesinde de zorlar).
//
// Çıktı JSON şemasıyla kısıtlanır (output_config.format) — model uydurma
// alan veya eksik alan döndüremez.
// =====================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import { PROPOSAL_SCHEMA, MARKETING_SYSTEM, buildAnalysisPrompt, type BrainOutput, type MarketingSnapshot } from './marketing-brain';

@Injectable()
export class MarketingBrainService {
  private readonly logger = new Logger(MarketingBrainService.name);
  private client: Anthropic | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private anthropic(): Anthropic | null {
    const { apiKey } = this.config.get('anthropic', { infer: true });
    if (!apiKey) return null;
    if (!this.client) this.client = new Anthropic({ apiKey });
    return this.client;
  }

  /**
   * Analiz için gereken tüm gerçek veriyi toplar. Uydurma yok: hangi veri
   * yoksa boş/sıfır gider ve model bunu görür.
   */
  async snapshot(ctx: RequestContext): Promise<MarketingSnapshot> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: acct } = await c.query<{
        platform: string; followers: string; reach: string; profile_views: string;
        accounts_engaged: string; website_clicks: string;
      }>(
        `SELECT platform,
                COALESCE(SUM(followers) FILTER (WHERE metric_date = (SELECT max(metric_date) FROM social_insights)),0) AS followers,
                COALESCE(SUM(reach) FILTER (WHERE metric_date >= current_date - 30),0) AS reach,
                COALESCE(SUM(impressions) FILTER (WHERE metric_date >= current_date - 30),0) AS profile_views,
                COALESCE(SUM(accounts_engaged) FILTER (WHERE metric_date >= current_date - 30),0) AS accounts_engaged,
                COALESCE(SUM(website_clicks) FILTER (WHERE metric_date >= current_date - 30),0) AS website_clicks
           FROM social_insights GROUP BY platform ORDER BY platform`,
      );

      const { rows: audience } = await c.query<{ dimension: string; bucket: string; value: string }>(
        `SELECT a.dimension, a.bucket, a.value FROM social_audience a
          WHERE a.metric_date = (SELECT max(a2.metric_date) FROM social_audience a2
                                  WHERE a2.dimension = a.dimension AND a2.platform = a.platform)
          ORDER BY a.dimension, a.value DESC`,
      );

      const { rows: posts } = await c.query<{
        title: string; posted_at: string; reach: string; engagements: string; leads: string;
      }>(
        `SELECT title, to_char(posted_at,'YYYY-MM-DD') AS posted_at, reach, engagements, leads
           FROM social_posts WHERE deleted_at IS NULL
          ORDER BY posted_at DESC LIMIT 20`,
      );

      const { rows: spend } = await c.query<{
        name: string; market_code: string | null; spend: string; currency: string;
        impressions: string; clicks: string;
      }>(
        `SELECT name, market_code, SUM(spend)::text AS spend, min(currency) AS currency,
                SUM(impressions)::text AS impressions, SUM(clicks)::text AS clicks
           FROM ad_spend WHERE deleted_at IS NULL AND period_start >= current_date - 90
          GROUP BY name, market_code ORDER BY SUM(spend) DESC LIMIT 20`,
      );

      const { rows: leads } = await c.query<{ market: string; leads: string; won: string }>(
        `SELECT COALESCE(l.target_market_code,'?') AS market,
                count(*)::text AS leads,
                count(*) FILTER (WHERE l.status = 'converted')::text AS won
           FROM leads l WHERE l.deleted_at IS NULL AND l.created_at >= current_date - 90
          GROUP BY 1 ORDER BY count(*) DESC`,
      );

      return {
        accounts: acct.map((a) => ({
          platform: a.platform, followers: Number(a.followers), reach30d: Number(a.reach),
          impressions30d: Number(a.profile_views), accountsEngaged30d: Number(a.accounts_engaged),
          websiteClicks30d: Number(a.website_clicks),
        })),
        audience: audience.map((a) => ({ dimension: a.dimension, bucket: a.bucket, value: Number(a.value) })),
        posts: posts.map((p) => ({
          title: p.title, postedAt: p.posted_at, reach: Number(p.reach),
          engagements: Number(p.engagements), leads: Number(p.leads),
        })),
        spend: spend.map((s) => ({
          name: s.name, marketCode: s.market_code, spend: Number(s.spend),
          currency: s.currency, impressions: Number(s.impressions), clicks: Number(s.clicks),
        })),
        leadsByMarket: leads.map((l) => ({
          market: l.market, leads: Number(l.leads), won: Number(l.won),
        })),
      };
    });
  }

  /**
   * Claude'a analiz yaptırır ve önerileri TASLAK olarak kuyruğa yazar.
   * Hiçbir reklam yayınlanmaz; hiçbir bütçe harcanmaz.
   */
  async analyze(ctx: RequestContext): Promise<{
    ok: boolean; message?: string; analysis?: BrainOutput; proposalsCreated: number;
  }> {
    const client = this.anthropic();
    if (!client) {
      return { ok: false, message: 'ANTHROPIC_API_KEY tanımlı değil — analiz motoru kapalı.', proposalsCreated: 0 };
    }
    const { model } = this.config.get('anthropic', { infer: true });
    const snap = await this.snapshot(ctx);

    let parsed: BrainOutput;
    try {
      // Not: Opus 5'te temperature/top_p GÖNDERİLMEZ (400 döner).
      // Düşünme varsayılan olarak açık; çıktı şemayla kısıtlanır.
      const res = await client.messages.create({
        model,
        max_tokens: 16000,
        system: MARKETING_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: PROPOSAL_SCHEMA } },
        messages: [{ role: 'user', content: buildAnalysisPrompt(snap) }],
      });

      if (res.stop_reason === 'refusal') {
        this.logger.warn('Claude analizi reddetti.');
        return { ok: false, message: 'Model isteği reddetti.', proposalsCreated: 0 };
      }
      const text = res.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') {
        return { ok: false, message: 'Model metin döndürmedi.', proposalsCreated: 0 };
      }
      parsed = JSON.parse(text.text) as BrainOutput;
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`Pazarlama analizi başarısız: ${message}`);
      return { ok: false, message, proposalsCreated: 0 };
    }

    // Önerileri TASLAK olarak yaz. status='pending' → Onur'un onayını bekler.
    // approved_by/approved_at BİLEREK boş: tetikleyici yayını engeller.
    let created = 0;
    await this.db.withContext(ctx, async (c) => {
      for (const p of parsed.proposals ?? []) {
        await c.query(
          `INSERT INTO ad_proposals
             (tenant_id, title, objective, market_code, primary_text, headline,
              description, call_to_action, creative_brief, targeting, rationale,
              daily_budget, currency, status, source, metadata, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,'pending','ai',$14::jsonb,$15,$15)`,
          [ctx.tenantId, p.title, p.objective, p.marketCode ?? null, p.primaryText,
           p.headline, p.description, p.callToAction, p.creativeBrief,
           JSON.stringify(p.targeting ?? {}), p.rationale,
           p.suggestedDailyBudget ?? null, p.currency ?? 'TRY',
           JSON.stringify({ model, generatedAt: new Date().toISOString() }), ctx.userId],
        );
        created++;
      }
    });

    this.logger.log(`Pazarlama analizi tamam: ${created} öneri kuyruğa yazıldı (onay bekliyor).`);
    return { ok: true, analysis: parsed, proposalsCreated: created };
  }
}
