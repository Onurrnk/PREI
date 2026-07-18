// =====================================================================
// PREI | ContactsRepository — RLS bağlamında kişi (person master) CRUD.
// create: telefon varsa normalized_phone ile dedup (mükerrer kişi engeli,
// agent upsert'iyle aynı ilke). Mutasyon audit_log + events'e bağlı (F10).
// =====================================================================
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { CreateContactDto } from './dto/contact.dto';

export interface ContactRow {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  preferred_lang: string;
  marketing_consent: boolean;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ContactsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, search?: string, limit = 50, offset = 0): Promise<ContactRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const term = search?.trim();
      if (term) {
        const like = `%${term}%`;
        const digits = term.replace(/[^0-9]/g, '');
        const { rows } = await c.query<ContactRow>(
          `SELECT * FROM contacts
             WHERE deleted_at IS NULL AND merged_into_id IS NULL
               AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1
                    OR ($2 <> '' AND normalized_phone LIKE '%' || $2 || '%'))
             ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
          [like, digits, limit, offset],
        );
        return rows;
      }
      const { rows } = await c.query<ContactRow>(
        `SELECT * FROM contacts
           WHERE deleted_at IS NULL AND merged_into_id IS NULL
           ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    });
  }

  async findById(ctx: RequestContext, id: string): Promise<ContactRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ContactRow>(
        `SELECT * FROM contacts WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      return rows[0] ?? null;
    });
  }

  async create(ctx: RequestContext, dto: CreateContactDto): Promise<ContactRow> {
    return this.db.withContext(ctx, async (c) => {
      // Dedup: telefon verildiyse aynı normalized_phone'lu aktif kişiyi döndür.
      const normalized = (dto.phone ?? '').replace(/[^0-9]/g, '');
      if (normalized) {
        const { rows: existing } = await c.query<ContactRow>(
          `SELECT * FROM contacts
             WHERE tenant_id = $1 AND normalized_phone = $2
               AND deleted_at IS NULL AND merged_into_id IS NULL
             LIMIT 1`,
          [ctx.tenantId, normalized],
        );
        if (existing.length > 0) return existing[0];
      }

      const { rows } = await c.query<ContactRow>(
        `INSERT INTO contacts
           (tenant_id, first_name, last_name, email, phone, whatsapp,
            preferred_lang, marketing_consent, notes, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7,'tr'), COALESCE($8,false), $9, $10,$10)
         RETURNING *`,
        [
          ctx.tenantId, dto.first_name, dto.last_name ?? null, dto.email ?? null,
          dto.phone ?? null, dto.whatsapp ?? null, dto.preferred_lang ?? null,
          dto.marketing_consent ?? null, dto.notes ?? null, ctx.userId,
        ],
      );
      const contact = rows[0];
      await this.writeAuditAndEvent(c, ctx, 'contact.created', contact.id, { after: contact });
      return contact;
    });
  }

  /**
   * KALICI silme (super_admin). Kişi + tüm lead'leri + iletişim izleri tek
   * transaction'da temizlenir ("sıfırdan başla" senaryosu — telefon dedup'ı
   * eski kaydı bulmasın diye HARD delete). Gerçek iş verisi korunur:
   * deal/financial/contract bağı varsa 'has_business' döner (409).
   * Silme sırası FK yönünde: proposals → meeting_notes → activities →
   * communications → conversation_sessions → leads (cascade) → merged
   * referansları → contact. audit_log'a 'contact.deleted' düşer (o kalıcı).
   */
  async remove(ctx: RequestContext, id: string): Promise<'ok' | 'not_found' | 'has_business'> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: before } = await c.query<ContactRow>(
        `SELECT * FROM contacts WHERE id = $1`, [id],
      );
      if (before.length === 0) return 'not_found';

      const { rows: biz } = await c.query<{ n: number }>(
        `SELECT (SELECT count(*) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.contact_id = $1)
              + (SELECT count(*) FROM financials WHERE contact_id = $1)
              + (SELECT count(*) FROM contracts  WHERE contact_id = $1) AS n`,
        [id],
      );
      if (Number(biz[0].n) > 0) return 'has_business';

      await c.query(
        `DELETE FROM proposals
          WHERE contact_id = $1 OR lead_id IN (SELECT id FROM leads WHERE contact_id = $1)`,
        [id],
      );
      await c.query(`DELETE FROM meeting_notes WHERE contact_id = $1`, [id]);
      await c.query(`DELETE FROM activities WHERE contact_id = $1`, [id]);
      await c.query(`DELETE FROM communications WHERE contact_id = $1`, [id]);
      await c.query(`DELETE FROM conversation_sessions WHERE contact_id = $1`, [id]);
      await c.query(`DELETE FROM leads WHERE contact_id = $1`, [id]);
      await c.query(`UPDATE contacts SET merged_into_id = NULL WHERE merged_into_id = $1`, [id]);
      await c.query(`DELETE FROM contacts WHERE id = $1`, [id]);

      await this.writeAuditAndEvent(c, ctx, 'contact.deleted', id, { before: before[0] });
      return 'ok';
    });
  }

  /** audit_log (forensics) + events (outbox) — aynı transaction, correlation_id bağlı. */
  private async writeAuditAndEvent(
    c: PoolClient, ctx: RequestContext, action: string, entityId: string, diff: unknown,
  ): Promise<void> {
    await c.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
       VALUES ($1,$2,$3,'contact',$4,$5,$6)`,
      [ctx.tenantId, ctx.userId, action, entityId, JSON.stringify(diff), ctx.correlationId],
    );
    await c.query(
      `INSERT INTO events (tenant_id, aggregate_type, aggregate_id, event_type, payload, correlation_id, created_by)
       VALUES ($1,'contact',$2,$3,$4,$5,$6)`,
      [ctx.tenantId, entityId, action, JSON.stringify(diff), ctx.correlationId, ctx.userId],
    );
  }
}
