// =====================================================================
// PREI | DashboardController — /api/dashboard/summary (Command Center özeti).
// 'dashboard' izni (tüm roller görür).
// =====================================================================
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@Ctx() ctx: RequestContext) {
    return this.dashboard.summary(ctx);
  }
}
