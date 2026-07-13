// =====================================================================
// PREI | DocumentsRepository — documents_vault CRUD (RLS bağlamında).
// Mutasyonlar audit_log + events outbox'a aynı transaction'da yazar (F10).
// =====================================================================
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface VaultDocRow {
  id: string;
  name: string;
  folder: string;
  mime_type: string;
  size_bytes: string; // pg bigint → string
  storage_path: string;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
  uploaded_by_name: string | null;
}

const DOC_SELECT = `
  SELECT d.id, d.name, d.folder, d.mime_type, d.size_bytes, d.storage_path,
         d.related_type, d.related_id, d.created_at,
         u.full_name AS uploaded_by_name
    FROM documents_vault d
    LEFT JOIN users u ON u.id = d.uploaded_by`;

export interface CreateVaultDocInput {
  name: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  relatedType?: string;
  relatedId?: string;
}

@Injectable()
export class DocumentsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext): Promise<VaultDocRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<VaultDocRow>(
        `${DOC_SELECT}
          WHERE d.deleted_at IS NULL
          ORDER BY d.created_at DESC LIMIT 500`,
      );
      return rows;
    });
  }

  async findById(ctx: RequestContext, id: string): Promise<VaultDocRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<VaultDocRow>(
        `${DOC_SELECT} WHERE d.id = $1 AND d.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ?? null;
    });
  }

  async create(ctx: RequestContext, input: CreateVaultDocInput): Promise<VaultDocRow> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO documents_vault
           (tenant_id, name, folder, mime_type, size_bytes, storage_path,
            related_type, related_id, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [ctx.tenantId, input.name, input.folder, input.mimeType, input.sizeBytes,
         input.storagePath, input.relatedType ?? null, input.relatedId ?? null, ctx.userId],
      );
      const docId = rows[0].id;
      await this.writeAuditAndEvent(c, ctx, 'document.uploaded', docId, {
        name: input.name, folder: input.folder, sizeBytes: input.sizeBytes,
      });
      const { rows: joined } = await c.query<VaultDocRow>(
        `${DOC_SELECT} WHERE d.id = $1`, [docId],
      );
      return joined[0];
    });
  }

  /** Soft delete — Storage nesnesi service katmanında ayrıca silinir. */
  async softDelete(ctx: RequestContext, id: string): Promise<VaultDocRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<VaultDocRow>(
        `UPDATE documents_vault SET deleted_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id, name, folder, mime_type, size_bytes, storage_path,
                    related_type, related_id, created_at, NULL AS uploaded_by_name`,
        [id],
      );
      if (rows.length === 0) return null;
      await this.writeAuditAndEvent(c, ctx, 'document.deleted', id, { name: rows[0].name });
      return rows[0];
    });
  }

  private async writeAuditAndEvent(
    c: PoolClient, ctx: RequestContext, action: string, entityId: string, diff: unknown,
  ): Promise<void> {
    await c.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
       VALUES ($1,$2,$3,'document',$4,$5,$6)`,
      [ctx.tenantId, ctx.userId, action, entityId, JSON.stringify(diff), ctx.correlationId],
    );
    await c.query(
      `INSERT INTO events (tenant_id, aggregate_type, aggregate_id, event_type, payload, correlation_id, created_by)
       VALUES ($1,'document',$2,$3,$4,$5,$6)`,
      [ctx.tenantId, entityId, action, JSON.stringify(diff), ctx.correlationId, ctx.userId],
    );
  }
}
