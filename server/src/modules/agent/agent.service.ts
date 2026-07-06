// =====================================================================
// PREI | AgentService — WhatsApp event → contact+lead+session+message
// atomik yazım (OV-4). Tek transaction; B-8 idempotency: external_message_id
// tekrarında sessizce no-op. Reklam atıfı varsa lead_attributions'a yazar (K-5).
// =====================================================================
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { WhatsAppEventDto } from './dto/whatsapp-event.dto';

export interface IngestResult {
  contact_id: string;
  lead_id: string;
  session_id: string;
  deduped: boolean;
}

@Injectable()
export class AgentService {
  constructor(private readonly db: DatabaseService) {}

  async ingest(ctx: RequestContext, dto: WhatsAppEventDto): Promise<IngestResult> {
    const normalized = dto.phone.replace(/[^0-9]/g, '');
    return this.db.withContext(ctx, async (c) => {
      // B-8 idempotency: bu provider mesajı zaten işlendiyse no-op
      if (dto.external_message_id) {
        const { rows: dup } = await c.query<{ lead_id: string; contact_id: string }>(
          `SELECT c.lead_id, c.contact_id FROM communications c
             WHERE c.tenant_id = $1 AND c.channel = 'whatsapp' AND c.external_id = $2 LIMIT 1`,
          [ctx.tenantId, dto.external_message_id],
        );
        if (dup.length > 0) {
          const sess = await this.findSession(c, ctx, normalized);
          return { contact_id: dup[0].contact_id, lead_id: dup[0].lead_id ?? '', session_id: sess ?? '', deduped: true };
        }
      }

      const contactId = await this.upsertContact(c, ctx, normalized, dto.name);
      const leadId = await this.ensureOpenLead(c, ctx, contactId, dto.qualification_score);
      const sessionId = await this.upsertSession(c, ctx, contactId, leadId, dto.external_session_id);

      // Mesajı communications'a yaz (inbound)
      await c.query(
        `INSERT INTO communications (tenant_id, lead_id, contact_id, channel, direction, body, external_id, sent_at, created_by)
         VALUES ($1,$2,$3,'whatsapp','inbound',$4,$5,now(),$6)`,
        [ctx.tenantId, leadId, contactId, dto.message, dto.external_message_id ?? null, ctx.userId],
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

      await this.writeEvent(c, ctx, 'lead', leadId, 'lead.whatsapp_message', { contactId, sessionId });
      return { contact_id: contactId, lead_id: leadId, session_id: sessionId, deduped: false };
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

  private async upsertSession(c: PoolClient, ctx: RequestContext, contactId: string, leadId: string, ext?: string): Promise<string> {
    if (ext) {
      const { rows } = await c.query<{ id: string }>(
        `SELECT id FROM conversation_sessions
           WHERE tenant_id = $1 AND channel = 'whatsapp' AND external_session_id = $2 LIMIT 1`,
        [ctx.tenantId, ext],
      );
      if (rows.length > 0) return rows[0].id;
    }
    const { rows: created } = await c.query<{ id: string }>(
      `INSERT INTO conversation_sessions (tenant_id, contact_id, lead_id, channel, external_session_id, status, created_by)
       VALUES ($1,$2,$3,'whatsapp',$4,'open',$5) RETURNING id`,
      [ctx.tenantId, contactId, leadId, ext ?? null, ctx.userId],
    );
    return created[0].id;
  }

  private async findSession(c: PoolClient, ctx: RequestContext, normalized: string): Promise<string | null> {
    const { rows } = await c.query<{ id: string }>(
      `SELECT s.id FROM conversation_sessions s
         JOIN contacts ct ON ct.id = s.contact_id
        WHERE s.tenant_id = $1 AND ct.normalized_phone = $2
        ORDER BY s.started_at DESC LIMIT 1`,
      [ctx.tenantId, normalized],
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
