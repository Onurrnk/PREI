// =====================================================================
// PREI | TasksRepository — görevler (list + status/priority update), RLS'te.
// Update audit_log'a yazılır (append-only forensics).
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  task_type: string;
  assignee_id: string | null;
  related_type: string | null;
  related_id: string | null;
  related_name: string | null;
}

const TASK_SELECT = `
  SELECT id, title, description, due_date, priority, status, task_type,
         assignee_id, related_type, related_id, related_name
    FROM tasks`;

@Injectable()
export class TasksRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, assigneeId?: string): Promise<TaskRow[]> {
    return this.db.withContext(ctx, async (c) => {
      if (assigneeId) {
        const { rows } = await c.query<TaskRow>(
          `${TASK_SELECT} WHERE deleted_at IS NULL AND assignee_id = $1
             ORDER BY due_date ASC NULLS LAST`,
          [assigneeId],
        );
        return rows;
      }
      const { rows } = await c.query<TaskRow>(
        `${TASK_SELECT} WHERE deleted_at IS NULL ORDER BY due_date ASC NULLS LAST`,
      );
      return rows;
    });
  }

  async update(
    ctx: RequestContext, id: string, status?: string, priority?: string,
  ): Promise<TaskRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<TaskRow>(
        `UPDATE tasks SET
           status   = COALESCE($2, status),
           priority = COALESCE($3, priority),
           updated_by = $4
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, title, description, due_date, priority, status, task_type,
                   assignee_id, related_type, related_id, related_name`,
        [id, status ?? null, priority ?? null, ctx.userId],
      );
      const task = rows[0] ?? null;
      if (task) {
        await c.query(
          `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
           VALUES ($1,$2,'task.updated','task',$3,$4,$5)`,
          [ctx.tenantId, ctx.userId, id, JSON.stringify({ status, priority }), ctx.correlationId],
        );
      }
      return task;
    });
  }
}
