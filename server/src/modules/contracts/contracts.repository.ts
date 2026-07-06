// =====================================================================
// PREI | ContractsRepository — sözleşmeler (salt-okuma), RLS bağlamında.
// property→proje adı + property.developer_id→organizations adı join'lenir.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface ContractRow {
  id: string;
  contract_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  amount: string | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  developer_name: string | null;
  project_title: string | null;
  updated_at: string;
}

const CONTRACT_SELECT = `
  SELECT ct.id, ct.contract_type, ct.status,
         ct.start_date::text AS start_date, ct.end_date::text AS end_date,
         ct.amount, ct.currency, ct.metadata,
         org.name  AS developer_name,
         prop.title AS project_title,
         ct.updated_at
    FROM contracts ct
    LEFT JOIN properties prop  ON prop.id = ct.property_id
    LEFT JOIN organizations org ON org.id = prop.developer_id`;

@Injectable()
export class ContractsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, limit = 100, offset = 0): Promise<ContractRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ContractRow>(
        `${CONTRACT_SELECT}
          WHERE ct.deleted_at IS NULL
          ORDER BY ct.updated_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    });
  }

  async findById(ctx: RequestContext, id: string): Promise<ContractRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ContractRow>(
        `${CONTRACT_SELECT} WHERE ct.id = $1 AND ct.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ?? null;
    });
  }
}
