// =====================================================================
// PREI | LeadsRepository — RLS bağlamında CRUD + transactional outbox.
// Her mutasyon aynı transaction'da: (1) leads yazımı, (2) audit_log,
// (3) events outbox — hepsi correlation_id ile bağlı (F10, B-6).
// =====================================================================
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';

export interface LeadRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  owner_id: string | null;
  status: string;
  priority: string;
  interest_type: string;
  budget_min: string | null;
  budget_max: string | null;
  currency: string;
  target_market_code: string | null;
  score: number | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

/** list/detail için join'lenmiş satır: contact adı + org (şirket) adı. */
export interface LeadJoinedRow extends LeadRow {
  contact_first_name: string;
  contact_last_name: string | null;
  company: string | null;
}

export interface CommunicationRow {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  handled_by_name: string | null;
}

export interface LeadScoreRow {
  id: string;
  score: number;
  reasoning: string | null;
  signals: Record<string, unknown>;
  source: string;
  created_at: string;
  created_by_name: string | null;
}

// lead_scores SELECT gövdesi — kaydeden (manuel ise kullanıcı, n8n ise service_agent) adı.
const SCORE_SELECT = `
  SELECT ls.id, ls.score, ls.reasoning, ls.signals, ls.source, ls.created_at,
         u.full_name AS created_by_name
    FROM lead_scores ls
    LEFT JOIN users u ON u.id = ls.created_by`;

// communications SELECT gövdesi — işleyen danışman adı users'tan.
const COMM_SELECT = `
  SELECT cm.id, cm.channel, cm.direction, cm.subject, cm.body, cm.sent_at,
         u.full_name AS handled_by_name
    FROM communications cm
    LEFT JOIN users u ON u.id = cm.handled_by`;

// leads + contact (ad) + organization (şirket) — presentation join'i.
// RLS bağlamında çalışır; contacts/organizations aynı tenant politikasıyla korunur.
const JOINED_SELECT = `
  SELECT l.*,
         ct.first_name AS contact_first_name,
         ct.last_name  AS contact_last_name,
         org.name      AS company
    FROM leads l
    JOIN contacts ct       ON ct.id = l.contact_id
    LEFT JOIN organizations org ON org.id = l.organization_id`;

@Injectable()
export class LeadsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, limit = 50, offset = 0): Promise<LeadJoinedRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<LeadJoinedRow>(
        `${JOINED_SELECT}
          WHERE l.deleted_at IS NULL
          ORDER BY l.updated_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    });
  }

  async findById(ctx: RequestContext, id: string): Promise<LeadJoinedRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<LeadJoinedRow>(
        `${JOINED_SELECT} WHERE l.id = $1 AND l.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ?? null;
    });
  }

  async listCommunications(ctx: RequestContext, leadId: string): Promise<CommunicationRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<CommunicationRow>(
        `${COMM_SELECT}
          WHERE cm.lead_id = $1
          ORDER BY cm.sent_at DESC NULLS LAST, cm.created_at DESC LIMIT 200`,
        [leadId],
      );
      return rows;
    });
  }

  async listScores(ctx: RequestContext, leadId: string): Promise<LeadScoreRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<LeadScoreRow>(
        `${SCORE_SELECT}
          WHERE ls.lead_id = $1
          ORDER BY ls.created_at DESC LIMIT 50`,
        [leadId],
      );
      return rows;
    });
  }

  /** Aynı transaction içinde mutasyon sonrası join'lenmiş satırı geri okur. */
  private async selectJoined(c: PoolClient, id: string): Promise<LeadJoinedRow> {
    const { rows } = await c.query<LeadJoinedRow>(
      `${JOINED_SELECT} WHERE l.id = $1`,
      [id],
    );
    return rows[0];
  }

  async create(ctx: RequestContext, dto: CreateLeadDto): Promise<LeadJoinedRow> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<LeadRow>(
        `INSERT INTO leads
           (tenant_id, contact_id, owner_id, source_id, status, interest_type, priority,
            budget_min, budget_max, currency, target_market_code, score, notes,
            created_by, updated_by)
         VALUES ($1,$2,$3,$4,
            COALESCE($5::lead_status,'new'), COALESCE($6::lead_interest_type,'buy'),
            COALESCE($7::priority_level,'medium'),
            $8,$9, COALESCE($10,'EUR'), $11,$12,$13, $14,$14)
         RETURNING *`,
        [
          ctx.tenantId, dto.contact_id, dto.owner_id ?? ctx.userId, dto.source_id ?? null,
          dto.status ?? null, dto.interest_type ?? null, dto.priority ?? null,
          dto.budget_min ?? null, dto.budget_max ?? null, dto.currency ?? null,
          dto.target_market_code ?? null, dto.score ?? null, dto.notes ?? null,
          ctx.userId,
        ],
      );
      const lead = rows[0];
      await this.writeAuditAndEvent(c, ctx, 'lead.created', lead.id, { after: lead });
      return this.selectJoined(c, lead.id);
    });
  }

  async update(ctx: RequestContext, id: string, dto: UpdateLeadDto): Promise<LeadJoinedRow | 'not_found' | 'conflict'> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: before } = await c.query<LeadRow>(
        `SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL`, [id],
      );
      if (before.length === 0) return 'not_found';
      // Optimistic concurrency: version uyuşmazsa 409 (trigger version'ı otomatik artırır)
      if (before[0].version !== dto.version) return 'conflict';

      const { rows } = await c.query<LeadRow>(
        `UPDATE leads SET
           status   = COALESCE($2::lead_status, status),
           priority = COALESCE($3::priority_level, priority),
           owner_id = COALESCE($4, owner_id),
           score    = COALESCE($5, score),
           notes    = COALESCE($6, notes),
           updated_by = $7
         WHERE id = $1 AND deleted_at IS NULL AND version = $8
         RETURNING *`,
        [id, dto.status ?? null, dto.priority ?? null, dto.owner_id ?? null,
         dto.score ?? null, dto.notes ?? null, ctx.userId, dto.version],
      );
      if (rows.length === 0) return 'conflict';
      const lead = rows[0];
      await this.writeAuditAndEvent(c, ctx, 'lead.updated', lead.id, {
        before: before[0], after: lead,
      });
      return this.selectJoined(c, lead.id);
    });
  }

  /**
   * KALICI silme (super_admin). Aynı transaction'da: deal kontrolü →
   * proposals temizliği → leads DELETE (communications/activities/scores/
   * attributions/tags FK CASCADE ile; sessions/meeting_notes SET NULL) →
   * audit 'lead.deleted'. Deal'i olan lead silinmez ('has_deals') — gerçek
   * iş verisi yanlışlıkla kaybolmasın.
   */
  async remove(ctx: RequestContext, id: string): Promise<'ok' | 'not_found' | 'has_deals'> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: before } = await c.query<LeadRow>(
        `SELECT * FROM leads WHERE id = $1`, [id],
      );
      if (before.length === 0) return 'not_found';

      const { rows: deals } = await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM deals WHERE lead_id = $1`, [id],
      );
      if (deals[0].n > 0) return 'has_deals';

      // proposals.lead_id FK'sı cascade değil — lead'in teklifleri de silinir.
      await c.query(`DELETE FROM proposals WHERE lead_id = $1`, [id]);
      await c.query(`DELETE FROM leads WHERE id = $1`, [id]);

      await this.writeAuditAndEvent(c, ctx, 'lead.deleted', id, { before: before[0] });
      return 'ok';
    });
  }

  /** audit_log (forensics) + events (outbox) — aynı transaction, correlation_id bağlı. */
  private async writeAuditAndEvent(
    c: PoolClient, ctx: RequestContext, action: string, entityId: string, diff: unknown,
  ): Promise<void> {
    await c.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
       VALUES ($1,$2,$3,'lead',$4,$5,$6)`,
      [ctx.tenantId, ctx.userId, action, entityId, JSON.stringify(diff), ctx.correlationId],
    );
    await c.query(
      `INSERT INTO events (tenant_id, aggregate_type, aggregate_id, event_type, payload, correlation_id, created_by)
       VALUES ($1,'lead',$2,$3,$4,$5,$6)`,
      [ctx.tenantId, entityId, action, JSON.stringify(diff), ctx.correlationId, ctx.userId],
    );
  }
}
