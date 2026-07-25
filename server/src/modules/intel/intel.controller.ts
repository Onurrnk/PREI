// =====================================================================
// PREI | Rapor alımı — YALNIZ motor ucu (agent anahtarı).
//
// Uygulama içi ekran yok: rapor arşivi ve içerik üretimi Google Drive'da
// yaşıyor. Buraya yalnız yerel betik (tools/haftalik-icerik.mjs) ve n8n
// erişir; raporu yükler, bölümlere ayırır, içerik paketini ister.
// =====================================================================
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { IntelService } from './intel.service';
import { ContentPackService } from './content-pack.service';

/**
 * Otomatik alım: Co-work / n8n raporu buraya POST eder.
 * Aynı servis, agent kimliğiyle.
 */
@Controller('agent/intel')
@UseGuards(AgentKeyGuard)
export class AgentIntelController {
  constructor(
    private readonly intel: IntelService,
    private readonly content: ContentPackService,
  ) {}

  /** Yerel betik: rapordan içerik paketi üret. */
  @Post('reports/:id/content-pack')
  generatePack(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.generate(ctx, id);
  }

  /** Yerel betik: karusel görsellerini al (base64). */
  @Post('content-packs/:packId/images')
  images(@Ctx() ctx: RequestContext, @Param('packId', ParseUUIDPipe) packId: string) {
    return this.content.carouselImages(ctx, packId);
  }

  /** Yerel betik: haber kalemlerini al (paket üretilemese de klasöre yazılsın). */
  @Get('reports/:id')
  detail(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.intel.detail(ctx, id);
  }

  @Post('reports')
  ingest(
    @Ctx() ctx: RequestContext,
    @Body() body: { fileName?: string; text?: string },
  ) {
    if (!body?.text || body.text.trim().length < 200) {
      throw new BadRequestException('text alanı zorunlu (en az 200 karakter)');
    }
    return this.intel.ingest(ctx, {
      fileName: body.fileName?.trim() || 'Otomatik rapor',
      text: body.text, source: 'cowork',
    });
  }
}
