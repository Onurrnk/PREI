// =====================================================================
// PREI | AgentService — WhatsApp event → contact+lead+session+message
// atomik yazım (OV-4). Tek transaction; B-8 idempotency: external_message_id
// tekrarında sessizce no-op. Reklam atıfı varsa lead_attributions'a yazar (K-5).
// =====================================================================
import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { WhatsAppEventDto } from './dto/whatsapp-event.dto';
import type { LeadScoreEventDto } from './dto/lead-score-event.dto';
import type { KnowledgeSearchDto } from './dto/knowledge-search.dto';
import type { OutboundMessageDto } from './dto/outbound-message.dto';

export interface IngestResult {
  contact_id: string;
  lead_id: string;
  session_id: string;
  deduped: boolean;
}

export interface ScoreResult {
  lead_id: string;
  score_id: string;
  score: number;
}

export interface AgentCommunication {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string | null;
  sentAt: string | null;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

@Injectable()
export class AgentService {
  constructor(private readonly db: DatabaseService) {}

  async ingest(ctx: RequestContext, dto: WhatsAppEventDto): Promise<IngestResult> {
    const channel = dto.channel ?? 'whatsapp';
    const normalized = dto.phone.replace(/[^0-9]/g, '');
    return this.db.withContext(ctx, async (c) => {
      // B-8 idempotency: bu provider mesajı zaten işlendiyse no-op
      if (dto.external_message_id) {
        const { rows: dup } = await c.query<{ lead_id: string; contact_id: string }>(
          `SELECT c.lead_id, c.contact_id FROM communications c
             WHERE c.tenant_id = $1 AND c.channel = $2 AND c.external_id = $3 LIMIT 1`,
          [ctx.tenantId, channel, dto.external_message_id],
        );
        if (dup.length > 0) {
          const sess = await this.findSession(c, ctx, normalized, channel);
          return { contact_id: dup[0].contact_id, lead_id: dup[0].lead_id ?? '', session_id: sess ?? '', deduped: true };
        }
      }

      const contactId = await this.upsertContact(c, ctx, normalized, dto.name);
      const leadId = await this.ensureOpenLead(c, ctx, contactId, dto.qualification_score);
      const sessionId = await this.upsertSession(c, ctx, contactId, leadId, channel, dto.external_session_id);

      // Mesajı communications'a yaz (inbound)
      await c.query(
        `INSERT INTO communications (tenant_id, lead_id, contact_id, channel, direction, body, external_id, sent_at, created_by)
         VALUES ($1,$2,$3,$4,'inbound',$5,$6,now(),$7)`,
        [ctx.tenantId, leadId, contactId, channel, dto.message, dto.external_message_id ?? null, ctx.userId],
      );
      await c.query(
        `UPDATE conversation_sessions SET message_count = message_count + 1 WHERE id = $1`,
        [sessionId],
      );

      // Reklam atıfı (K-5): reklam kaynaklıysa lead_attributions'a yaz
      if (dto.source_type && dto.source_type !== 'organic') {
        await c.query(
          `INSERT INTO lead_attributions (tenant_id, lead_id, source_type, ad_id, adset_id, campaign_id, headline, referral_raw, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [ctx.tenantId, leadId, dto.source_type, dto.attribution?.ad_id ?? null,
           dto.attribution?.adset_id ?? null, dto.attribution?.campaign_id ?? null,
           dto.attribution?.headline ?? null, JSON.stringify(dto.attribution ?? {}), ctx.userId],
        );
      }

      await this.writeEvent(c, ctx, 'lead', leadId, 'lead.whatsapp_message', { contactId, sessionId, channel });
      return { contact_id: contactId, lead_id: leadId, session_id: sessionId, deduped: false };
    });
  }

  /**
   * Eylül'ün (AI) ürettiği cevabı outbound communication olarak yazar —
   * ingest()'in yazdığı inbound mesajla aynı timeline'a düşer. lead_id
   * zaten ingest'ten geldiği için contact_id'yi lead üzerinden çözer.
   */
  async recordOutboundMessage(ctx: RequestContext, dto: OutboundMessageDto): Promise<{ id: string }> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: lead } = await c.query<{ id: string; contact_id: string }>(
        `SELECT id, contact_id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [dto.lead_id, ctx.tenantId],
      );
      if (lead.length === 0) throw new NotFoundException('Lead bulunamadı');

      const { rows: created } = await c.query<{ id: string }>(
        `INSERT INTO communications (tenant_id, lead_id, contact_id, channel, direction, body, external_id, sent_at, created_by)
         VALUES ($1,$2,$3,$4,'outbound',$5,$6,now(),$7) RETURNING id`,
        [ctx.tenantId, dto.lead_id, lead[0].contact_id, dto.channel, dto.message,
         dto.external_message_id ?? null, ctx.userId],
      );

      await c.query(
        `UPDATE conversation_sessions SET message_count = message_count + 1
           WHERE tenant_id = $1 AND lead_id = $2 AND channel = $3 AND status = 'open'`,
        [ctx.tenantId, dto.lead_id, dto.channel],
      );

      await this.writeEvent(c, ctx, 'lead', dto.lead_id, 'lead.agent_reply', { channel: dto.channel });
      return { id: created[0].id };
    });
  }

  /**
   * n8n'in RAG akışı (communications geçmişi + knowledge_chunks) skoru
   * hesapladıktan sonra buraya yazar. lead_scores'a append-only satır +
   * leads.score önbelleği aynı transaction'da güncellenir.
   */
  async scoreLead(ctx: RequestContext, dto: LeadScoreEventDto): Promise<ScoreResult> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: lead } = await c.query<{ id: string }>(
        `SELECT id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [dto.lead_id, ctx.tenantId],
      );
      if (lead.length === 0) throw new NotFoundException('Lead bulunamadı');

      const { rows: scored } = await c.query<{ id: string }>(
        `INSERT INTO lead_scores (tenant_id, lead_id, score, reasoning, signals, source, created_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,'n8n_ai',$6)
         RETURNING id`,
        [ctx.tenantId, dto.lead_id, dto.score, dto.reasoning ?? null,
         JSON.stringify(dto.signals ?? {}), ctx.userId],
      );

      await c.query(
        `UPDATE leads SET score = $2, updated_by = $3 WHERE id = $1`,
        [dto.lead_id, dto.score, ctx.userId],
      );

      await this.writeEvent(c, ctx, 'lead', dto.lead_id, 'lead.scored', {
        score: dto.score, scoreId: scored[0].id, source: 'n8n_ai',
      });

      return { lead_id: dto.lead_id, score_id: scored[0].id, score: dto.score };
    });
  }

  /**
   * n8n'in zamanlanmış skorlama turu için: communications'ı olan ama son
   * 24 saatte skorlanmamış lead'ler (gereksiz yere hepsini her turda
   * yeniden skorlamamak için basit bir eşik).
   */
  async leadsNeedingScore(ctx: RequestContext): Promise<Array<{ id: string; contactName: string }>> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string; contact_name: string }>(
        `SELECT DISTINCT l.id,
                trim(ct.first_name || ' ' || COALESCE(ct.last_name, '')) AS contact_name
           FROM leads l
           JOIN contacts ct ON ct.id = l.contact_id
           JOIN communications cm ON cm.lead_id = l.id
          WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
            AND l.status NOT IN ('converted', 'lost')
            AND NOT EXISTS (
              SELECT 1 FROM lead_scores ls
               WHERE ls.lead_id = l.id AND ls.created_at > now() - interval '24 hours'
            )
          ORDER BY l.id LIMIT 100`,
        [ctx.tenantId],
      );
      return rows.map((r) => ({ id: r.id, contactName: r.contact_name }));
    });
  }

  /** n8n'in RAG akışı için: lead'in kendi görüşme geçmişi (WhatsApp/telefon/e-posta). */
  async leadCommunications(ctx: RequestContext, leadId: string): Promise<AgentCommunication[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: lead } = await c.query<{ id: string }>(
        `SELECT id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [leadId, ctx.tenantId],
      );
      if (lead.length === 0) throw new NotFoundException('Lead bulunamadı');

      const { rows } = await c.query<{
        id: string; channel: string; direction: string; subject: string | null;
        body: string | null; sent_at: string | null;
      }>(
        `SELECT id, channel, direction, subject, body, sent_at
           FROM communications
          WHERE lead_id = $1
          ORDER BY sent_at DESC NULLS LAST, created_at DESC LIMIT 200`,
        [leadId],
      );
      return rows.map((r) => ({
        id: r.id, channel: r.channel, direction: r.direction,
        subject: r.subject, body: r.body, sentAt: r.sent_at,
      }));
    });
  }

  /**
   * n8n'in RAG akışı için: ProDuality bilgi tabanında (knowledge_chunks/
   * documents) benzerlik araması. Embedding n8n'de üretilir (OpenAI),
   * arama burada — service_role n8n'e hiç verilmez (OV-4).
   */
  async searchKnowledge(ctx: RequestContext, dto: KnowledgeSearchDto): Promise<KnowledgeChunk[]> {
    return this.db.withContext(ctx, async (c) => {
      const vectorLiteral = `[${dto.embedding.join(',')}]`;
      const { rows } = await c.query<{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }>(
        `SELECT id, content, metadata, similarity FROM match_documents($1::vector, $2, '{}'::jsonb)`,
        [vectorLiteral, dto.matchCount ?? 5],
      );
      return rows;
    });
  }

  private async upsertContact(c: PoolClient, ctx: RequestContext, normalized: string, name?: string): Promise<string> {
    const { rows } = await c.query<{ id: string }>(
      `SELECT id FROM contacts
         WHERE tenant_id = $1 AND normalized_phone = $2 AND deleted_at IS NULL AND merged_into_id IS NULL
         LIMIT 1`,
      [ctx.tenantId, normalized],
    );
    if (rows.length > 0) return rows[0].id;
    const first = (name ?? 'WhatsApp Lead').trim().split(/\s+/)[0] || 'WhatsApp';
    const last = name ? name.trim().split(/\s+/).slice(1).join(' ') || null : null;
    const { rows: created } = await c.query<{ id: string }>(
      `INSERT INTO contacts (tenant_id, first_name, last_name, phone, whatsapp, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$4,$5,$5) RETURNING id`,
      [ctx.tenantId, first, last, '+' + normalized, ctx.userId],
    );
    return created[0].id;
  }

  private async ensureOpenLead(c: PoolClient, ctx: RequestContext, contactId: string, score?: number): Promise<string> {
    const { rows } = await c.query<{ id: string }>(
      `SELECT id FROM leads
         WHERE tenant_id = $1 AND contact_id = $2 AND deleted_at IS NULL
           AND status NOT IN ('converted','lost')
         ORDER BY created_at DESC LIMIT 1`,
      [ctx.tenantId, contactId],
    );
    if (rows.length > 0) {
      if (score !== undefined) {
        await c.query(`UPDATE leads SET score = $2, updated_by = $3 WHERE id = $1`, [rows[0].id, score, ctx.userId]);
      }
      return rows[0].id;
    }
    const { rows: created } = await c.query<{ id: string }>(
      `INSERT INTO leads (tenant_id, contact_id, owner_id, source_id, status, interest_type, score, created_by, updated_by)
       VALUES ($1,$2,NULL,NULL,'new','invest',$3,$4,$4) RETURNING id`,
      [ctx.tenantId, contactId, score ?? null, ctx.userId],
    );
    await this.writeEvent(c, ctx, 'lead', created[0].id, 'lead.created', { via: 'whatsapp_agent' });
    return created[0].id;
  }

  private async upsertSession(c: PoolClient, ctx: RequestContext, contactId: string, leadId: string, channel: string, ext?: string): Promise<string> {
    if (ext) {
      const { rows } = await c.query<{ id: string }>(
        `SELECT id FROM conversation_sessions
           WHERE tenant_id = $1 AND channel = $2 AND external_session_id = $3 LIMIT 1`,
        [ctx.tenantId, channel, ext],
      );
      if (rows.length > 0) return rows[0].id;
    }
    const { rows: created } = await c.query<{ id: string }>(
      `INSERT INTO conversation_sessions (tenant_id, contact_id, lead_id, channel, external_session_id, status, created_by)
       VALUES ($1,$2,$3,$4,$5,'open',$6) RETURNING id`,
      [ctx.tenantId, contactId, leadId, channel, ext ?? null, ctx.userId],
    );
    return created[0].id;
  }

  private async findSession(c: PoolClient, ctx: RequestContext, normalized: string, channel: string): Promise<string | null> {
    const { rows } = await c.query<{ id: string }>(
      `SELECT s.id FROM conversation_sessions s
         JOIN contacts ct ON ct.id = s.contact_id
        WHERE s.tenant_id = $1 AND ct.normalized_phone = $2 AND s.channel = $3
        ORDER BY s.started_at DESC LIMIT 1`,
      [ctx.tenantId, normalized, channel],
    );
    return rows[0]?.id ?? null;
  }

  private async writeEvent(c: PoolClient, ctx: RequestContext, aggType: string, aggId: string, type: string, payload: unknown): Promise<void> {
    await c.query(
      `INSERT INTO events (tenant_id, aggregate_type, aggregate_id, event_type, payload, correlation_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ctx.tenantId, aggType, aggId, type, JSON.stringify(payload), ctx.correlationId, ctx.userId],
    );
  }
}
