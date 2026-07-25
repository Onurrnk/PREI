import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import { toTaskResponse, type TaskResponse } from './dto/task-response.dto';
import { STATUS_TO_ENUM, PRIORITY_TO_ENUM, type UpdateTaskDto } from './dto/update-task.dto';
import type { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly repo: TasksRepository,
    private readonly db: DatabaseService,
  ) {}

  async list(ctx: RequestContext, assigneeId?: string): Promise<TaskResponse[]> {
    const rows = await this.repo.list(ctx, assigneeId);
    return rows.map(toTaskResponse);
  }

  async create(ctx: RequestContext, dto: CreateTaskDto): Promise<TaskResponse> {
    const row = await this.repo.create(ctx, {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      dueDate: dto.dueDate ?? null,
      priority: dto.priority ? PRIORITY_TO_ENUM[dto.priority] : 'medium',
      assigneeId: dto.assigneeId ?? ctx.userId!,
    });
    return toTaskResponse(row);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateTaskDto): Promise<TaskResponse> {
    const hasAny = dto.status || dto.priority || dto.title !== undefined
      || dto.description !== undefined || dto.dueDate !== undefined || dto.report?.trim();
    if (!hasAny) throw new BadRequestException('Güncellenecek alan yok.');

    const status = dto.status ? STATUS_TO_ENUM[dto.status] : undefined;
    const priority = dto.priority ? PRIORITY_TO_ENUM[dto.priority] : undefined;

    // Rapor notu veya durum değişimi varsa günlüğe bir girdi ekle. Yazar adı
    // yazma anında saklanır (denormalize): geçmiş kayıt sonradan değişmesin.
    let report: { at: string; by: string; byName: string; text: string; from?: string; to?: string } | undefined;
    const noteText = dto.report?.trim() ?? '';
    if (noteText || status) {
      const current = await this.repo.findById(ctx, id);
      if (!current) throw new NotFoundException();
      const changed = !!status && status !== current.status;
      if (noteText || changed) {
        report = {
          at: new Date().toISOString(),
          by: ctx.userId ?? '',
          byName: await this.actorName(ctx),
          text: noteText,
          ...(changed ? { from: current.status, to: status } : {}),
        };
      }
    }

    const row = await this.repo.update(ctx, id, {
      status, priority,
      title: dto.title?.trim(),
      description: dto.description,
      dueDate: dto.dueDate,
      report,
    });
    if (!row) throw new NotFoundException();
    return toTaskResponse(row);
  }

  /** Rapor girdisinde gösterilecek yazar adı (bulunamazsa nötr etiket). */
  private async actorName(ctx: RequestContext): Promise<string> {
    if (!ctx.userId) return 'PREI';
    const rows = await this.db
      .raw<{ full_name: string | null }>(`SELECT full_name FROM users WHERE id = $1`, [ctx.userId])
      .catch(() => [] as Array<{ full_name: string | null }>);
    return rows[0]?.full_name?.trim() || 'PREI';
  }
}
