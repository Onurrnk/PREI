// =====================================================================
// PREI | Haftalık yayın akışı — YALNIZ motor ucu.
//
// İçerik üretimi PREI'nin ekranlarında YAŞAMAZ. PREI bir CRM; burası
// sadece raporu içeriğe çeviren ve çıktıyı Google Drive'a yazan motor.
// Onur haftayı Drive klasöründen okur, Meta Business Suite'te zamanlar,
// LinkedIn'de kendisi paylaşır.
//
// Tetikleyici: yerel betik (tools/haftalik-icerik.mjs) → agent anahtarı.
// =====================================================================
import {
  BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe,
  Post, UseGuards,
} from '@nestjs/common';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { PublishingPlanService } from './publishing-plan.service';
import { GeminiImageService } from './gemini-image.service';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('agent/intel/publishing')
@UseGuards(AgentKeyGuard)
export class AgentPublishingController {
  constructor(
    private readonly plans: PublishingPlanService,
    private readonly images: GeminiImageService,
  ) {}

  /**
   * Rapordan haftayı kurar ve Drive'a yazar.
   * Drive sahibi sunucuda çözülür (Google'ı bağlamış kullanıcı), o yüzden
   * oturum gerekmez — betik tek başına tüm zinciri tamamlar.
   */
  @Post('generate/:reportId')
  generate(
    @Ctx() ctx: RequestContext,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() body: { weekStart?: string; uploadDrive?: boolean; generateImages?: boolean } = {},
  ) {
    if (body.weekStart && !ISO_DATE.test(body.weekStart)) {
      throw new BadRequestException('weekStart YYYY-MM-DD olmalı');
    }
    return this.plans.generate(ctx, reportId, body);
  }

  /** Takvimi tek başına tazele (ör. Drive izni sonradan verildiyse). */
  @Post('calendar')
  calendar(@Ctx() ctx: RequestContext) {
    return this.plans.syncCalendar(ctx);
  }

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.get(ctx, id);
  }

  @Get('items/:itemId/images')
  itemImages(@Ctx() ctx: RequestContext, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.images.stored(ctx, [itemId]);
  }
}
