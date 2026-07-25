// =====================================================================
// PREI | DocumentsController — /api/documents (Document Vault). 'documents' izni.
// Upload multipart/form-data: file + folder (+ related_type/related_id).
// =====================================================================
import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { DocumentsService, type UploadedFileLike } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('organizationId') organizationId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.documents.list(ctx, {
      organizationId: organizationId || undefined,
      projectId: projectId || undefined,
    });
  }

  /** Kasa ağacı: Firma → Proje → Kategori (sayı ve boyut özetleriyle). */
  @Get('tree')
  tree(@Ctx() ctx: RequestContext) {
    return this.documents.tree(ctx);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @Ctx() ctx: RequestContext,
    @UploadedFile() file: UploadedFileLike,
    @Body('folder') folder: string,
    @Body('related_type') relatedType?: string,
    @Body('related_id') relatedId?: string,
    @Body('organization_id') organizationId?: string,
    @Body('project_id') projectId?: string,
  ) {
    return this.documents.upload(
      ctx, file, folder ?? 'other', relatedType, relatedId, organizationId, projectId);
  }

  @Get(':id/download')
  download(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.downloadUrl(ctx, id);
  }

  @Delete(':id')
  remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(ctx, id);
  }
}
