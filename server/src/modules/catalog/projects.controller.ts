// =====================================================================
// PREI | ProjectsController — /api/projects (properties tabanlı, list/detail/create).
// =====================================================================
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query,
  DefaultValuePipe, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.projects.list(ctx, Math.min(limit, 200), offset);
  }

  @Get(':id')
  findOne(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findOne(ctx, id);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateProjectDto) {
    return this.projects.create(ctx, dto);
  }
}
