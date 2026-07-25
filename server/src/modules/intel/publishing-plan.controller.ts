// =====================================================================
// PREI | PublishingPlanController — haftalık yayın akışı uçları.
//
// Burada "yayınla" ucu YOK. Sistem hazırlar, Onur paylaşır. Yapılabilen
// tek şey "paylaştım" işaretlemek (markItem) — bu da bir kayıt, eylem değil.
// =====================================================================
import {
  BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { PublishingPlanService } from './publishing-plan.service';
import { GeminiImageService } from './gemini-image.service';

const ITEM_STATUS = ['ready', 'published', 'skipped'] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('intel/publishing')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('marketing')
export class PublishingPlanController {
  constructor(
    private readonly plans: PublishingPlanService,
    private readonly images: GeminiImageService,
  ) {}

  /** Haftalık planları listele. */
  @Get()
  list(@Ctx() ctx: RequestContext, @Query('limit') limit?: string) {
    return this.plans.list(ctx, limit ? Number(limit) : undefined);
  }

  /** Bugün ne paylaşacağım. */
  @Get('today')
  today(@Ctx() ctx: RequestContext) {
    return this.plans.today(ctx);
  }

  /** Rapordan haftalık akış üret. */
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

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.get(ctx, id);
  }

  /** Drive'a (yeniden) yükle — izin sonradan verildiyse tekrar denemek için. */
  @Post(':id/drive')
  async drive(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    const plan = await this.plans.get(ctx, id);
    return this.plans.pushToDrive(
      ctx, id, 'Haftalık istihbarat raporu',
      `${plan.weekStart} — ${plan.weekEnd}`,
    );
  }

  /** Karusel görsellerini üret — anahtar sonradan geldiyse. */
  @Post(':id/images')
  buildImages(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.buildImages(ctx, id);
  }

  /** Bir kalemin görsellerini indir (base64). */
  @Get('items/:itemId/images')
  itemImages(@Ctx() ctx: RequestContext, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.images.stored(ctx, [itemId]);
  }

  /** "Paylaştım" / "atladım". Sistem yayınlamaz; bu yalnızca kayıt. */
  @Patch('items/:itemId')
  markItem(
    @Ctx() ctx: RequestContext,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: { status?: string },
  ) {
    const s = body?.status as (typeof ITEM_STATUS)[number];
    if (!ITEM_STATUS.includes(s)) {
      throw new BadRequestException(`Geçersiz durum. Beklenen: ${ITEM_STATUS.join(', ')}`);
    }
    return this.plans.markItem(ctx, itemId, s);
  }
}

/** Yerel betik (haftalik-icerik.mjs) için agent kimlikli aynı uçlar. */
@Controller('agent/intel/publishing')
@UseGuards(AgentKeyGuard)
export class AgentPublishingController {
  constructor(
    private readonly plans: PublishingPlanService,
    private readonly images: GeminiImageService,
  ) {}

  @Post('generate/:reportId')
  generate(
    @Ctx() ctx: RequestContext,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() body: { weekStart?: string; uploadDrive?: boolean; generateImages?: boolean } = {},
  ) {
    if (body.weekStart && !ISO_DATE.test(body.weekStart)) {
      throw new BadRequestException('weekStart YYYY-MM-DD olmalı');
    }
    // Betik sunucudaki Drive kimliğini kullanamaz (kullanıcıya bağlı) —
    // dosyaları kendi diskine yazar. Drive'ı arayüzden tetikleriz.
    return this.plans.generate(ctx, reportId, { ...body, uploadDrive: false });
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
