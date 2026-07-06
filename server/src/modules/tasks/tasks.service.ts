import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import type { RequestContext } from '../../common/request-context';
import { toTaskResponse, type TaskResponse } from './dto/task-response.dto';
import { STATUS_TO_ENUM, PRIORITY_TO_ENUM, type UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly repo: TasksRepository) {}

  async list(ctx: RequestContext, assigneeId?: string): Promise<TaskResponse[]> {
    const rows = await this.repo.list(ctx, assigneeId);
    return rows.map(toTaskResponse);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateTaskDto): Promise<TaskResponse> {
    if (!dto.status && !dto.priority) {
      throw new BadRequestException('Güncellenecek alan yok (status veya priority).');
    }
    const status = dto.status ? STATUS_TO_ENUM[dto.status] : undefined;
    const priority = dto.priority ? PRIORITY_TO_ENUM[dto.priority] : undefined;
    const row = await this.repo.update(ctx, id, status, priority);
    if (!row) throw new NotFoundException();
    return toTaskResponse(row);
  }
}
