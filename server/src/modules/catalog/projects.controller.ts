// =====================================================================
// PREI | ProjectsController — /api/projects (properties tabanlı, list/detail/create).
// =====================================================================
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
  DefaultValuePipe, ParseIntPipe, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { ProjectsService, type UploadedImageLike } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { SetLifecycleDto } from './dto/lifecycle.dto';

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

  @Patch(':id/lifecycle')
  setLifecycle(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLifecycleDto,
  ) {
    return this.projects.setLifecycle(ctx, id, dto.status);
  }

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('files', 8, { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImages(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: UploadedImageLike[],
  ) {
    return this.projects.uploadImages(ctx, id, files);
  }
}
