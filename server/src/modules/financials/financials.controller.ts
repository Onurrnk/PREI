// =====================================================================
// PREI | FinancialsController — /api/financials/summary
// 'financials' izni (super_admin/manager/finance_manager).
// =====================================================================
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { FinancialsService, type Timeframe } from './financials.service';

const VALID_TIMEFRAMES: Timeframe[] = ['Q1', 'Q2', 'YTD', '1Y'];

@Controller('financials')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('financials')
export class FinancialsController {
  constructor(private readonly financials: FinancialsService) {}

  @Get('summary')
  summary(@Ctx() ctx: RequestContext, @Query('timeframe') timeframe?: string) {
    const tf = VALID_TIMEFRAMES.includes(timeframe as Timeframe) ? (timeframe as Timeframe) : 'YTD';
    return this.financials.summary(ctx, tf);
  }
}
