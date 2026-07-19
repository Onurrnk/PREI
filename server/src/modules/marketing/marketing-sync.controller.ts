// =====================================================================
// PREI | MarketingSyncController — /api/marketing/sync/meta
// n8n GÜNLÜK işinin çağırdığı uç; AgentKeyGuard (X-Agent-Key) ile korunur
// (service_agent bağlamı → 002n ad_spend_service_sync politikası). Meta token
// n8n'de DEĞİL, backend env'inde tutulur; n8n yalnız tetikler.
// =====================================================================
import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { MarketingService } from './marketing.service';

@Controller('marketing/sync')
@UseGuards(AgentKeyGuard)
export class MarketingSyncController {
  constructor(private readonly marketing: MarketingService) {}

  @Post('meta')
  meta(@Ctx() ctx: RequestContext, @Query('datePreset') datePreset?: string) {
    return this.marketing.syncMeta(ctx, datePreset || 'last_30d');
  }
}
