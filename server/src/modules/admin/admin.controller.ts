// =====================================================================
// PREI | AdminController — /api/admin/team, /api/admin/team/:id
// 'admin' izni (yalnız super_admin).
// =====================================================================
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('team')
  listTeam(@Ctx() ctx: RequestContext) {
    return this.admin.listTeam(ctx);
  }

  @Get('team/:id')
  userDetail(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.admin.userDetail(ctx, id);
  }
}
