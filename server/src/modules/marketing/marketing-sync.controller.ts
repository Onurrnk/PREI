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
import { SocialService } from './social.service';
import { MarketingManagerService } from './marketing-manager.service';

@Controller('marketing/sync')
@UseGuards(AgentKeyGuard)
export class MarketingSyncController {
  constructor(
    private readonly marketing: MarketingService,
    private readonly social: SocialService,
    private readonly manager: MarketingManagerService,
  ) {}

  /**
   * HAFTALIK PAZARLAMA YÖNETİCİSİ — n8n zamanlayıcısı çağırır.
   * Ölçer, geçen çalışmayı gözden geçirir, eylem önerir. Hiçbir şey
   * yayınlamaz; her eylem onay kuyruğuna 'pending' olarak düşer.
   */
  @Post('manager')
  runManager(@Ctx() ctx: RequestContext) {
    return this.manager.run(ctx);
  }

  /** Günlük senkron: reklam harcaması + sosyal (takipçi/paylaşım) birlikte.
   *  Sosyal senkron hatası reklam senkronunu BOZMAZ (best-effort). */
  @Post('meta')
  async meta(@Ctx() ctx: RequestContext, @Query('datePreset') datePreset?: string) {
    const ads = await this.marketing.syncMeta(ctx, datePreset || 'last_30d');
    const social = await this.social.syncFromMeta(ctx).catch((e) => ({
      ok: false, configured: true, pagesFound: 0, snapshots: 0, postsUpserted: 0,
      insightsWritten: 0, audienceRows: 0,
      message: e instanceof Error ? e.message : String(e),
    }));
    return { ...ads, social };
  }
}
