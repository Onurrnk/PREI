// =====================================================================
// PREI | AuditController — süper admin denetim konsolu.
//
// 'audit_full' izni yalnız super_admin'dedir. RbacGuard izin yoksa 404
// döner (403 değil) — yetkisiz kullanıcı bu ucun VARLIĞINI bile görmez.
// =====================================================================
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { AuditService } from './audit.service';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('audit_full')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Birleşik etkinlik akışı — kim, ne zaman, hangi kayda, ne yaptı. */
  @Get('activity')
  activity(
    @Ctx() ctx: RequestContext,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('source') source?: 'human' | 'system',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.activity(ctx, {
      actorId: actorId || undefined,
      entityType: entityType || undefined,
      action: action || undefined,
      source: source || undefined,
      from: from || undefined,
      to: to || undefined,
      search: search || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /** Aktörler + eylem sayıları (filtre menüsü ve genel bakış). */
  @Get('actors')
  actors(@Ctx() ctx: RequestContext) {
    return this.audit.actors(ctx);
  }

  /** Tek bir kaydın tüm geçmişi — "bu yatırımcının profilinde ne oldu?" */
  @Get('entity/:id')
  entityHistory(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.audit.entityHistory(ctx, id);
  }
}
