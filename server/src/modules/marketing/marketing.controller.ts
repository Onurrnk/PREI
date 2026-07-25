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
import { SocialService } from './social.service';
import { CreateAdSpendDto, ImportAdSpendDto, UpdateAdSpendDto } from './dto/ad-spend.dto';
import { CreateSocialPostDto, UpsertFollowersDto } from './dto/social.dto';
import { MARKETING_TIMEFRAMES, type MarketingTimeframe } from './marketing.util';

@Controller('marketing')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('marketing')
export class MarketingController {
  constructor(
    private readonly marketing: MarketingService,
    private readonly social: SocialService,
  ) {}

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

  /** Manuel Meta senkronu (UI "Meta'dan Çek" butonu) — reklam + sosyal birlikte. */
  @Post('meta-sync')
  async metaSync(@Ctx() ctx: RequestContext, @Query('datePreset') datePreset?: string) {
    const ads = await this.marketing.syncMeta(ctx, datePreset || 'last_30d');
    const social = await this.social.syncFromMeta(ctx).catch((e) => ({
      ok: false, configured: true, pagesFound: 0, snapshots: 0, postsUpserted: 0,
      message: e instanceof Error ? e.message : String(e),
    }));
    return { ...ads, social };
  }

  // ---- Sosyal medya (002w): takipçi anlık görüntüleri + paylaşımlar ----
  @Get('social/summary')
  socialSummary(@Ctx() ctx: RequestContext) {
    return this.social.summary(ctx);
  }

  @Post('social/followers')
  socialFollowers(@Ctx() ctx: RequestContext, @Body() dto: UpsertFollowersDto) {
    return this.social.upsertFollowers(ctx, dto);
  }

  @Post('social/posts')
  socialCreatePost(@Ctx() ctx: RequestContext, @Body() dto: CreateSocialPostDto) {
    return this.social.createPost(ctx, dto);
  }

  @Delete('social/posts/:id')
  socialRemovePost(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.removePost(ctx, id);
  }
}
