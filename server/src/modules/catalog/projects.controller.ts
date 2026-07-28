// =====================================================================
// PREI | ProjectsController — /api/projects (properties tabanlı, list/detail/create).
// =====================================================================
import {
  Body, Delete, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
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
import { UpdateProjectDto } from './dto/update-project.dto';
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

  /** Bu proje kimlere sunuldu — müşteri kartındaki kaydın ters görünümü. */
  @Get(':id/audience')
  audience(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lang') lang?: string,
  ) {
    return this.projects.audience(ctx, id, lang === 'en' ? 'en' : 'tr');
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateProjectDto) {
    return this.projects.create(ctx, dto);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(ctx, id, dto);
  }

  @Patch(':id/lifecycle')
  setLifecycle(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLifecycleDto,
  ) {
    return this.projects.setLifecycle(ctx, id, dto.status);
  }

  /** Projeyi sil (soft delete) — test/yanlış giriş temizliği. */
  @Delete(':id')
  remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(ctx, id);
  }

  /** Beğenilmeyen görseli kaldır — galeri + kategorili gösterim + depo. */
  @Delete(':id/images')
  removeImage(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('url') url: string,
  ) {
    return this.projects.removeImage(ctx, id, url);
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
