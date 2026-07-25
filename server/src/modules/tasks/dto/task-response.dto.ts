// =====================================================================
// PREI | TaskResponse — tasks tablosu sözleşmesi. enum→görsel etiket.
// Frontend TaskDTO ile senkron (alan adları korundu).
// =====================================================================
import type { TaskRow } from '../tasks.repository';

export interface TaskRelatedEntity { type: string; name: string; id: string }

/** Rapor günlüğü girdisi — kim, ne zaman, ne yazdı, hangi durum geçişi. */
export interface TaskReport {
  at: string;
  byName: string;
  text: string;
  fromStatus?: string;   // görsel etiket (Pending/In Progress/Completed)
  toStatus?: string;
}

export interface TaskResponse {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: string; // High | Medium | Low
  status: string;   // Pending | In Progress | Completed
  assigneeId: string;
  relatedEntity?: TaskRelatedEntity;
  type: string;     // Task | Meeting
  reports: TaskReport[];  // eskiden yeniye
}

const PRIORITY_DISP: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const STATUS_DISP: Record<string, string> = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };
const TYPE_DISP: Record<string, string> = { task: 'Task', meeting: 'Meeting' };
const RELATED_DISP: Record<string, string> = { lead: 'Lead', client: 'Client', project: 'Project' };

interface RawReport {
  at?: string; byName?: string; text?: string; from?: string; to?: string;
}

/** metadata.reports[] → TaskReport[] (bozuk girdiler atlanır). */
function toReports(metadata: Record<string, unknown> | null): TaskReport[] {
  const raw = metadata?.reports;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is RawReport => !!r && typeof r === 'object')
    .map((r) => ({
      at: typeof r.at === 'string' ? r.at : '',
      byName: typeof r.byName === 'string' ? r.byName : '',
      text: typeof r.text === 'string' ? r.text : '',
      ...(r.from ? { fromStatus: STATUS_DISP[r.from] ?? r.from } : {}),
      ...(r.to ? { toStatus: STATUS_DISP[r.to] ?? r.to } : {}),
    }))
    .filter((r) => r.text || r.toStatus);
}

export function toTaskResponse(row: TaskRow): TaskResponse {
  const res: TaskResponse = {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    dueDate: row.due_date ?? '',
    priority: PRIORITY_DISP[row.priority] ?? 'Medium',
    status: STATUS_DISP[row.status] ?? 'Pending',
    assigneeId: row.assignee_id ?? '',
    type: TYPE_DISP[row.task_type] ?? 'Task',
    reports: toReports(row.metadata),
  };
  if (row.related_type && row.related_id) {
    res.relatedEntity = {
      type: RELATED_DISP[row.related_type] ?? row.related_type,
      name: row.related_name ?? '',
      id: row.related_id,
    };
  }
  return res;
}
