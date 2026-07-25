// =====================================================================
// PREI | DevelopersController — /api/developers (organizations, list/detail/create/update).
// =====================================================================
import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
  DefaultValuePipe, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { DevelopersService } from './developers.service';
import { OrgContactsService, type OrgContactInput } from './org-contacts.service';
import { CreateDeveloperDto, UpdateDeveloperDto } from './dto/create-developer.dto';

@Controller('developers')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('developers')
export class DevelopersController {
  constructor(
    private readonly developers: DevelopersService,
    private readonly contacts: OrgContactsService,
  ) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.developers.list(ctx, Math.min(limit, 200), offset);
  }

  @Get(':id')
  findOne(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.developers.findOne(ctx, id);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateDeveloperDto) {
    return this.developers.create(ctx, dto);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeveloperDto,
  ) {
    return this.developers.update(ctx, id, dto);
  }

  // ── Firma kişileri (unvanlı) ───────────────────────────────────────
  // Bir firmada birden çok muhatap olur; her birinin unvanı ayrı tutulur.

  @Get(':id/contacts')
  listContacts(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.list(ctx, id);
  }

  @Post(':id/contacts')
  addContact(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: OrgContactInput,
  ) {
    return this.contacts.create(ctx, id, body ?? {});
  }

  @Patch('contacts/:contactId')
  updateContact(
    @Ctx() ctx: RequestContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() body: OrgContactInput,
  ) {
    return this.contacts.update(ctx, contactId, body ?? {});
  }

  @Delete('contacts/:contactId')
  removeContact(
    @Ctx() ctx: RequestContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contacts.remove(ctx, contactId);
  }
}
