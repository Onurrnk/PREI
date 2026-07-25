// =====================================================================
// PREI | IntelController — istihbarat raporu arşivi uçları.
//
// 'marketing' izni: rapor sosyal medya içerik kaynağı olduğu için
// pazarlama yetkisiyle hizalı (super_admin + manager + marketing_manager).
// n8n/Co-work için ayrıca AgentKeyGuard'lı alım ucu var.
// =====================================================================
import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
  Query, UploadedFile, UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { IntelService, type IntelItem } from './intel.service';
import { ContentPackService } from './content-pack.service';

interface UploadedReportLike {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}

const ALLOWED = /\.(docx|txt|md)$/i;
const MAX_BYTES = 20 * 1024 * 1024;
const STATUSES: IntelItem['status'][] = ['new', 'queued', 'published', 'skipped'];

@Controller('intel/reports')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('marketing')
export class IntelController {
  constructor(
    private readonly intel: IntelService,
    private readonly content: ContentPackService,
  ) {}

  /** Rapordan post metinleri + karusel planları üret. */
  @Post(':id/content-pack')
  generatePack(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.generate(ctx, id);
  }

  /** Kayıtlı paketi getir (tekrar üretmeden). */
  @Get(':id/content-pack')
  getPack(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.latestPack(ctx, id);
  }

  /** Karusel görselleri (Nano Banana). force=1 → yeniden üret. */
  @Post('content-packs/:packId/images')
  images(
    @Ctx() ctx: RequestContext,
    @Param('packId', ParseUUIDPipe) packId: string,
    @Query('force') force?: string,
  ) {
    return this.content.carouselImages(ctx, packId, force === '1' || force === 'true');
  }

  @Get()
  list(@Ctx() ctx: RequestContext, @Query('limit') limit?: string) {
    return this.intel.list(ctx, limit ? Number(limit) : undefined);
  }

  /** Bilgi bankası araması — "İspanya'da geçen çeyrek ne olmuş". */
  @Get('search')
  search(
    @Ctx() ctx: RequestContext,
    @Query('q') q: string,
    @Query('market') market?: string,
  ) {
    return this.intel.search(ctx, q ?? '', market || undefined);
  }

  /** Sosyal medya içerik kuyruğu. */
  @Get('items')
  items(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('market') market?: string,
    @Query('speculative') speculative?: string,
  ) {
    return this.intel.items(ctx, {
      status: status || undefined,
      market: market || undefined,
      speculative: speculative === undefined || speculative === ''
        ? undefined
        : speculative === 'true' || speculative === '1',
    });
  }

  @Patch('items/:id')
  updateItem(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status?: string },
  ) {
    const s = body?.status as IntelItem['status'];
    if (!STATUSES.includes(s)) {
      throw new BadRequestException(`Geçersiz durum. Beklenen: ${STATUSES.join(', ')}`);
    }
    return this.intel.updateItem(ctx, id, s);
  }

  @Get(':id')
  detail(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.intel.detail(ctx, id);
  }

  /** Dosya yükleme: .docx / .txt / .md */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  upload(@Ctx() ctx: RequestContext, @UploadedFile() file: UploadedReportLike) {
    if (!file) throw new BadRequestException('Dosya gerekli');
    if (!ALLOWED.test(file.originalname)) {
      throw new BadRequestException('Yalnız .docx, .txt veya .md kabul edilir');
    }
    return this.intel.ingest(ctx, {
      fileName: file.originalname, buffer: file.buffer, source: 'upload',
    });
  }

  /** Metin yapıştırma (dosya olmadan). */
  @Post('text')
  fromText(
    @Ctx() ctx: RequestContext,
    @Body() body: { title?: string; text?: string },
  ) {
    if (!body?.text || body.text.trim().length < 200) {
      throw new BadRequestException('En az 200 karakter rapor metni gerekli');
    }
    return this.intel.ingest(ctx, {
      fileName: body.title?.trim() || 'Elle girilen rapor',
      text: body.text, source: 'manual',
    });
  }

  @Delete(':id')
  remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.intel.remove(ctx, id);
  }
}

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
