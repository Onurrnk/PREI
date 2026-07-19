// =====================================================================
// PREI | IntakeRepository — davet linkleri + gönderi (onay kuyruğu).
// Davet yönetimi + onay kuyruğu ayrıcalıklı bağlamda (RLS: app_is_privileged).
// Public submit service_agent bağlamında INSERT (RLS: service_insert).
// Token doğrulama/kullanım sayacı DatabaseService.raw (sistem, RLS-bypass).
// Onay → gerçek `properties` satırı + broşür için documents_vault kaydı.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface InviteRow {
  id: string; developer_id: string | null; developer_name: string | null;
  token: string; label: string | null; expires_at: string | null;
  revoked_at: string | null; max_uses: number | null; used_count: number; created_at: string;
}

export interface SubmissionRow {
  id: string; status: string; title: string; city: string | null; district: string | null;
  market_code: string | null; price_min: string | null; price_max: string | null; currency: string;
  commission_pct: string | null; unit_types: string[]; description: string | null;
  latitude: string | null; longitude: string | null;
  image_urls: string[]; brochure_path: string | null; payload: Record<string, unknown>;
  developer_id: string | null; developer_name: string | null;
  created_property_id: string | null; review_note: string | null; created_at: string;
}

const SUBMISSION_SELECT = `
  SELECT s.id, s.status, s.title, s.city, s.district, s.market_code,
         s.price_min, s.price_max, s.currency, s.commission_pct, s.unit_types,
         s.description, s.latitude, s.longitude, s.image_urls, s.brochure_path, s.payload,
         s.developer_id, o.name AS developer_name,
         s.created_property_id, s.review_note, s.created_at
    FROM project_submissions s
    LEFT JOIN organizations o ON o.id = s.developer_id`;

@Injectable()
export class IntakeRepository {
  constructor(private readonly db: DatabaseService) {}

  // ---- Davet linkleri (ayrıcalıklı) ----
  async createInvite(
    ctx: RequestContext,
    input: { developerId: string | null; label: string | null; token: string; expiresAt: string | null; maxUses: number | null },
  ): Promise<InviteRow> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO project_invites (tenant_id, developer_id, label, token, expires_at, max_uses, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [ctx.tenantId, input.developerId, input.label, input.token, input.expiresAt, input.maxUses, ctx.userId],
      );
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project_invite.created','project_invite',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, rows[0].id, JSON.stringify({ developerId: input.developerId }), ctx.correlationId],
      );
      return this.getInvite(ctx, rows[0].id) as Promise<InviteRow>;
    });
  }

  async getInvite(ctx: RequestContext, id: string): Promise<InviteRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<InviteRow>(
        `SELECT i.id, i.developer_id, o.name AS developer_name, i.token, i.label,
                i.expires_at, i.revoked_at, i.max_uses, i.used_count, i.created_at
           FROM project_invites i LEFT JOIN organizations o ON o.id = i.developer_id
          WHERE i.id = $1`,
        [id],
      );
      return rows[0] ?? null;
    });
  }

  async listInvites(ctx: RequestContext): Promise<InviteRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<InviteRow>(
        `SELECT i.id, i.developer_id, o.name AS developer_name, i.token, i.label,
                i.expires_at, i.revoked_at, i.max_uses, i.used_count, i.created_at
           FROM project_invites i LEFT JOIN organizations o ON o.id = i.developer_id
          ORDER BY i.created_at DESC LIMIT 200`,
      );
      return rows;
    });
  }

  async revokeInvite(ctx: RequestContext, id: string): Promise<boolean> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `UPDATE project_invites SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id`,
        [id],
      );
      return !!rows[0];
    });
  }

  /** Token kullanım sayacı — sistem sorgusu (submit service_agent'ın invites'a yetkisi yok). */
  async incrementInviteUse(inviteId: string): Promise<void> {
    await this.db.raw(`UPDATE project_invites SET used_count = used_count + 1 WHERE id = $1`, [inviteId]);
  }

  // ---- Gönderi (public submit — service_agent bağlamı) ----
  async insertSubmission(
    ctx: RequestContext,
    s: {
      id: string; inviteId: string; developerId: string | null; title: string;
      city: string | null; district: string | null; marketCode: string | null;
      priceMin: number | null; priceMax: number | null; currency: string;
      commissionPct: number | null; unitTypes: string[]; description: string | null;
      latitude: number | null; longitude: number | null;
      imageUrls: string[]; brochurePath: string | null; payload: Record<string, unknown>; ip: string | null;
    },
  ): Promise<void> {
    await this.db.withContext(ctx, async (c) => {
      await c.query(
        `INSERT INTO project_submissions
           (id, tenant_id, invite_id, developer_id, status, title, city, district, market_code,
            price_min, price_max, currency, commission_pct, unit_types, description,
            latitude, longitude, image_urls, brochure_path, payload, submitted_ip)
         VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          s.id, ctx.tenantId, s.inviteId, s.developerId, s.title, s.city, s.district, s.marketCode,
          s.priceMin, s.priceMax, s.currency, s.commissionPct, s.unitTypes, s.description,
          s.latitude, s.longitude, s.imageUrls, s.brochurePath, JSON.stringify(s.payload), s.ip,
        ],
      );
    });
  }

  // ---- Onay kuyruğu (ayrıcalıklı) ----
  async listSubmissions(ctx: RequestContext, status = 'pending'): Promise<SubmissionRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<SubmissionRow>(
        `${SUBMISSION_SELECT} WHERE s.status = $1 ORDER BY s.created_at DESC LIMIT 200`,
        [status],
      );
      return rows;
    });
  }

  async getSubmission(ctx: RequestContext, id: string): Promise<SubmissionRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<SubmissionRow>(`${SUBMISSION_SELECT} WHERE s.id = $1`, [id]);
      return rows[0] ?? null;
    });
  }

  async pendingCount(ctx: RequestContext): Promise<number> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM project_submissions WHERE status = 'pending'`,
      );
      return Number(rows[0].n);
    });
  }

  /** Onayla → gerçek properties satırı + broşür documents_vault kaydı; gönderiyi işaretle. */
  async approve(ctx: RequestContext, id: string): Promise<{ propertyId: string } | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: subs } = await c.query<SubmissionRow>(
        `${SUBMISSION_SELECT} WHERE s.id = $1 AND s.status = 'pending'`,
        [id],
      );
      const s = subs[0];
      if (!s) return null;

      const priceMin = s.price_min != null ? Number(s.price_min) : null;
      const priceMax = s.price_max != null ? Number(s.price_max) : null;
      const payload = (s.payload ?? {}) as Record<string, unknown>;

      // Ödeme planı → katalogun kendi şemasına (PaymentPlanRowDto: milestone/
      // percentage/date) çevrilir; ProjectProfile bunu doğal olarak gösterir.
      const dp = payload.downPaymentPct != null ? Number(payload.downPaymentPct) : null;
      const months = payload.installmentMonths != null ? Number(payload.installmentMonths) : null;
      const paymentPlan: Array<{ milestone: string; percentage: number; date: string }> = [];
      if (dp != null && dp > 0) {
        paymentPlan.push({ milestone: 'Ön Ödeme', percentage: dp, date: '' });
        if (dp < 100) {
          paymentPlan.push({
            milestone: months && months > 0 ? `Taksit (${months} ay)` : 'Kalan',
            percentage: Math.round((100 - dp) * 100) / 100,
            date: '',
          });
        }
      }

      const metadata: Record<string, unknown> = {
        project_status: 'Off-plan',
        images: s.image_urls,
        images_by_category: payload.imagesByCategory ?? {},
        payment_plan: paymentPlan,
        payment_note: payload.paymentNote ?? null,
        price_min: priceMin,
        price_max: priceMax,
        commission_pct: s.commission_pct != null ? Number(s.commission_pct) : null,
        unit_types: s.unit_types,
        source: 'developer_submission',
        submission_id: s.id,
        developer_name: s.developer_name,
        completion_date: payload.completionDate ?? null,
        listing_url: payload.listingUrl ?? null,
      };

      const { rows: prop } = await c.query<{ id: string }>(
        `INSERT INTO properties (tenant_id, developer_id, title, property_type, city, district, address,
            market_code, price, currency, description, latitude, longitude, metadata, created_by, updated_by)
         VALUES ($1,$2,$3,'apartment',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING id`,
        [
          ctx.tenantId, s.developer_id, s.title, s.city, s.district,
          (payload.neighborhood as string) ?? null,
          s.market_code, priceMin ?? priceMax, s.currency, s.description,
          s.latitude != null ? Number(s.latitude) : null,
          s.longitude != null ? Number(s.longitude) : null,
          JSON.stringify(metadata), ctx.userId,
        ],
      );
      const propertyId = prop[0].id;

      // Broşür → documents_vault (proje ile ilişkili). Boyut/isim payload'dan.
      if (s.brochure_path) {
        const p = payload as Record<string, unknown>;
        await c.query(
          `INSERT INTO documents_vault (tenant_id, name, folder, mime_type, size_bytes, storage_path, related_type, related_id, uploaded_by)
           VALUES ($1,$2,'Developer Agreements','application/pdf',$3,$4,'project',$5,$6)`,
          [
            ctx.tenantId, (p.brochureName as string) ?? `${s.title} broşür.pdf`,
            Number(p.brochureSize ?? 0), s.brochure_path, propertyId, ctx.userId,
          ],
        );
      }

      await c.query(
        `UPDATE project_submissions
            SET status = 'approved', created_property_id = $2, reviewed_by = $3, reviewed_at = now()
          WHERE id = $1`,
        [id, propertyId, ctx.userId],
      );
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project_submission.approved','project_submission',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ propertyId }), ctx.correlationId],
      );
      return { propertyId };
    });
  }

  // ---- Faz 2: proje→müşteri bildirim eşleşmesi (n8n digest, service_agent) ----
  async notificationCandidates(ctx: RequestContext): Promise<Array<{
    contact_id: string; name: string; email: string; lang: string;
    property_id: string; title: string; city: string | null; market_code: string | null;
    currency: string; price_min: string | null; price_max: string | null;
    latitude: string | null; longitude: string | null;
  }>> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query(
        `SELECT c.id AS contact_id,
                trim(c.first_name || ' ' || COALESCE(c.last_name,'')) AS name,
                c.email, COALESCE(c.preferred_lang,'tr') AS lang,
                p.id AS property_id, p.title, p.city, p.market_code, p.currency,
                (p.metadata->>'price_min') AS price_min,
                (p.metadata->>'price_max') AS price_max,
                p.latitude, p.longitude
           FROM properties p
           JOIN contacts c ON c.tenant_id = p.tenant_id
                          AND c.deleted_at IS NULL AND c.merged_into_id IS NULL
                          AND c.marketing_consent = true
                          AND c.email IS NOT NULL AND c.email <> ''
           JOIN LATERAL (
             SELECT l.target_market_code, l.budget_min, l.budget_max, l.currency AS lead_currency
               FROM leads l
              WHERE l.contact_id = c.id AND l.deleted_at IS NULL
              ORDER BY l.updated_at DESC LIMIT 1
           ) ll ON true
          WHERE p.deleted_at IS NULL
            AND (p.metadata->>'source') = 'developer_submission'
            AND p.created_at > now() - interval '30 days'
            AND p.market_code IS NOT NULL
            AND ll.target_market_code = p.market_code
            AND (
              ll.lead_currency IS DISTINCT FROM p.currency
              OR (
                (ll.budget_max IS NULL OR (p.metadata->>'price_min') IS NULL OR ll.budget_max >= (p.metadata->>'price_min')::numeric)
                AND (ll.budget_min IS NULL OR (p.metadata->>'price_max') IS NULL OR ll.budget_min <= (p.metadata->>'price_max')::numeric)
              )
            )
            AND NOT EXISTS (
              SELECT 1 FROM project_client_notifications n
               WHERE n.property_id = p.id AND n.contact_id = c.id
            )
          ORDER BY c.id, p.created_at DESC`,
      );
      return rows as never;
    });
  }

  async markNotified(ctx: RequestContext, contactId: string, propertyIds: string[]): Promise<number> {
    if (propertyIds.length === 0) return 0;
    return this.db.withContext(ctx, async (c) => {
      let n = 0;
      for (const pid of propertyIds) {
        const { rowCount } = await c.query(
          `INSERT INTO project_client_notifications (tenant_id, property_id, contact_id)
           VALUES ($1,$2,$3) ON CONFLICT (property_id, contact_id) DO NOTHING`,
          [ctx.tenantId, pid, contactId],
        );
        n += rowCount ?? 0;
      }
      return n;
    });
  }

  // ---- Geliştirici atıf bildirimi (komisyon koruması) ----
  async developerAttributionCandidates(ctx: RequestContext): Promise<Array<{
    developer_id: string; developer_name: string | null; developer_email: string;
    property_id: string; project_title: string; contact_id: string;
    investor_name: string; investor_phone: string | null; investor_city: string | null;
    sent_at: string;
  }>> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query(
        `SELECT o.id AS developer_id, o.name AS developer_name, o.email AS developer_email,
                p.id AS property_id, p.title AS project_title,
                c.id AS contact_id,
                trim(c.first_name || ' ' || COALESCE(c.last_name,'')) AS investor_name,
                c.phone AS investor_phone,
                COALESCE(ll.pref_city, mk.name, p.city) AS investor_city,
                n.sent_at
           FROM project_client_notifications n
           JOIN properties p ON p.id = n.property_id
           JOIN organizations o ON o.id = p.developer_id
                               AND o.email IS NOT NULL AND o.email <> ''
           JOIN contacts c ON c.id = n.contact_id
           LEFT JOIN LATERAL (
             SELECT l.pref_city, l.target_market_code FROM leads l
              WHERE l.contact_id = c.id AND l.deleted_at IS NULL
              ORDER BY l.updated_at DESC LIMIT 1
           ) ll ON true
           LEFT JOIN markets mk ON mk.code = ll.target_market_code
          WHERE n.developer_notified_at IS NULL
          ORDER BY o.id, n.sent_at DESC`,
      );
      return rows as never;
    });
  }

  async markDeveloperNotified(ctx: RequestContext, pairs: Array<{ propertyId: string; contactId: string }>): Promise<number> {
    if (pairs.length === 0) return 0;
    return this.db.withContext(ctx, async (c) => {
      let n = 0;
      for (const p of pairs) {
        const { rowCount } = await c.query(
          `UPDATE project_client_notifications SET developer_notified_at = now()
            WHERE property_id = $1 AND contact_id = $2 AND developer_notified_at IS NULL`,
          [p.propertyId, p.contactId],
        );
        n += rowCount ?? 0;
      }
      return n;
    });
  }

  async reject(ctx: RequestContext, id: string, note: string | null): Promise<boolean> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `UPDATE project_submissions
            SET status = 'rejected', review_note = $2, reviewed_by = $3, reviewed_at = now()
          WHERE id = $1 AND status = 'pending' RETURNING id`,
        [id, note, ctx.userId],
      );
      if (!rows[0]) return false;
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'project_submission.rejected','project_submission',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ note }), ctx.correlationId],
      );
      return true;
    });
  }
}
