// =====================================================================
// PREI | ClientsRepository — müşteri dizini (contacts üstünde, salt-okuma).
// Yatırım aggregate'leri deals(status='won')'dan EUR bazında (fx_to_eur);
// consultant = lead owner; son temas = communications. Müşteriye özgü alanlar
// (uyruk/tip/profil/bölge/statü) metadata jsonb'da (operasyonla dolar).
// =====================================================================
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { UpdateClientDto } from './dto/client-update.dto';

export interface ClientRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  total_investment_eur: string | null;
  active_properties: number;
  consultant: string | null;
  last_contact: string | null;
  // Son lead'in AI-çıkarımlı profili (Eylül extraction → leads.metadata.criteria)
  lead_budget_min: string | null;
  lead_budget_max: string | null;
  lead_currency: string | null;
  lead_criteria: Record<string, unknown> | null;
  lead_score: number | null;
}

export interface TimelineCommunicationRow {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string | null;
  time: string;
  score: number | null;
}

export interface NoteRow {
  id: string;
  raw_content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  author: string | null;
  author_role: string | null;
}

// İç not SELECT gövdesi — yazar adı/rolü users + user_roles'tan.
const NOTE_SELECT = `
  SELECT mn.id, mn.raw_content, mn.metadata, mn.created_at,
         u.full_name AS author,
         (SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id LIMIT 1) AS author_role
    FROM meeting_notes mn
    LEFT JOIN users u ON u.id = mn.created_by`;

// SELECT gövdesi (WHERE hariç) — list/detail kendi WHERE'ini ekler.
const CLIENT_SELECT = `
  SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.metadata, c.updated_at,
         COALESCE((SELECT SUM(fx.amount_eur)
            FROM deals d JOIN leads l ON l.id = d.lead_id
            LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
            WHERE l.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'won'), 0) AS total_investment_eur,
         (SELECT count(*)::int FROM deals d JOIN leads l ON l.id = d.lead_id
            WHERE l.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'won') AS active_properties,
         (SELECT u.full_name FROM leads l JOIN users u ON u.id = l.owner_id
            WHERE l.contact_id = c.id AND l.owner_id IS NOT NULL
            ORDER BY l.created_at DESC LIMIT 1) AS consultant,
         (SELECT max(cm.sent_at) FROM communications cm WHERE cm.contact_id = c.id) AS last_contact,
         ll.budget_min AS lead_budget_min,
         ll.budget_max AS lead_budget_max,
         ll.currency   AS lead_currency,
         ll.criteria   AS lead_criteria,
         ll.score      AS lead_score
    FROM contacts c
    LEFT JOIN LATERAL (
      SELECT l.budget_min, l.budget_max, l.currency,
             l.metadata->'criteria' AS criteria, l.score
        FROM leads l
       WHERE l.contact_id = c.id AND l.deleted_at IS NULL
       ORDER BY l.updated_at DESC LIMIT 1
    ) ll ON true`;

@Injectable()
export class ClientsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, limit = 200, offset = 0): Promise<ClientRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ClientRow>(
        `${CLIENT_SELECT}
          WHERE c.deleted_at IS NULL AND c.merged_into_id IS NULL
          ORDER BY c.updated_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    });
  }

  async findById(ctx: RequestContext, id: string): Promise<ClientRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<ClientRow>(
        `${CLIENT_SELECT} WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ?? null;
    });
  }

  /**
   * Profil güncelleme: iletişim alanları contacts kolonlarına, müşteriye özgü
   * alanlar (tip/statü/risk/kriterler/bölgeler) metadata jsonb merge'üne yazılır.
   * Mutasyon audit_log + events'e bağlı (F10); dönüş joined satır (desen).
   */
  async update(ctx: RequestContext, id: string, dto: UpdateClientDto): Promise<ClientRow | null> {
    return this.db.withContext(ctx, async (c) => {
      // İsim: son kelime soyad, kalanı ad (tek kelime → soyad boş).
      let firstName: string | null = null;
      let lastName: string | null = null;
      if (dto.name !== undefined) {
        const parts = dto.name.trim().split(/\s+/);
        lastName = parts.length > 1 ? parts.pop()! : null;
        firstName = parts.join(' ') || dto.name.trim();
      }

      // Metadata merge'üne girecek anahtarlar (yalnız gönderilenler).
      const meta: Record<string, unknown> = {};
      if (dto.type !== undefined) meta.client_type = dto.type;
      if (dto.nationality !== undefined) meta.nationality = dto.nationality;
      if (dto.relationshipStatus !== undefined) meta.relationship_status = dto.relationshipStatus;
      if (dto.investmentProfile !== undefined) meta.investment_profile = dto.investmentProfile;
      if (dto.source !== undefined) meta.source = dto.source;
      if (dto.assignedConsultant !== undefined) meta.assigned_consultant = dto.assignedConsultant;
      if (dto.preferredRegions !== undefined) meta.preferred_regions = dto.preferredRegions;
      if (dto.unitTypes !== undefined) meta.unit_types = dto.unitTypes;
      if (dto.purpose !== undefined) meta.purpose = dto.purpose;
      if (dto.budgetRange !== undefined) meta.budget_range = dto.budgetRange;
      if (dto.requirements !== undefined) meta.requirements = dto.requirements;

      const { rows } = await c.query<{ id: string }>(
        `UPDATE contacts SET
            first_name = COALESCE($2, first_name),
            last_name  = CASE WHEN $2 IS NULL THEN last_name ELSE $3 END,
            email      = COALESCE($4, email),
            phone      = COALESCE($5, phone),
            /* normalized_phone GENERATED — phone'dan kendisi türer, elle yazılamaz */
            metadata   = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
            updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [id, firstName, lastName, dto.email ?? null, dto.phone ?? null, JSON.stringify(meta)],
      );
      if (!rows[0]) return null;

      await this.writeAuditAndEvent(c, ctx, 'client.updated', id, dto);

      const { rows: joined } = await c.query<ClientRow>(
        `${CLIENT_SELECT} WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [id],
      );
      return joined[0] ?? null;
    });
  }

  // ================= İletişim zaman çizelgesi (communications) =================
  // Not: tasks.related_id, related_type='client' satırlarının çoğunda NULL
  // (yalnız denormalize related_name dolu) — toplantıları isimle eşlemek
  // yanlış-pozitife açık (danışman/müşteri adı çakışması) olduğundan burada
  // yalnız FK'si sağlam olan communications kullanılır.
  async listTimeline(ctx: RequestContext, contactId: string): Promise<TimelineCommunicationRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<TimelineCommunicationRow>(
        `SELECT cm.id, cm.channel::text AS channel, cm.direction::text AS direction,
                cm.subject, cm.body, COALESCE(cm.sent_at, cm.created_at) AS time,
                (SELECT ls.score FROM lead_scores ls
                   WHERE ls.lead_id = cm.lead_id
                     AND ls.created_at <= COALESCE(cm.sent_at, cm.created_at)
                   ORDER BY ls.created_at DESC LIMIT 1) AS score
           FROM communications cm
          WHERE cm.contact_id = $1
          ORDER BY time DESC LIMIT 100`,
        [contactId],
      );
      return rows;
    });
  }

  // ============ AI Analiz raporları (meeting_notes, kind='ai_analysis') ============
  // n8n analiz workflow'u markAnalysisSent ile yazar; ClientProfile sekmesi okur.
  async listAnalyses(ctx: RequestContext, contactId: string): Promise<Array<{
    id: string; subject: string; report: string; created_at: string;
  }>> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string; subject: string; report: string; created_at: string }>(
        `SELECT id,
                COALESCE(metadata->>'subject', 'Görüşme Analizi') AS subject,
                COALESCE(raw_content, '') AS report,
                created_at
           FROM meeting_notes
          WHERE contact_id = $1 AND deleted_at IS NULL
            AND metadata->>'kind' = 'ai_analysis'
          ORDER BY created_at DESC LIMIT 20`,
        [contactId],
      );
      return rows;
    });
  }

  // ================= İç notlar (meeting_notes, source='text') =================

  async listNotes(ctx: RequestContext, contactId: string): Promise<NoteRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<NoteRow>(
        `${NOTE_SELECT}
          WHERE mn.contact_id = $1 AND mn.deleted_at IS NULL
          ORDER BY mn.created_at DESC LIMIT 100`,
        [contactId],
      );
      return rows;
    });
  }

  async createNote(
    ctx: RequestContext, contactId: string, text: string, tag: string,
  ): Promise<NoteRow> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO meeting_notes (tenant_id, contact_id, source_type, raw_content, metadata, created_by)
         VALUES ($1, $2, 'text', $3, $4::jsonb, $5)
         RETURNING id`,
        [ctx.tenantId, contactId, text, JSON.stringify({ tag, channel: 'internal' }), ctx.userId],
      );
      const noteId = rows[0].id;
      await this.writeAuditAndEvent(c, ctx, 'client.note_created', contactId, { noteId, tag });
      const { rows: joined } = await c.query<NoteRow>(
        `${NOTE_SELECT} WHERE mn.id = $1`,
        [noteId],
      );
      return joined[0];
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
