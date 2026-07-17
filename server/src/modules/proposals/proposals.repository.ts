// =====================================================================
// PREI | ProposalsRepository — teklifler (salt-okuma), RLS bağlamında.
// contact→müşteri adı, property→proje adı join'lenir.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface ProposalRow {
  id: string;
  title: string;
  status: string;
  total_value: string | null;
  currency: string;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  project_title: string | null;
  project_city: string | null;
  project_district: string | null;
  project_country: string | null;
}

const PROPOSAL_SELECT = `
  SELECT p.id, p.title, p.status, p.total_value, p.currency, p.view_count,
         p.last_viewed_at, p.created_at, p.metadata,
         ct.first_name AS contact_first_name,
         ct.last_name  AS contact_last_name,
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

  async create(
    ctx: RequestContext,
    input: {
      title: string;
      contactId: string;
      propertyId: string | null;
      totalValue: number | null;
      currency: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<ProposalRow> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO proposals (tenant_id, contact_id, property_id, owner_id, title, status, total_value, currency, sent_at, metadata, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,'sent',$6,$7,now(),$8,$4,$4)
         RETURNING id`,
        [
          ctx.tenantId, input.contactId, input.propertyId, ctx.userId,
          input.title, input.totalValue, input.currency, JSON.stringify(input.metadata),
        ],
      );
      const id = rows[0].id;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'proposal.created','proposal',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ title: input.title }), ctx.correlationId],
      );
      const { rows: full } = await c.query<ProposalRow>(`${PROPOSAL_SELECT} WHERE p.id = $1`, [id]);
      return full[0];
    });
  }
}
