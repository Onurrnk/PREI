// =====================================================================
// PREI | MarketingController — /api/marketing/*
// 'marketing' izni (super_admin/manager/marketing_manager).
// GET  summary            → dashboard aggregate (gerçek veri)
// GET  campaigns          → ad_spend listesi (yönetim)
// POST campaigns          → elle harcama ekle
// POST campaigns/import   → CSV'den toplu içe aktar (frontend parse eder)
// PATCH/DELETE campaigns/:id
// =====================================================================
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, NotFoundException, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { MarketingService } from './marketing.service';
import { CreateAdSpendDto, ImportAdSpendDto, UpdateAdSpendDto } from './dto/ad-spend.dto';
import { MARKETING_TIMEFRAMES, type MarketingTimeframe } from './marketing.util';

@Controller('marketing')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('summary')
  summary(@Ctx() ctx: RequestContext, @Query('timeframe') timeframe?: string) {
    const tf = MARKETING_TIMEFRAMES.includes(timeframe as MarketingTimeframe)
      ? (timeframe as MarketingTimeframe) : '30D';
    return this.marketing.summary(ctx, tf);
  }

  @Get('campaigns')
  campaigns(@Ctx() ctx: RequestContext) {
    return this.marketing.listCampaigns(ctx);
  }

  @Post('campaigns')
  create(@Ctx() ctx: RequestContext, @Body() body: CreateAdSpendDto) {
    return this.marketing.createCampaign(ctx, body);
  }

  @Post('campaigns/import')
  import(@Ctx() ctx: RequestContext, @Body() body: ImportAdSpendDto) {
    return this.marketing.importCampaigns(ctx, body.rows);
  }

  @Patch('campaigns/:id')
  async update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAdSpendDto) {
    const updated = await this.marketing.updateCampaign(ctx, id, body);
    if (!updated) throw new NotFoundException('Kampanya bulunamadı');
    return updated;
  }

  @Delete('campaigns/:id')
  async remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    const ok = await this.marketing.removeCampaign(ctx, id);
    if (!ok) throw new NotFoundException('Kampanya bulunamadı');
    return { deleted: true as const };
  }
}
