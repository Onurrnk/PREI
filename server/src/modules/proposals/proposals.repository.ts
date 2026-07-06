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
}

const PROPOSAL_SELECT = `
  SELECT p.id, p.title, p.status, p.total_value, p.currency, p.view_count,
         p.last_viewed_at, p.created_at, p.metadata,
         ct.first_name AS contact_first_name,
         ct.last_name  AS contact_last_name,
         prop.title    AS project_title
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
}
