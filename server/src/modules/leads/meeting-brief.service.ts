// =====================================================================
// PREI | MeetingBriefService — görüşme öncesi hazırlık brifingi.
//
// İki katman:
//   1) dossier() — HAM veriyi toplar (konuşma, profil, skor geçmişi,
//      teklifler, geçmiş toplantılar, bayraklar). Model olmadan da işe
//      yarar; danışman ham dosyayı görebilir.
//   2) brief()   — dosyayı Claude'a verir, yapılandırılmış hazırlık
//      brifingi üretir ve leads.metadata'ya yazar (tekrar üretmeye
//      gerek kalmasın; kim ne zaman üretti belli olsun).
//
// Anahtar yoksa dossier çalışmaya devam eder — brief "motor kapalı" der.
// =====================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import {
  BRIEF_SCHEMA, BRIEF_SYSTEM, buildBriefPrompt, profileGaps,
  type LeadDossier, type ProfileGap,
} from './meeting-brief';

export interface MeetingBrief {
  headline: string;
  whoIsThis: string;
  topicsDiscussed: Array<{ topic: string; detail: string }>;
  profileSummary: {
    markets: string[]; regions: string[]; budget: string;
    purpose: string; timeline: string; propertyPreference: string;
  };
  expectations: string[];
  buyingSignals: string[];
  riskSignals: string[];
  openQuestions: string[];
  suggestedAgenda: string[];
  sensitivities: string[];
  scoreRationale: string;
}

export interface BriefResult {
  ok: boolean;
  message?: string;
  /** Brifing metni üretildiyse. */
  brief?: MeetingBrief;
  /** Her durumda döner — model kapalıysa danışman ham dosyayı okur. */
  dossier: LeadDossier;
  gaps: ProfileGap[];
  generatedAt?: string;
  /** Önbellekten mi geldi (aynı konuşma için tekrar üretmeye gerek yok). */
  cached?: boolean;
}

@Injectable()
export class MeetingBriefService {
  private readonly logger = new Logger(MeetingBriefService.name);
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
   * Gelen kimlik lead DE olabilir contact DA — arayüz müşteri sayfasından
   * kişi kimliğiyle çağırır, n8n lead kimliğiyle. İkisini de çözer:
   * contact verilirse o kişinin EN GÜNCEL açık lead'i seçilir.
   */
  private async resolveLeadId(ctx: RequestContext, id: string): Promise<string> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: asLead } = await c.query<{ id: string }>(
        `SELECT id FROM leads WHERE id = $1 AND deleted_at IS NULL`, [id]);
      if (asLead.length > 0) return asLead[0].id;

      const { rows: byContact } = await c.query<{ id: string }>(
        `SELECT id FROM leads
          WHERE contact_id = $1 AND deleted_at IS NULL
          ORDER BY (status NOT IN ('lost','unqualified')) DESC, updated_at DESC
          LIMIT 1`, [id]);
      if (byContact.length === 0) throw new NotFoundException('Bu kişiye bağlı lead bulunamadı');
      return byContact[0].id;
    });
  }

  /** Danışmanın ihtiyacı olan HER ŞEYİ tek sorgu setinde toplar. */
  async dossier(ctx: RequestContext, id: string): Promise<LeadDossier> {
    const leadId = await this.resolveLeadId(ctx, id);
    return this.db.withContext(ctx, async (c) => {
      const { rows: leadRows } = await c.query<{
        lead_id: string; contact_id: string; name: string; email: string | null;
        phone: string | null; preferred_lang: string | null; status: string;
        market_code: string | null; city: string | null; district: string | null;
        property_type: string | null; rooms: string | null;
        budget_min: string | null; budget_max: string | null; currency: string | null;
        timeline: string | null; investment_purpose: string | null; interest_type: string | null;
        notes: string | null; metadata: Record<string, unknown>;
        contact_metadata: Record<string, unknown>;
        meeting_at: string | null; meeting_title: string | null;
      }>(
        `SELECT l.id AS lead_id, ct.id AS contact_id,
                trim(concat(ct.first_name, ' ', coalesce(ct.last_name, ''))) AS name,
                ct.email, ct.phone, ct.preferred_lang, l.status,
                l.target_market_code AS market_code, l.pref_city AS city,
                l.pref_district AS district, l.pref_property_type::text AS property_type,
                l.pref_rooms::text AS rooms, l.budget_min::text, l.budget_max::text,
                l.currency, l.timeline::text, l.investment_purpose::text,
                l.interest_type::text, l.notes, l.metadata, ct.metadata AS contact_metadata,
                m.due_date::text AS meeting_at, m.title AS meeting_title
           FROM leads l
           JOIN contacts ct ON ct.id = l.contact_id
           LEFT JOIN LATERAL (
             SELECT t.due_date, t.title FROM tasks t
              WHERE t.tenant_id = l.tenant_id AND t.task_type = 'meeting'
                AND t.deleted_at IS NULL AND t.due_date > now()
                AND (t.related_id = ct.id OR t.metadata->>'invitee_email' = ct.email)
              ORDER BY t.due_date ASC LIMIT 1
           ) m ON true
          WHERE l.id = $1 AND l.deleted_at IS NULL`,
        [leadId],
      );
      const r = leadRows[0];
      if (!r) throw new NotFoundException('Lead bulunamadı');

      const { rows: msgs } = await c.query<{
        direction: 'inbound' | 'outbound'; channel: string; body: string; sent_at: string;
      }>(
        `SELECT direction, channel, body, COALESCE(sent_at, created_at)::text AS sent_at
           FROM communications
          WHERE lead_id = $1 AND body IS NOT NULL AND body <> ''
          ORDER BY COALESCE(sent_at, created_at) ASC`,
        [leadId],
      );

      const { rows: scores } = await c.query<{
        score: number; reasoning: string | null; signals: Record<string, unknown>;
        source: string; created_at: string;
      }>(
        `SELECT score, reasoning, signals, source, created_at::text
           FROM lead_scores WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [leadId],
      );

      const { rows: props } = await c.query<{
        title: string; status: string; total_value: string | null; currency: string; sent_at: string | null;
      }>(
        `SELECT title, status, total_value::text, currency, sent_at::text
           FROM proposals WHERE lead_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 10`,
        [leadId],
      );

      const { rows: meets } = await c.query<{ title: string; due_date: string; status: string }>(
        `SELECT t.title, t.due_date::text, t.status FROM tasks t
          WHERE t.task_type = 'meeting' AND t.deleted_at IS NULL
            AND t.due_date <= now()
            AND (t.related_id = $1 OR t.metadata->>'invitee_email' = $2)
          ORDER BY t.due_date DESC LIMIT 10`,
        [r.contact_id, r.email],
      );

      // Bayraklar: mükerrer şüphesi, iletişim izni, uzun sessizlik.
      const flags: string[] = [];
      const cm = r.contact_metadata ?? {};
      if (cm.duplicate_suspect_of) flags.push('Mükerrer kayıt şüphesi var — aynı kişi başka bir dosyada olabilir.');
      if ((r.metadata as Record<string, unknown>)?.analysis_sent_at) {
        flags.push(`Daha önce analiz maili gönderilmiş (${String((r.metadata as Record<string, unknown>).analysis_sent_at).slice(0, 10)}).`);
      }
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg) {
        const days = Math.floor((Date.now() - new Date(lastMsg.sent_at).getTime()) / 86400000);
        if (days >= 14) flags.push(`Son mesajdan ${days} gün geçmiş — sohbet soğumuş.`);
      }

      const num = (v: string | null) => (v != null ? Number(v) : null);
      const criteria = (r.metadata as Record<string, unknown>)?.criteria;

      return {
        leadId: r.lead_id, contactId: r.contact_id, name: r.name,
        email: r.email, phone: r.phone, preferredLang: r.preferred_lang, status: r.status,
        meetingAt: r.meeting_at, meetingTitle: r.meeting_title,
        profile: {
          marketCode: r.market_code, city: r.city, district: r.district,
          propertyType: r.property_type, rooms: r.rooms,
          budgetMin: num(r.budget_min), budgetMax: num(r.budget_max),
          currency: r.currency, timeline: r.timeline,
          investmentPurpose: r.investment_purpose, interestType: r.interest_type,
        },
        extractedCriteria: (criteria && typeof criteria === 'object')
          ? (criteria as Record<string, unknown>) : null,
        notes: r.notes,
        scoreHistory: scores.map((s) => ({
          score: s.score, reasoning: s.reasoning, signals: s.signals ?? {},
          source: s.source, createdAt: s.created_at,
        })),
        messages: msgs.map((m) => ({
          direction: m.direction, channel: m.channel, body: m.body, sentAt: m.sent_at,
        })),
        proposals: props.map((p) => ({
          title: p.title, status: p.status, totalValue: num(p.total_value),
          currency: p.currency, sentAt: p.sent_at,
        })),
        pastMeetings: meets.map((m) => ({ title: m.title, dueDate: m.due_date, status: m.status })),
        flags,
      };
    });
  }

  /**
   * Hazırlık brifingi üretir. Aynı konuşma için tekrar üretmemek adına
   * mesaj sayısı imzasıyla önbelleklenir (force ile geçilebilir).
   */
  async brief(ctx: RequestContext, id: string, force = false): Promise<BriefResult> {
    const dossier = await this.dossier(ctx, id);
    const leadId = dossier.leadId;
    const gaps = profileGaps(dossier);
    const signature = `${dossier.messages.length}-${dossier.scoreHistory[0]?.score ?? 0}`;

    // Önbellek: konuşma değişmediyse yeniden üretmeye gerek yok.
    if (!force) {
      const cached = await this.db.withContext(ctx, async (c) => {
        const { rows } = await c.query<{ brief: MeetingBrief; sig: string; at: string }>(
          `SELECT metadata->'meeting_brief'->'brief' AS brief,
                  metadata->'meeting_brief'->>'signature' AS sig,
                  metadata->'meeting_brief'->>'generatedAt' AS at
             FROM leads WHERE id = $1`,
          [leadId],
        );
        return rows[0];
      });
      if (cached?.brief && cached.sig === signature) {
        return { ok: true, brief: cached.brief, dossier, gaps, generatedAt: cached.at, cached: true };
      }
    }

    const client = this.anthropic();
    if (!client) {
      return {
        ok: false,
        message: 'ANTHROPIC_API_KEY tanımlı değil — brifing motoru kapalı. Ham dosya aşağıda.',
        dossier, gaps,
      };
    }
    const { model } = this.config.get('anthropic', { infer: true });

    let brief: MeetingBrief;
    try {
      // Opus 5: temperature/top_p GÖNDERİLMEZ (400 döner).
      const res = await client.messages.create({
        model,
        max_tokens: 8000,
        system: BRIEF_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: BRIEF_SCHEMA } },
        messages: [{ role: 'user', content: buildBriefPrompt(dossier) }],
      });
      if (res.stop_reason === 'refusal') {
        return { ok: false, message: 'Model isteği reddetti.', dossier, gaps };
      }
      const text = res.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') {
        return { ok: false, message: 'Model metin döndürmedi.', dossier, gaps };
      }
      brief = JSON.parse(text.text) as MeetingBrief;
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`Görüşme brifingi üretilemedi (${leadId}): ${message}`);
      return { ok: false, message, dossier, gaps };
    }

    const generatedAt = new Date().toISOString();
    await this.db.withContext(ctx, (c) =>
      c.query(
        `UPDATE leads SET metadata = metadata || $2::jsonb, updated_by = $3 WHERE id = $1`,
        [leadId, JSON.stringify({
          meeting_brief: { brief, signature, generatedAt, model },
        }), ctx.userId],
      ),
    );

    this.logger.log(`Görüşme brifingi üretildi: ${leadId} (${dossier.messages.length} mesaj)`);
    return { ok: true, brief, dossier, gaps, generatedAt, cached: false };
  }
}
