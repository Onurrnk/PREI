// =====================================================================
// PREI | MarketingManagerService — pazarlama yöneticisinin çalışma döngüsü.
//
// Her çalışmada: ölç → geçen seferi gözden geçir → eylem öner → kaydet.
// Kayıt (marketing_runs) yöneticinin HAFIZASIDIR; bir sonraki çalışma
// "geçen sefer şunu önermiştim, ne oldu?" diye başlar.
//
// GÜVENLİK SINIRI: Bu servis hiçbir şey yayınlamaz, hiçbir para harcamaz.
// Ürettiği her eylem ad_proposals'a 'pending' olarak düşer ve 002y
// tetikleyicisi onaysız yayını veritabanı seviyesinde engeller.
// =====================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import { friendlyAiError } from '../../common/ai-error';
import { MarketingBrainService } from './marketing-brain.service';
import {
  MANAGER_SCHEMA, MANAGER_SYSTEM, buildManagerPrompt, detectStage,
  type ActiveCampaign, type GoalProgress, type ManagerContext, type PreviousRun,
} from './marketing-manager';

interface ManagerOutput {
  assessment: string;
  previousReview: string;
  stage: 'setup' | 'growth' | 'optimization';
  actions: Array<{
    kind: 'new_campaign' | 'optimization' | 'content' | 'pause';
    title: string;
    rationale: string;
    expectedImpact: string;
    marketCode: string | null;
    objective: string;
    primaryText: string | null;
    headline: string | null;
    description: string | null;
    callToAction: string | null;
    creativeBrief: string | null;
    targeting: Record<string, unknown>;
    suggestedDailyBudget: number | null;
    currency: string;
    targetCampaignRef: string | null;
  }>;
  warnings: string[];
}

export interface ManagerRunResult {
  ok: boolean;
  message?: string;
  runId?: string;
  stage?: string;
  assessment?: string;
  previousReview?: string;
  warnings?: string[];
  actionsCreated: number;
  goals?: GoalProgress[];
}

@Injectable()
export class MarketingManagerService {
  private readonly logger = new Logger(MarketingManagerService.name);
  private client: Anthropic | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly brain: MarketingBrainService,
  ) {}

  private anthropic(): Anthropic | null {
    const { apiKey } = this.config.get('anthropic', { infer: true });
    if (!apiKey) return null;
    if (!this.client) this.client = new Anthropic({ apiKey });
    return this.client;
  }

  /** Hedefler + gerçekleşen — "artır" sözünü ölçülebilir hale getirir. */
  async goalProgress(ctx: RequestContext): Promise<GoalProgress[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: goals } = await c.query<{
        metric: string; target_value: string; period: string;
      }>(
        `SELECT metric, target_value, period FROM marketing_goals
          WHERE is_active = true ORDER BY metric`,
      );
      if (goals.length === 0) return [];

      // Gerçekleşenler: dönem başından bugüne.
      const { rows: act } = await c.query<{
        followers_gain: string; reach: string; profile_views: string;
        engagement: string; leads: string;
      }>(
        `SELECT
           -- Takipçi ARTIŞI (mutlak sayı değil): ay başı ile bugün farkı
           COALESCE(
             (SELECT SUM(followers) FROM social_insights
               WHERE metric_date = (SELECT max(metric_date) FROM social_insights))
             - (SELECT SUM(followers) FROM social_insights si2
                 WHERE si2.metric_date = (SELECT min(metric_date) FROM social_insights
                                           WHERE metric_date >= date_trunc('month', current_date)))
           , 0) AS followers_gain,
           COALESCE((SELECT SUM(reach) FROM social_insights
                      WHERE metric_date >= date_trunc('month', current_date)),0) AS reach,
           COALESCE((SELECT SUM(profile_views) FROM social_insights
                      WHERE metric_date >= date_trunc('month', current_date)),0) AS profile_views,
           COALESCE((SELECT SUM(accounts_engaged) FROM social_insights
                      WHERE metric_date >= date_trunc('month', current_date)),0) AS engagement,
           COALESCE((SELECT count(*) FROM leads l
                      WHERE l.deleted_at IS NULL
                        AND l.created_at >= date_trunc('month', current_date)),0) AS leads`,
      );
      const a = act[0];
      const actualFor = (m: string): number => {
        switch (m) {
          case 'followers': return Number(a?.followers_gain ?? 0);
          case 'reach': return Number(a?.reach ?? 0);
          case 'profile_views': return Number(a?.profile_views ?? 0);
          case 'engagement': return Number(a?.engagement ?? 0);
          case 'leads': return Number(a?.leads ?? 0);
          default: return 0;
        }
      };

      return goals.map((g) => {
        const target = Number(g.target_value);
        const actual = actualFor(g.metric);
        return {
          metric: g.metric, target, actual, period: g.period,
          progressPct: target > 0 ? (actual / target) * 100 : null,
        };
      });
    });
  }

  /** Geçen çalışma + o çalışmadan çıkan önerilerin akıbeti. */
  private async previousRun(ctx: RequestContext): Promise<PreviousRun | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; run_at: string; assessment: string | null; stage: string;
      }>(
        `SELECT id, run_at::text, assessment, stage FROM marketing_runs
          ORDER BY run_at DESC LIMIT 1`,
      );
      if (rows.length === 0) return null;
      const { rows: outcomes } = await c.query<{
        title: string; kind: string; status: string; publish_state: string;
      }>(
        `SELECT title, kind, status, publish_state FROM ad_proposals
          WHERE run_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
        [rows[0].id],
      );
      return {
        runAt: rows[0].run_at.slice(0, 16),
        assessment: rows[0].assessment,
        stage: rows[0].stage,
        outcomes: outcomes.map((o) => ({
          title: o.title, kind: o.kind, status: o.status, publishState: o.publish_state,
        })),
      };
    });
  }

  /** Aktif kampanyalar + türetilmiş verim metrikleri (TO, TBM). */
  private async activeCampaigns(ctx: RequestContext): Promise<ActiveCampaign[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        name: string; campaign_ref: string | null; market_code: string | null;
        spend: string; currency: string; impressions: string; clicks: string;
      }>(
        `SELECT name, campaign_ref, market_code,
                SUM(spend)::text AS spend, min(currency) AS currency,
                SUM(impressions)::text AS impressions, SUM(clicks)::text AS clicks
           FROM ad_spend
          WHERE deleted_at IS NULL AND period_start >= current_date - 30
          GROUP BY name, campaign_ref, market_code
          ORDER BY SUM(spend) DESC LIMIT 20`,
      );
      return rows.map((r) => {
        const impressions = Number(r.impressions);
        const clicks = Number(r.clicks);
        const spend = Number(r.spend);
        return {
          name: r.name, campaignRef: r.campaign_ref, marketCode: r.market_code,
          spend, currency: r.currency, impressions, clicks,
          // Payda sıfırsa oran uydurma — null döner.
          ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
          cpc: clicks > 0 ? spend / clicks : null,
        };
      });
    });
  }

  /** Yöneticiyi çalıştırır. Hiçbir şey yayınlamaz; eylemler onaya düşer. */
  async run(ctx: RequestContext): Promise<ManagerRunResult> {
    const client = this.anthropic();
    if (!client) {
      return {
        ok: false, actionsCreated: 0,
        message: 'ANTHROPIC_API_KEY tanımlı değil — pazarlama yöneticisi kapalı.',
      };
    }
    const { model } = this.config.get('anthropic', { infer: true });

    const [snapshot, goals, previous, campaigns] = await Promise.all([
      this.brain.snapshot(ctx),
      this.goalProgress(ctx),
      this.previousRun(ctx),
      this.activeCampaigns(ctx),
    ]);
    const managerCtx: ManagerContext = { snapshot, goals, previous, campaigns };
    const stage = detectStage(managerCtx);

    let out: ManagerOutput;
    try {
      // Opus 5: temperature/top_p GÖNDERİLMEZ (400 döner). Düşünme varsayılan açık.
      const res = await client.messages.create({
        model,
        max_tokens: 16000,
        system: MANAGER_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: MANAGER_SCHEMA } },
        messages: [{ role: 'user', content: buildManagerPrompt(managerCtx) }],
      });
      if (res.stop_reason === 'refusal') {
        return { ok: false, actionsCreated: 0, message: 'Model isteği reddetti.' };
      }
      const text = res.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') {
        return { ok: false, actionsCreated: 0, message: 'Model metin döndürmedi.' };
      }
      out = JSON.parse(text.text) as ManagerOutput;
    } catch (e) {
      const message = friendlyAiError(e);
      this.logger.error(`Pazarlama yöneticisi çalışamadı: ${message}`);
      return { ok: false, actionsCreated: 0, message };
    }

    // Çalışmayı ve eylemleri TEK işlemde yaz — yarım kayıt kalmasın.
    const { runId, created } = await this.db.withContext(ctx, async (c) => {
      const { rows: run } = await c.query<{ id: string }>(
        `INSERT INTO marketing_runs
           (tenant_id, snapshot, assessment, previous_review, stage, model, metadata, created_by)
         VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id`,
        [ctx.tenantId, JSON.stringify({ goals, campaigns, accounts: snapshot.accounts }),
         out.assessment, out.previousReview, out.stage ?? stage, model,
         JSON.stringify({ warnings: out.warnings ?? [] }), ctx.userId],
      );
      const runId = run[0].id;

      let created = 0;
      for (const a of out.actions ?? []) {
        // content/pause para harcamaz → bütçe null'lanır.
        const budget = a.kind === 'content' || a.kind === 'pause'
          ? null : a.suggestedDailyBudget;
        await c.query(
          `INSERT INTO ad_proposals
             (tenant_id, title, objective, market_code, primary_text, headline,
              description, call_to_action, creative_brief, targeting, rationale,
              daily_budget, currency, status, source, kind, target_campaign_ref,
              expected_impact, run_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,'pending','ai',
                   $14,$15,$16,$17,$18,$18)`,
          [ctx.tenantId, a.title, a.objective, a.marketCode, a.primaryText, a.headline,
           a.description, a.callToAction, a.creativeBrief,
           JSON.stringify(a.targeting ?? {}), a.rationale, budget, a.currency ?? 'TRY',
           a.kind, a.targetCampaignRef, a.expectedImpact, runId, ctx.userId],
        );
        created++;
      }
      await c.query(`UPDATE marketing_runs SET proposals_created = $2 WHERE id = $1`,
        [runId, created]);

      // Bildirim merkezinde görünsün — Onur onay bekleyen eylemleri kaçırmasın.
      if (created > 0) {
        await c.query(
          `INSERT INTO events (tenant_id, aggregate_type, aggregate_id, event_type,
                               payload, correlation_id, created_by)
           VALUES ($1,'marketing',$2,'marketing.manager_run',$3::jsonb,$4,$5)`,
          [ctx.tenantId, runId,
           JSON.stringify({ stage: out.stage ?? stage, actions: created }),
           ctx.correlationId, ctx.userId],
        );
      }
      return { runId, created };
    });

    this.logger.log(
      `Pazarlama yöneticisi çalıştı (${out.stage ?? stage}): ${created} eylem onaya düştü.`,
    );
    return {
      ok: true, runId, stage: out.stage ?? stage,
      assessment: out.assessment, previousReview: out.previousReview,
      warnings: out.warnings ?? [], actionsCreated: created, goals,
    };
  }

  /** Son çalışmanın raporu — arayüzün gösterdiği şey. */
  async latestReport(ctx: RequestContext): Promise<{
    run: { id: string; runAt: string; stage: string; assessment: string | null;
           previousReview: string | null; warnings: string[]; proposalsCreated: number } | null;
    goals: GoalProgress[];
  }> {
    const goals = await this.goalProgress(ctx);
    const run = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; run_at: string; stage: string; assessment: string | null;
        previous_review: string | null; metadata: { warnings?: string[] };
        proposals_created: number;
      }>(
        `SELECT id, run_at::text, stage, assessment, previous_review, metadata, proposals_created
           FROM marketing_runs ORDER BY run_at DESC LIMIT 1`,
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        id: r.id, runAt: r.run_at, stage: r.stage, assessment: r.assessment,
        previousReview: r.previous_review, warnings: r.metadata?.warnings ?? [],
        proposalsCreated: Number(r.proposals_created),
      };
    });
    return { run, goals };
  }
}
