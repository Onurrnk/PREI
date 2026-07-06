// =====================================================================
// PREI | TaskResponse — tasks tablosu sözleşmesi. enum→görsel etiket.
// Frontend TaskDTO ile senkron (alan adları korundu).
// =====================================================================
import type { TaskRow } from '../tasks.repository';

export interface TaskRelatedEntity { type: string; name: string; id: string }

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
}

const PRIORITY_DISP: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const STATUS_DISP: Record<string, string> = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };
const TYPE_DISP: Record<string, string> = { task: 'Task', meeting: 'Meeting' };
const RELATED_DISP: Record<string, string> = { lead: 'Lead', client: 'Client', project: 'Project' };

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
