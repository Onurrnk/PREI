// =====================================================================
// PREI | AdminController — /api/admin/team, /api/admin/team/:id
// 'admin' izni (yalnız super_admin).
// =====================================================================
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { AdminService } from './admin.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

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

  @Get('branding')
  getBranding(@Ctx() ctx: RequestContext) {
    return this.admin.getBranding(ctx);
  }

  @Patch('branding')
  updateBranding(@Ctx() ctx: RequestContext, @Body() dto: UpdateBrandingDto) {
    return this.admin.updateBranding(ctx, dto);
  }
}
