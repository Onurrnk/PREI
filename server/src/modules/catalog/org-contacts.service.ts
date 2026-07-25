// =====================================================================
// PREI | OrgContactsService — firma kişileri (unvanlı).
//
// Bir geliştiricide satış müdürü, mali işler, şantiye şefi ayrı kişiler
// ve her birinin unvanı var. Eskiden tek "kilit kişi" alanı vardı; kim
// olduğu belirsizdi. Artık liste, unvan zorunlu olmasa da öne çıkarılır.
//
// Birincil kişi: firma başına EN FAZLA bir tane (DB'de kısmi unique
// index zorluyor). Yeni birincil işaretlenince eskisi düşürülür.
// =====================================================================
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface OrgContactRow {
  id: string;
  organization_id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

export interface OrgContactResponse {
  id: string;
  organizationId: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
}

export interface OrgContactInput {
  fullName?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

const SELECT = `
  SELECT id, organization_id, full_name, title, email, phone, whatsapp,
         is_primary, notes, created_at::text
    FROM organization_contacts`;

export function toOrgContact(row: OrgContactRow): OrgContactResponse {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    isPrimary: row.is_primary,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** Boş metni null'a çevirir — '' ile null karışmasın (unique index'i etkiler). */
const trimOrNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

@Injectable()
export class OrgContactsService {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, organizationId: string): Promise<OrgContactResponse[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<OrgContactRow>(
        `${SELECT}
          WHERE organization_id = $1 AND deleted_at IS NULL
          ORDER BY is_primary DESC, full_name`,
        [organizationId],
      );
      return rows.map(toOrgContact);
    });
  }

  async create(
    ctx: RequestContext, organizationId: string, input: OrgContactInput,
  ): Promise<OrgContactResponse> {
    const fullName = trimOrNull(input.fullName);
    if (!fullName) throw new BadRequestException('Ad soyad zorunlu.');

    return this.db.withContext(ctx, async (c) => {
      // Firma gerçekten var mı — yoksa yetim kişi kaydı oluşmasın.
      const { rowCount: orgOk } = await c.query(
        `SELECT 1 FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
        [organizationId],
      );
      if (!orgOk) throw new NotFoundException('Firma bulunamadı.');

      if (input.isPrimary) await this.clearPrimary(c, organizationId);

      try {
        const { rows } = await c.query<OrgContactRow>(
          `INSERT INTO organization_contacts
             (tenant_id, organization_id, full_name, title, email, phone, whatsapp,
              is_primary, notes, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
           RETURNING id, organization_id, full_name, title, email, phone, whatsapp,
                     is_primary, notes, created_at::text`,
          [ctx.tenantId, organizationId, fullName, trimOrNull(input.title),
           trimOrNull(input.email), trimOrNull(input.phone), trimOrNull(input.whatsapp),
           input.isPrimary === true, trimOrNull(input.notes), ctx.userId],
        );
        return toOrgContact(rows[0]);
      } catch (e) {
        throw this.translate(e);
      }
    });
  }

  async update(
    ctx: RequestContext, id: string, input: OrgContactInput,
  ): Promise<OrgContactResponse> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: existing } = await c.query<{ organization_id: string }>(
        `SELECT organization_id FROM organization_contacts
          WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (existing.length === 0) throw new NotFoundException('Kişi bulunamadı.');

      if (input.isPrimary === true) {
        await this.clearPrimary(c, existing[0].organization_id, id);
      }

      // Yalnız GÖNDERİLEN alanlar değişsin — kısmi güncelleme diğerlerini silmesin.
      const sets: string[] = [];
      const params: unknown[] = [id];
      const push = (col: string, val: unknown) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };
      if (input.fullName !== undefined) {
        const n = trimOrNull(input.fullName);
        if (!n) throw new BadRequestException('Ad soyad boş bırakılamaz.');
        push('full_name', n);
      }
      if (input.title !== undefined) push('title', trimOrNull(input.title));
      if (input.email !== undefined) push('email', trimOrNull(input.email));
      if (input.phone !== undefined) push('phone', trimOrNull(input.phone));
      if (input.whatsapp !== undefined) push('whatsapp', trimOrNull(input.whatsapp));
      if (input.notes !== undefined) push('notes', trimOrNull(input.notes));
      if (input.isPrimary !== undefined) push('is_primary', input.isPrimary === true);
      if (sets.length === 0) throw new BadRequestException('Değiştirilecek alan yok.');
      params.push(ctx.userId);
      sets.push(`updated_by = $${params.length}`);

      try {
        const { rows } = await c.query<OrgContactRow>(
          `UPDATE organization_contacts SET ${sets.join(', ')}
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, organization_id, full_name, title, email, phone, whatsapp,
                      is_primary, notes, created_at::text`,
          params,
        );
        return toOrgContact(rows[0]);
      } catch (e) {
        throw this.translate(e);
      }
    });
  }

  async remove(ctx: RequestContext, id: string): Promise<{ deleted: true }> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE organization_contacts
            SET deleted_at = now(), updated_by = $2
          WHERE id = $1 AND deleted_at IS NULL`,
        [id, ctx.userId],
      );
      if (!rowCount) throw new NotFoundException('Kişi bulunamadı.');
      return { deleted: true };
    });
  }

  /** Firmanın mevcut birincilini düşürür (yeni birincil atanmadan önce). */
  private async clearPrimary(
    c: { query: (q: string, p: unknown[]) => Promise<unknown> },
    organizationId: string, exceptId?: string,
  ): Promise<void> {
    await c.query(
      `UPDATE organization_contacts SET is_primary = false
        WHERE organization_id = $1 AND is_primary AND deleted_at IS NULL
          AND ($2::uuid IS NULL OR id <> $2)`,
      [organizationId, exceptId ?? null],
    );
  }

  /** Postgres kısıt hatalarını kullanıcının anlayacağı mesaja çevirir. */
  private translate(e: unknown): Error {
    const err = e as { code?: string; constraint?: string };
    if (err.code === '23505' && err.constraint === 'uq_org_contacts_email') {
      return new ConflictException('Bu e-posta bu firmada zaten kayıtlı.');
    }
    if (err.code === '23505' && err.constraint === 'uq_org_contacts_primary') {
      return new ConflictException('Firmada zaten bir birincil kişi var.');
    }
    return e as Error;
  }
}
