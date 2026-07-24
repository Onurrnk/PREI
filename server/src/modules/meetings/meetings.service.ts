// =====================================================================
// PREI | MeetingsService — tasks(task_type='meeting') → MeetingDTO.
// date=due_date; client=related_name; yer/platform/süre/tür metadata'dan.
// =====================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { CreateMeetingDto } from './dto/create-meeting.dto';
import type { UpdateMeetingDto } from './dto/update-meeting.dto';
import { GoogleCalendarService, parseDurationMinutes } from '../auth/google-calendar.service';
import { isGmailAuthError, isGmailScopeError } from '../gmail/gmail.service';

interface MeetingRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  related_name: string | null;
  metadata: Record<string, unknown> | null;
}

export interface MeetingResponse {
  id: string;
  title: string;
  date: string | null;        // ISO (due_date)
  durationLabel: string;      // metadata.duration ör. '1h'
  client: string;
  location: string;
  platform: string;
  phone: string;
  notes: string;
  kind: string;               // viewing | signing | meeting
  // Google Takvim senkron durumu: synced | reauth | failed | skipped (bağlı Gmail yok)
  gcalSync: string;
  gcalLink: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const PLATFORM_TR: Record<string, string> = { 'In-person': 'Yüz yüze', Zoom: 'Zoom', Phone: 'Telefon' };
const KIND_TR: Record<string, string> = { meeting: 'Görüşme', viewing: 'Mülk Gezisi', signing: 'Sözleşme İmzası' };

/** Google Takvim etkinliği için tam açıklama — telefondaki takvim uygulamasında
 *  her detay (tür/müşteri/platform/adres-link-telefon/not) eksiksiz görünür;
 *  sonda PREI linki (isteyen daha fazla detay için PREI'ye bağlanır). */
export function buildEventDescription(dto: {
  kind?: string; client?: string; clientEmail?: string; platform?: string;
  phone?: string; location?: string; notes?: string;
}): string {
  const platform = dto.platform ?? 'In-person';
  const lines = [
    `Tür: ${KIND_TR[dto.kind ?? 'meeting'] ?? 'Görüşme'}`,
    dto.client?.trim() ? `Müşteri: ${dto.client.trim()}` : null,
    dto.clientEmail?.trim() ? `E-posta: ${dto.clientEmail.trim()}` : null,
    `Platform: ${PLATFORM_TR[platform] ?? platform}`,
    platform === 'Phone' && dto.phone?.trim() ? `Telefon: ${dto.phone.trim()}` : null,
    platform === 'Zoom' && dto.location?.trim() ? `Zoom: ${dto.location.trim()}` : null,
    platform === 'In-person' && dto.location?.trim() ? `Adres: ${dto.location.trim()}` : null,
    dto.notes?.trim() ? `\nNot: ${dto.notes.trim()}` : null,
    `\n— PREI’de görüntüle: https://prei.produality.com/meetings`,
  ];
  return lines.filter(Boolean).join('\n');
}

/** Google Takvim 'location' alanı: yüz yüzede adres (Google haritada gösterir),
 *  Zoom'da link, telefonda numara. */
export function buildEventLocation(dto: { platform?: string; location?: string; phone?: string }): string | null {
  const platform = dto.platform ?? 'In-person';
  if (platform === 'Phone') return dto.phone?.trim() ? `Telefon: ${dto.phone.trim()}` : null;
  return dto.location?.trim() || null;
}

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  async list(ctx: RequestContext): Promise<MeetingResponse[]> {
    const rows = await this.db.withContext(ctx, async (c) => {
      const res = await c.query<MeetingRow>(
        `SELECT id, title, description, due_date, related_name, metadata
           FROM tasks
          WHERE deleted_at IS NULL AND task_type = 'meeting'
          ORDER BY due_date ASC NULLS LAST`,
      );
      return res.rows;
    });
    return rows.map((r) => this.toResponse(r));
  }

  private toResponse(r: MeetingRow): MeetingResponse {
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      title: r.title,
      date: r.due_date ?? null,
      durationLabel: str(m.duration),
      client: r.related_name ?? '',
      location: str(m.location),
      phone: str(m.phone),
      platform: str(m.platform),
      notes: r.description ?? '',
      kind: str(m.meeting_kind) || 'meeting',
      gcalSync: str(m.gcal_sync) || (m.google_event_id ? 'synced' : ''),
      gcalLink: str(m.gcal_link) || null,
    };
  }

  async create(ctx: RequestContext, dto: CreateMeetingDto): Promise<MeetingResponse> {
    const metadata = {
      duration: dto.durationLabel ?? '',
      location: dto.location ?? '',
      phone: dto.phone ?? '',
      platform: dto.platform ?? 'In-person',
      meeting_kind: dto.kind ?? 'meeting',
    };
    const row = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<MeetingRow>(
        `INSERT INTO tasks (tenant_id, assignee_id, title, description, due_date, task_type, status, related_name, metadata, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,'meeting','pending',$6,$7,$2,$2)
         RETURNING id, title, description, due_date, related_name, metadata`,
        [ctx.tenantId, ctx.userId, dto.title.trim(), dto.notes?.trim() || null, dto.date, dto.client?.trim() || null, JSON.stringify(metadata)],
      );
      const meeting = rows[0];
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'meeting.created','task',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, meeting.id, JSON.stringify({ title: dto.title }), ctx.correlationId],
      );
      return meeting;
    });

    // PREI randevusu → Google Takvim (resilient: takvim başarısız olsa da
    // randevu PREI'de kalır). Senkron durumu metadata'ya yazılır.
    const sync = await this.pushToGoogleCalendar(ctx, dto);
    const merged: MeetingRow = {
      ...row,
      metadata: { ...(row.metadata as Record<string, unknown>), ...sync.metaPatch },
    };
    if (Object.keys(sync.metaPatch).length > 0) {
      await this.db.withContext(ctx, (c) =>
        c.query(`UPDATE tasks SET metadata = metadata || $2::jsonb WHERE id = $1`,
          [row.id, JSON.stringify(sync.metaPatch)]),
      ).catch((e) => this.logger.warn(`gcal metadata yazılamadı: ${(e as Error).message}`));
    }
    return this.toResponse(merged);
  }

  /**
   * Randevuyu düzenler. Yalnız gönderilen alanlar güncellenir; bağlı Google
   * Takvim etkinliği varsa o da güncellenir (resilient: takvim hatası PREI
   * güncellemesini bozmaz).
   */
  async update(ctx: RequestContext, id: string, dto: UpdateMeetingDto): Promise<MeetingResponse> {
    const row = await this.db.withContext(ctx, async (c) => {
      const metaPatch: Record<string, unknown> = {};
      if (dto.durationLabel !== undefined) metaPatch.duration = dto.durationLabel;
      if (dto.location !== undefined) metaPatch.location = dto.location;
      if (dto.phone !== undefined) metaPatch.phone = dto.phone;
      if (dto.platform !== undefined) metaPatch.platform = dto.platform;
      if (dto.kind !== undefined) metaPatch.meeting_kind = dto.kind;

      const { rows } = await c.query<MeetingRow>(
        `UPDATE tasks SET
           title        = COALESCE($2, title),
           description  = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE description END,
           due_date     = COALESCE($4::timestamptz, due_date),
           related_name = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE related_name END,
           metadata     = coalesce(metadata,'{}'::jsonb) || $6::jsonb,
           updated_at   = now(), updated_by = $7
         WHERE id = $1 AND task_type = 'meeting' AND deleted_at IS NULL
         RETURNING id, title, description, due_date, related_name, metadata`,
        [id, dto.title ?? null, dto.notes ?? null, dto.date ?? null, dto.client ?? null,
         JSON.stringify(metaPatch), ctx.userId],
      );
      if (rows.length === 0) throw new NotFoundException('Randevu bulunamadı');
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'meeting.updated','task',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ fields: Object.keys(dto) }), ctx.correlationId],
      );
      return rows[0];
    });

    // Bağlı Google Takvim etkinliğini güncelle (varsa) — birleşik güncel değerlerle.
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const eventId = meta['google_event_id'] as string | undefined;
    if (eventId && row.due_date) {
      const users = await this.db.raw<{ id: string }>(
        `SELECT id FROM users
           WHERE tenant_id = $1 AND metadata ? 'googleOAuth' AND is_active = true AND deleted_at IS NULL
           ORDER BY created_at ASC LIMIT 1`,
        [ctx.tenantId],
      ).catch(() => [] as Array<{ id: string }>);
      if (users.length > 0) {
        const eff = {
          kind: str(meta.meeting_kind) || 'meeting',
          client: row.related_name ?? undefined,
          clientEmail: dto.clientEmail,
          platform: str(meta.platform) || 'In-person',
          phone: str(meta.phone) || undefined,
          location: str(meta.location) || undefined,
          notes: row.description ?? undefined,
        };
        await this.calendar.updateEvent(users[0].id, eventId, {
          summary: row.title,
          description: buildEventDescription(eff),
          location: buildEventLocation(eff),
          startIso: row.due_date,
          durationMinutes: parseDurationMinutes(str(meta.duration)),
          attendeeEmail: dto.clientEmail?.trim() || null,
        }).catch((e) => this.logger.warn(`Google Takvim güncellenemedi: ${(e as Error).message}`));
      }
    }
    return this.toResponse(row);
  }

  /**
   * Randevuyu siler (soft-delete). Bağlı Google Takvim etkinliği varsa onu da
   * kaldırır (resilient: takvim silme başarısız olsa da PREI kaydı silinir).
   */
  async remove(ctx: RequestContext, id: string): Promise<{ id: string; deleted: true }> {
    const row = await this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ id: string; title: string; metadata: Record<string, unknown> | null }>(
        `UPDATE tasks SET deleted_at = now(), updated_at = now(), updated_by = $2
          WHERE id = $1 AND task_type = 'meeting' AND deleted_at IS NULL
          RETURNING id, title, metadata`,
        [id, ctx.userId],
      );
      if (rows.length === 0) throw new NotFoundException('Randevu bulunamadı');
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'meeting.deleted','task',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, id, JSON.stringify({ title: rows[0].title }), ctx.correlationId],
      );
      return rows[0];
    });

    // Google Takvim etkinliğini kaldır (varsa) — hata randevu silmeyi bozmaz.
    const eventId = (row.metadata ?? {})['google_event_id'] as string | undefined;
    if (eventId) {
      const users = await this.db.raw<{ id: string }>(
        `SELECT id FROM users
           WHERE tenant_id = $1 AND metadata ? 'googleOAuth' AND is_active = true AND deleted_at IS NULL
           ORDER BY created_at ASC LIMIT 1`,
        [ctx.tenantId],
      ).catch(() => [] as Array<{ id: string }>);
      if (users.length > 0) {
        await this.calendar.deleteEvent(users[0].id, eventId).catch((e) =>
          this.logger.warn(`Google Takvim etkinliği silinemedi: ${(e as Error).message}`),
        );
      }
    }
    return { id: row.id, deleted: true };
  }

  /**
   * Bağlı Google hesabının takvimine etkinlik oluşturur. Bağlı Gmail yoksa
   * 'skipped'; yeniden-yetki gerekiyorsa 'reauth'; diğer hatada 'failed' —
   * hiçbir durumda randevu oluşturmayı bozmaz.
   */
  private async pushToGoogleCalendar(
    ctx: RequestContext, dto: CreateMeetingDto,
  ): Promise<{ metaPatch: Record<string, unknown> }> {
    // Bağlı Google hesabı = tenant'ın Gmail bağlamış ilk aktif kullanıcısı
    // (welcome/calendly ile aynı; pratikte şirket hesabı).
    const users = await this.db.raw<{ id: string }>(
      `SELECT id FROM users
         WHERE tenant_id = $1 AND metadata ? 'googleOAuth' AND is_active = true AND deleted_at IS NULL
         ORDER BY created_at ASC LIMIT 1`,
      [ctx.tenantId],
    ).catch(() => [] as Array<{ id: string }>);
    if (users.length === 0) return { metaPatch: { gcal_sync: 'skipped' } };

    try {
      const res = await this.calendar.createEvent(users[0].id, {
        summary: dto.title.trim(),
        description: buildEventDescription(dto),
        location: buildEventLocation(dto),
        startIso: dto.date,
        durationMinutes: parseDurationMinutes(dto.durationLabel),
        attendeeEmail: dto.clientEmail?.trim() || null,
      });
      return { metaPatch: { google_event_id: res.eventId, gcal_link: res.htmlLink, gcal_sync: 'synced' } };
    } catch (err) {
      const reauth = isGmailAuthError(err) || isGmailScopeError(err);
      this.logger.warn(`Google Takvim'e yazılamadı (${reauth ? 'reauth' : 'failed'}): ${(err as Error).message}`);
      return { metaPatch: { gcal_sync: reauth ? 'reauth' : 'failed' } };
    }
  }
}
