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
  metadata: Record<string, unknown> | null;
}

/** Görev rapor günlüğü girdisi (metadata.reports[] — append-only). */
export interface TaskReportEntry {
  at: string;
  by: string;
  byName: string;
  text: string;
  from?: string;   // durum geçişi (enum)
  to?: string;
}

export interface TaskUpdateInput {
  status?: string;
  priority?: string;
  title?: string;
  description?: string;
  dueDate?: string | null;
  report?: TaskReportEntry;
}

const TASK_COLS = `id, title, description, due_date, priority, status, task_type,
         assignee_id, related_type, related_id, related_name, metadata`;

const TASK_SELECT = `SELECT ${TASK_COLS} FROM tasks`;

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

  async findById(ctx: RequestContext, id: string): Promise<TaskRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<TaskRow>(
        `${TASK_SELECT} WHERE id = $1 AND deleted_at IS NULL`, [id],
      );
      return rows[0] ?? null;
    });
  }

  async create(
    ctx: RequestContext,
    input: { title: string; description: string | null; dueDate: string | null; priority: string; assigneeId: string },
  ): Promise<TaskRow> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<TaskRow>(
        `INSERT INTO tasks (tenant_id, assignee_id, title, description, due_date, priority, status, task_type, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,'pending','task',$7,$7)
         RETURNING ${TASK_COLS}`,
        [ctx.tenantId, input.assigneeId, input.title, input.description, input.dueDate, input.priority, ctx.userId],
      );
      const task = rows[0];
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'task.created','task',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, task.id, JSON.stringify({ title: input.title }), ctx.correlationId],
      );
      return task;
    });
  }

  /**
   * Görevi günceller. Rapor notu verilirse metadata.reports[] dizisine EKLENİR
   * (append-only: geçmiş rapor silinmez/değişmez; durum geçişi de kaydedilir).
   */
  async update(ctx: RequestContext, id: string, input: TaskUpdateInput): Promise<TaskRow | null> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<TaskRow>(
        `UPDATE tasks SET
           status      = COALESCE($2, status),
           priority    = COALESCE($3, priority),
           title       = COALESCE($4, title),
           description = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE description END,
           due_date    = CASE WHEN $6::text = '' THEN NULL
                              WHEN $6::text IS NOT NULL THEN $6::timestamptz
                              ELSE due_date END,
           metadata    = CASE WHEN $7::jsonb IS NULL THEN metadata
                              ELSE jsonb_set(
                                     COALESCE(metadata, '{}'::jsonb), '{reports}',
                                     COALESCE(metadata->'reports', '[]'::jsonb) || $7::jsonb)
                         END,
           updated_by  = $8
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING ${TASK_COLS}`,
        [
          id, input.status ?? null, input.priority ?? null,
          input.title ?? null, input.description ?? null,
          input.dueDate === undefined ? null : input.dueDate,
          input.report ? JSON.stringify([input.report]) : null,
          ctx.userId,
        ],
      );
      const task = rows[0] ?? null;
      if (task) {
        await c.query(
          `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
           VALUES ($1,$2,'task.updated','task',$3,$4,$5)`,
          [ctx.tenantId, ctx.userId, id,
           JSON.stringify({ status: input.status, priority: input.priority, hasReport: !!input.report }),
           ctx.correlationId],
        );
      }
      return task;
    });
  }
}
