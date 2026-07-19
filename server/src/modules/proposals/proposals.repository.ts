// =====================================================================
// PREI | ProposalsRepository — teklifler (okuma + yazma), RLS bağlamında.
// contact→müşteri adı/e-posta, property→proje adı join'lenir. Zengin teklif
// verisi (daire, ödeme planı, ROI, materyaller) metadata jsonb'de saklanır.
// =====================================================================
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface ProposalRow {
  id: string;
  contact_id: string | null;
  property_id: string | null;
  title: string;
  status: string;
  total_value: string | null;
  currency: string;
  view_count: number;
  last_viewed_at: string | null;
  sent_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  project_title: string | null;
  project_city: string | null;
  project_district: string | null;
  project_country: string | null;
}

export interface CreateProposalInput {
  title: string;
  contactId: string;
  propertyId: string | null;
  totalValue: number | null;
  currency: string;
  status?: string; // 'draft' | 'sent' (varsayılan draft)
  metadata: Record<string, unknown>;
}

export interface UpdateProposalInput {
  title?: string;
  currency?: string;
  totalValue?: number | null;
  propertyId?: string | null;
  status?: string;
  metadataPatch?: Record<string, unknown>;
}

const PROPOSAL_SELECT = `
  SELECT p.id, p.contact_id, p.property_id, p.title, p.status, p.total_value, p.currency, p.view_count,
         p.last_viewed_at, p.sent_at, p.created_at, p.metadata,
         ct.first_name AS contact_first_name,
         ct.last_name  AS contact_last_name,
         ct.email      AS contact_email,
         prop.title    AS project_title,
         prop.city     AS project_city,
         prop.district AS project_district,
         prop.country  AS project_country
    FROM proposals p
    LEFT JOIN contacts ct    ON ct.id = p.contact_id
    LEFT JOIN properties prop ON prop.id = p.property_id`;

@Injectable()
export class ProposalsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, limit = 100, offset = 0): Promise<ProposalRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ProposalRow>(
        `${PROPOSAL_SELECT}
          WHERE p.deleted_at IS NULL
          ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    });
  }

  async findById(ctx: RequestContext, id: string): Promise<ProposalRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ProposalRow>(
        `${PROPOSAL_SELECT} WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ?? null;
    });
  }

  async create(ctx: RequestContext, input: CreateProposalInput): Promise<ProposalRow> {
    const status = input.status === 'sent' ? 'sent' : 'draft';
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO proposals
           (tenant_id, contact_id, property_id, owner_id, title, status,
            total_value, currency, sent_at, metadata, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${status === 'sent' ? 'now()' : 'NULL'},$9,$4,$4)
         RETURNING id`,
        [
          ctx.tenantId, input.contactId, input.propertyId, ctx.userId,
          input.title, status, input.totalValue, input.currency,
          JSON.stringify(input.metadata),
        ],
      );
      const id = rows[0].id;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'proposal.created','proposal',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ title: input.title }), ctx.correlationId],
      );
      return (await this.reselect(c, id))!;
    });
  }

  async update(ctx: RequestContext, id: string, data: UpdateProposalInput): Promise<ProposalRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE proposals SET
            title       = COALESCE($2, title),
            currency    = COALESCE($3, currency),
            total_value = COALESCE($4, total_value),
            property_id = COALESCE($5, property_id),
            status      = COALESCE($6, status),
            metadata    = metadata || $7::jsonb,
            updated_by  = $8
          WHERE id = $1 AND deleted_at IS NULL`,
        [
          id, data.title ?? null, data.currency ?? null,
          data.totalValue ?? null, data.propertyId ?? null, data.status ?? null,
          JSON.stringify(data.metadataPatch ?? {}), ctx.userId,
        ],
      );
      if (!rowCount) return null;
      return this.reselect(c, id);
    });
  }

  async markSent(ctx: RequestContext, id: string): Promise<ProposalRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE proposals
            SET status = 'sent', sent_at = COALESCE(sent_at, now()), updated_by = $2
          WHERE id = $1 AND deleted_at IS NULL`,
        [id, ctx.userId],
      );
      if (!rowCount) return null;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'proposal.sent','proposal',$3,'{}'::jsonb,$4)`,
        [ctx.tenantId, ctx.userId, id, ctx.correlationId],
      );
      return this.reselect(c, id);
    });
  }

  /** Teklifi hazırlayan danışmanın görünen adı (e-posta imzası için). */
  async ownerName(ctx: RequestContext): Promise<string> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ full_name: string }>(
        `SELECT full_name FROM users WHERE id = $1 LIMIT 1`,
        [ctx.userId],
      );
      return rows[0]?.full_name || 'ProDuality Danışmanı';
    });
  }

  private async reselect(c: PoolClient, id: string): Promise<ProposalRow | null> {
    const { rows } = await c.query<ProposalRow>(
      `${PROPOSAL_SELECT} WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }
}
