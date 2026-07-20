// =====================================================================
// PREI | MeetingsService — tasks(task_type='meeting') → MeetingDTO.
// date=due_date; client=related_name; yer/platform/süre/tür metadata'dan.
// =====================================================================
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { CreateMeetingDto } from './dto/create-meeting.dto';
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
  notes: string;
  kind: string;               // viewing | signing | meeting
  // Google Takvim senkron durumu: synced | reauth | failed | skipped (bağlı Gmail yok)
  gcalSync: string;
  gcalLink: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
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
        description: [dto.notes?.trim(), dto.client ? `Müşteri: ${dto.client}` : null].filter(Boolean).join('\n') || null,
        location: dto.location?.trim() || null,
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
