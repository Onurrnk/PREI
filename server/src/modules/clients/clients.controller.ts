// =====================================================================
// PREI | ClientsController — /api/clients (müşteri dizini + profil güncelleme). 'clients' izni.
// =====================================================================
import {
  Controller, Get, Patch, Post, Body, Param, ParseUUIDPipe, Query,
  DefaultValuePipe, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/client-update.dto';
import { CreateClientNoteDto } from './dto/client-note.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

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

  @Get(':id/notes')
  listNotes(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.listNotes(ctx, id);
  }

  @Post(':id/notes')
  createNote(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClientNoteDto,
  ) {
    return this.clients.createNote(ctx, id, dto);
  }

  @Get(':id/timeline')
  timeline(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.timeline(ctx, id);
  }
}
