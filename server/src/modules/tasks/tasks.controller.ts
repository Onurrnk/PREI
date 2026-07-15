// =====================================================================
// PREI | TasksController — /api/tasks (list + status/priority update).
// 'tasks' izni; ownership RLS ile scope'lanır (super_admin hepsini görür).
// =====================================================================
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { TasksService } from './tasks.service';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Ctx() ctx: RequestContext, @Query('assigneeId') assigneeId?: string) {
    return this.tasks.list(ctx, assigneeId);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateTaskDto) {
    return this.tasks.create(ctx, dto);
  }

  @Put(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(ctx, id, dto);
  }
}
