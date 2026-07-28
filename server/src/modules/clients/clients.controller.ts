// =====================================================================
// PREI | ClientsController — /api/clients (müşteri dizini + profil güncelleme). 'clients' izni.
// =====================================================================
import {
  BadRequestException, Controller, Get, Patch, Post, Delete, Body, Param, ParseUUIDPipe, Query,
  DefaultValuePipe, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { ClientsService } from './clients.service';
import { PresentedService } from './presented/presented.service';
import type { PresentedInput } from './presented/presented.model';
import { ENGAGEMENTS, type Engagement } from './engagement';
import { UpdateClientDto } from './dto/client-update.dto';
import { CreateClientNoteDto } from './dto/client-note.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly presented: PresentedService,
  ) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.clients.list(ctx, Math.min(limit, 500), offset);
  }

  @Get(':id')
  findOne(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.findOne(ctx, id);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(ctx, id, dto);
  }

  /** Sıcak / normal / dondurulmuş ataması (madde 25). */
  @Patch(':id/engagement')
  setEngagement(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { engagement?: string },
  ) {
    const e = body?.engagement as Engagement;
    if (!ENGAGEMENTS.includes(e)) {
      throw new BadRequestException(`Geçersiz durum. Beklenen: ${ENGAGEMENTS.join(', ')}`);
    }
    return this.clients.setEngagement(ctx, id, e);
  }

  // ── Sunulan ürünler (003j) — "bu müşteriye ne sunduk" ─────────────

  @Get(':id/presented')
  listPresented(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.presented.list(ctx, id);
  }

  @Post(':id/presented')
  addPresented(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PresentedInput,
  ) {
    return this.presented.create(ctx, id, body ?? {});
  }

  @Patch(':id/presented/:presentedId')
  updatePresented(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('presentedId', ParseUUIDPipe) presentedId: string,
    @Body() body: PresentedInput,
  ) {
    return this.presented.update(ctx, id, presentedId, body ?? {});
  }

  @Delete(':id/presented/:presentedId')
  removePresented(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('presentedId', ParseUUIDPipe) presentedId: string,
  ) {
    return this.presented.remove(ctx, id, presentedId);
  }

  /** Adayı Müşteriye çevir — "kayıt alındı". lifecycle→customer + açık lead'ler converted. */
  @Post(':id/convert')
  convert(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.convertToCustomer(ctx, id);
  }

  @Get(':id/notes')
  listNotes(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.listNotes(ctx, id);
  }

  /** AI Analiz raporları — ClientProfile "AI Analiz" sekmesi. */
  @Get(':id/analyses')
  listAnalyses(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.listAnalyses(ctx, id);
  }

  @Post(':id/notes')
  createNote(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClientNoteDto,
  ) {
    return this.clients.createNote(ctx, id, dto);
  }

  /** İç notu düzenle — yalnız elle girilen not (AI analiz notu korunur). */
  @Patch(':id/notes/:noteId')
  updateNote(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: CreateClientNoteDto,
  ) {
    return this.clients.updateNote(ctx, id, noteId, dto);
  }

  /** İç notu sil (soft delete) — yalnız elle girilen not. */
  @Delete(':id/notes/:noteId')
  deleteNote(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.clients.deleteNote(ctx, id, noteId);
  }

  @Get(':id/timeline')
  timeline(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.timeline(ctx, id);
  }
}
