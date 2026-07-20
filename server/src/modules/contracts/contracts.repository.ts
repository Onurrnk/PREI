// =====================================================================
// PREI | ContractsRepository — sözleşmeler (salt-okuma), RLS bağlamında.
// property→proje adı + property.developer_id→organizations adı join'lenir.
// =====================================================================
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface ContractWriteInput {
  contractType?: string;
  status?: string;
  propertyId?: string | null;
  contactId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  amount?: number | null;
  currency?: string;
  /** metadata jsonb'ye merge edilecek serbest alanlar (commission/legal_entity/payment_terms). */
  metadataPatch?: Record<string, unknown>;
}

export interface ContractRow {
  id: string;
  contract_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  amount: string | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  property_id: string | null;
  contact_id: string | null;
  developer_name: string | null;
  project_title: string | null;
  updated_at: string;
}

export interface ContractDocRow {
  id: string;
  name: string;
  size_bytes: string; // pg bigint → string
  related_id: string;
}

const CONTRACT_SELECT = `
  SELECT ct.id, ct.contract_type, ct.status,
         ct.start_date::text AS start_date, ct.end_date::text AS end_date,
         ct.amount, ct.currency, ct.metadata,
         ct.property_id, ct.contact_id,
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

  private async reselect(c: PoolClient, id: string): Promise<ContractRow | null> {
    const { rows } = await c.query<ContractRow>(
      `${CONTRACT_SELECT} WHERE ct.id = $1 AND ct.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  async create(ctx: RequestContext, input: ContractWriteInput): Promise<ContractRow> {
    const status = input.status ?? 'draft';
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO contracts
           (tenant_id, contract_type, status, property_id, contact_id,
            start_date, end_date, amount, currency, metadata, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$11)
         RETURNING id`,
        [
          ctx.tenantId, input.contractType, status,
          input.propertyId ?? null, input.contactId ?? null,
          input.startDate ?? null, input.endDate ?? null,
          input.amount ?? null, input.currency ?? 'EUR',
          JSON.stringify(input.metadataPatch ?? {}), ctx.userId,
        ],
      );
      const id = rows[0].id;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'contract.created','contract',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id,
         JSON.stringify({ contractType: input.contractType, status }), ctx.correlationId],
      );
      await c.query(
        `INSERT INTO events (tenant_id, aggregate_type, aggregate_id, event_type, payload, correlation_id, created_by)
         VALUES ($1,'contract',$2,'contract.created',$3,$4,$5)`,
        [ctx.tenantId, id, JSON.stringify({ status }), ctx.correlationId, ctx.userId],
      );
      return (await this.reselect(c, id))!;
    });
  }

  async update(ctx: RequestContext, id: string, input: ContractWriteInput): Promise<ContractRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE contracts SET
            contract_type = COALESCE($2, contract_type),
            status        = COALESCE($3, status),
            property_id   = COALESCE($4, property_id),
            contact_id    = COALESCE($5, contact_id),
            start_date    = COALESCE($6, start_date),
            end_date      = COALESCE($7, end_date),
            amount        = COALESCE($8, amount),
            currency      = COALESCE($9, currency),
            metadata      = metadata || $10::jsonb,
            updated_by    = $11
          WHERE id = $1 AND deleted_at IS NULL`,
        [
          id, input.contractType ?? null, input.status ?? null,
          input.propertyId ?? null, input.contactId ?? null,
          input.startDate ?? null, input.endDate ?? null,
          input.amount ?? null, input.currency ?? null,
          JSON.stringify(input.metadataPatch ?? {}), ctx.userId,
        ],
      );
      if (!rowCount) return null;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'contract.updated','contract',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ fields: Object.keys(input) }), ctx.correlationId],
      );
      return this.reselect(c, id);
    });
  }

  /** Vault'a related_type='contract' ile bağlanmış gerçek dosyalar. */
  async documentsByContractIds(ctx: RequestContext, ids: string[]): Promise<ContractDocRow[]> {
    if (ids.length === 0) return [];
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ContractDocRow>(
        `SELECT id, name, size_bytes, related_id
           FROM documents_vault
          WHERE related_type = 'contract' AND related_id = ANY($1) AND deleted_at IS NULL
          ORDER BY created_at DESC`,
        [ids],
      );
      return rows;
    });
  }
}
