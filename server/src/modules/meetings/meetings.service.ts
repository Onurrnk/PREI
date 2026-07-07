// =====================================================================
// PREI | MeetingsService — tasks(task_type='meeting') → MeetingDTO.
// date=due_date; client=related_name; yer/platform/süre/tür metadata'dan.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

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
}
