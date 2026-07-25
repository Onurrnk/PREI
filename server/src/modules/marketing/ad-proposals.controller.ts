// =====================================================================
// PREI | AdProposalsController — reklam onay kuyruğu uçları.
// Tüm uçlar JWT + admin rolü ister: reklam bütçesi kararı yalnız Onur'a ait.
// =====================================================================
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { AdProposalsService } from './ad-proposals.service';
import { MarketingBrainService } from './marketing-brain.service';
import { ApproveProposalDto, RejectProposalDto } from './dto/ad-proposal.dto';

@Controller('marketing/ad-proposals')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('marketing')
export class AdProposalsController {
  constructor(
    private readonly proposals: AdProposalsService,
    private readonly brain: MarketingBrainService,
  ) {}

  @Get()
  list(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.proposals.list(ctx, status);
  }

  /** Claude analizini çalıştırır → öneriler TASLAK olarak kuyruğa düşer. */
  @Post('analyze')
  analyze(@Ctx() ctx: RequestContext) {
    return this.brain.analyze(ctx);
  }

  /** Analiz girdisini olduğu gibi görmek için (şeffaflık). */
  @Get('snapshot')
  snapshot(@Ctx() ctx: RequestContext) {
    return this.brain.snapshot(ctx);
  }

  /** ONAY — bütçe burada kesinleşir. */
  @Post(':id/approve')
  approve(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveProposalDto,
  ) {
    return this.proposals.approve(ctx, id, dto);
  }

  @Post(':id/reject')
  reject(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectProposalDto,
  ) {
    return this.proposals.reject(ctx, id, dto.note);
  }

  /** Meta'ya DURDURULMUŞ olarak gönderir (para harcamaz). */
  @Post(':id/publish')
  publish(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.publish(ctx, id);
  }

  /** İKİNCİ ONAY — yayına alır, harcama buradan sonra başlar. */
  @Post(':id/activate')
  activate(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.activate(ctx, id);
  }

  @Post(':id/pause')
  pause(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.pause(ctx, id);
  }
}
