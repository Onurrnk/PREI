// =====================================================================
// PREI | PresentedService — "bu müşteriye ne sunduk" kaydı.
//
// Kritik davranış: aşama 'sold' olunca GERÇEK anlaşma (deals) kaydı doğar.
// Böylece Komuta Merkezi'ndeki "Kapanan Satış" tek doğru kaynaktan
// (deals.status='won') beslenir ve 003i tetikleyicisi kişiyi otomatik
// müşteriye çevirir. Aşama 'sold'dan çıkarsa anlaşma geri 'open' olur —
// yanlış tıklama kalıcı sahte ciro bırakmaz.
// =====================================================================
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import type { RequestContext } from '../../../common/request-context';
import {
  normalizePresented, isSold, stageLabel,
  type PresentedInput, type PresentedStage,
} from './presented.model';

export interface PresentedRow {
  id: string;
  contact_id: string;
  lead_id: string | null;
  property_id: string | null;
  property_title: string | null;
  property_city: string | null;
  external_title: string | null;
  external_listing_no: string | null;
  external_url: string | null;
  external_source: string | null;
  location: string | null;
  features: string | null;
  price: string | null;
  currency: string;
  stage: string;
  notes: string | null;
  presented_at: string;
  deal_id: string | null;
}

export interface PresentedResponse {
  id: string;
  source: 'project' | 'listing';
  /** Gösterilecek ad — iç projede proje adı, dış ilanda başlık. */
  title: string;
  propertyId: string | null;
  listingNo: string | null;
  url: string | null;
  listingSource: string | null;
  location: string | null;
  features: string | null;
  price: number | null;
  currency: string;
  stage: PresentedStage;
  stageLabel: string;
  notes: string | null;
  presentedAt: string;
  dealId: string | null;
}

const SELECT = `
  SELECT pp.id, pp.contact_id, pp.lead_id, pp.property_id,
         p.title AS property_title, p.city AS property_city,
         pp.external_title, pp.external_listing_no, pp.external_url,
         pp.external_source, pp.location, pp.features, pp.price, pp.currency,
         pp.stage, pp.notes, pp.presented_at::text, pp.deal_id
    FROM presented_properties pp
    LEFT JOIN properties p ON p.id = pp.property_id`;

export function toPresented(row: PresentedRow): PresentedResponse {
  const isProject = !!row.property_id;
  return {
    id: row.id,
    source: isProject ? 'project' : 'listing',
    title: (isProject ? row.property_title : row.external_title) ?? '—',
    propertyId: row.property_id,
    listingNo: row.external_listing_no,
    url: row.external_url,
    listingSource: row.external_source,
    location: row.location ?? row.property_city,
    features: row.features,
    price: row.price == null ? null : Number(row.price),
    currency: row.currency,
    stage: row.stage as PresentedStage,
    stageLabel: stageLabel(row.stage as PresentedStage),
    notes: row.notes,
    presentedAt: row.presented_at,
    dealId: row.deal_id,
  };
}

@Injectable()
export class PresentedService {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, contactId: string): Promise<PresentedResponse[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<PresentedRow>(
        `${SELECT} WHERE pp.contact_id = $1 AND pp.deleted_at IS NULL
          ORDER BY pp.presented_at DESC`,
        [contactId],
      );
      return rows.map(toPresented);
    });
  }

  async create(
    ctx: RequestContext, contactId: string, input: PresentedInput,
  ): Promise<PresentedResponse> {
    const norm = normalizePresented(input);
    if (!norm.ok) throw new BadRequestException(norm.error);
    const v = norm.value;

    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `SELECT 1 FROM contacts WHERE id = $1 AND deleted_at IS NULL`, [contactId]);
      if (!rowCount) throw new NotFoundException('Kişi bulunamadı.');

      let id: string;
      try {
        const { rows } = await c.query<{ id: string }>(
          `INSERT INTO presented_properties
             (tenant_id, contact_id, lead_id, property_id, external_title,
              external_listing_no, external_url, external_source, location,
              features, price, currency, stage, notes, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
           RETURNING id`,
          [ctx.tenantId, contactId, v.leadId, v.propertyId, v.externalTitle,
           v.externalListingNo, v.externalUrl, v.externalSource, v.location,
           v.features, v.price, v.currency, v.stage, v.notes, ctx.userId],
        );
        id = rows[0].id;
      } catch (e) {
        // Aynı projeyi aynı kişiye iki kez eklemeye çalışmak yaygın hata.
        if ((e as { code?: string }).code === '23505') {
          throw new BadRequestException('Bu proje bu müşteriye zaten sunulmuş.');
        }
        throw e;
      }

      if (isSold(v.stage)) await this.syncDeal(c, ctx, id);
      await this.audit(c, ctx, 'presented.created', id, { stage: v.stage });
      return this.byId(c, id);
    });
  }

  async update(
    ctx: RequestContext, contactId: string, id: string, input: PresentedInput,
  ): Promise<PresentedResponse> {
    const norm = normalizePresented(input);
    if (!norm.ok) throw new BadRequestException(norm.error);
    const v = norm.value;

    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE presented_properties SET
           lead_id = $3, property_id = $4, external_title = $5,
           external_listing_no = $6, external_url = $7, external_source = $8,
           location = $9, features = $10, price = $11, currency = $12,
           stage = $13, notes = $14, updated_by = $15, updated_at = now(),
           version = version + 1
         WHERE id = $2 AND contact_id = $1 AND deleted_at IS NULL`,
        [contactId, id, v.leadId, v.propertyId, v.externalTitle,
         v.externalListingNo, v.externalUrl, v.externalSource, v.location,
         v.features, v.price, v.currency, v.stage, v.notes, ctx.userId],
      );
      if (!rowCount) throw new NotFoundException('Sunum kaydı bulunamadı.');

      // Aşama satışa döndüyse anlaşma doğar; satıştan çıktıysa geri alınır.
      await this.syncDeal(c, ctx, id);
      await this.audit(c, ctx, 'presented.updated', id, { stage: v.stage });
      return this.byId(c, id);
    });
  }

  async remove(
    ctx: RequestContext, contactId: string, id: string,
  ): Promise<{ deleted: true }> {
    return this.db.withContext(ctx, async (c) => {
      const { rowCount } = await c.query(
        `UPDATE presented_properties SET deleted_at = now(), updated_by = $3
          WHERE id = $2 AND contact_id = $1 AND deleted_at IS NULL`,
        [contactId, id, ctx.userId],
      );
      if (!rowCount) throw new NotFoundException('Sunum kaydı bulunamadı.');
      await this.audit(c, ctx, 'presented.deleted', id, {});
      return { deleted: true };
    });
  }

  /**
   * Aşama ↔ anlaşma senkronu.
   *
   * stage='sold'  → deal yoksa oluştur, varsa 'won' yap (kapanan ciroya girer)
   * stage≠'sold'  → bağlı deal varsa 'open'a çek (sahte ciro kalmasın)
   *
   * Tutar sunum fiyatından gelir; fiyat yoksa 0 (ciroyu şişirmemek için).
   */
  private async syncDeal(c: PoolClient, ctx: RequestContext, id: string): Promise<void> {
    const { rows } = await c.query<{
      stage: string; deal_id: string | null; price: string | null;
      currency: string; lead_id: string | null; property_id: string | null;
      title: string | null; external_title: string | null;
    }>(
      `SELECT pp.stage, pp.deal_id, pp.price, pp.currency, pp.lead_id,
              pp.property_id, p.title, pp.external_title
         FROM presented_properties pp
         LEFT JOIN properties p ON p.id = pp.property_id
        WHERE pp.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) return;

    const sold = isSold(r.stage as PresentedStage);

    if (!sold) {
      if (r.deal_id) {
        await c.query(
          `UPDATE deals SET status = 'open', closed_at = NULL,
                            updated_by = $2, updated_at = now()
            WHERE id = $1 AND deleted_at IS NULL`,
          [r.deal_id, ctx.userId],
        );
      }
      return;
    }

    const amount = r.price == null ? 0 : Number(r.price);
    const title = r.title ?? r.external_title ?? 'Satış';

    if (r.deal_id) {
      await c.query(
        `UPDATE deals SET status = 'won', amount = $2, currency = $3,
                          closed_at = now(), updated_by = $4, updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL`,
        [r.deal_id, amount, r.currency, ctx.userId],
      );
      return;
    }

    // deals.lead_id zorunlu — sunumda lead yoksa kişinin en güncel lead'i.
    const { rows: lead } = await c.query<{ id: string }>(
      `SELECT COALESCE($2::uuid, (
         SELECT l.id FROM leads l
           JOIN presented_properties pp ON pp.contact_id = l.contact_id
          WHERE pp.id = $1 AND l.deleted_at IS NULL
          ORDER BY l.updated_at DESC LIMIT 1
       )) AS id`,
      [id, r.lead_id],
    );
    const leadId = lead[0]?.id;
    if (!leadId) return;   // lead yoksa anlaşma açılamaz (FK) — sessiz geç

    const { rows: created } = await c.query<{ id: string }>(
      `INSERT INTO deals (tenant_id, lead_id, property_id, title, status,
                          amount, currency, closed_at, created_by, updated_by)
       VALUES ($1,$2,$3,$4,'won',$5,$6, now(), $7,$7)
       RETURNING id`,
      [ctx.tenantId, leadId, r.property_id, title, amount, r.currency, ctx.userId],
    );
    await c.query(
      `UPDATE presented_properties SET deal_id = $2 WHERE id = $1`,
      [id, created[0].id],
    );
  }

  private async byId(c: PoolClient, id: string): Promise<PresentedResponse> {
    const { rows } = await c.query<PresentedRow>(`${SELECT} WHERE pp.id = $1`, [id]);
    return toPresented(rows[0]);
  }

  private async audit(
    c: PoolClient, ctx: RequestContext, action: string, id: string, diff: unknown,
  ): Promise<void> {
    await c.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
       VALUES ($1,$2,$3,'presented_property',$4,$5,$6)`,
      [ctx.tenantId, ctx.userId, action, id, JSON.stringify(diff), ctx.correlationId],
    );
  }
}
