// =====================================================================
// PREI | MeetingsService — tasks(task_type='meeting') → MeetingDTO.
// date=due_date; client=related_name; yer/platform/süre/tür metadata'dan.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { CreateMeetingDto } from './dto/create-meeting.dto';

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
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

@Injectable()
export class MeetingsService {
  constructor(private readonly db: DatabaseService) {}

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
    return rows.map((r) => {
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
      };
    });
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
    const m = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      title: row.title,
      date: row.due_date ?? null,
      durationLabel: str(m.duration),
      client: row.related_name ?? '',
      location: str(m.location),
      platform: str(m.platform),
      notes: row.description ?? '',
      kind: str(m.meeting_kind) || 'meeting',
    };
  }
}
