// =====================================================================
// PREI | ContactsController — /api/contacts (kişi master).
// JwtAuthGuard + RbacGuard; 'clients' izni (kişi/ilişki domaini).
// =====================================================================
import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query,
  DefaultValuePipe, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/contact.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('clients')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('search') search: string | undefined,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.contacts.list(ctx, search, Math.min(limit, 200), offset);
  }

  /** Duplicate ön-kontrolü — kayıttan ÖNCE e-posta/telefonla eşleşen kişi.
   *  ':id'den ÖNCE tanımlı (aksi halde 'lookup' UUID pipe'ına takılır). */
  @Get('lookup')
  lookup(
    @Ctx() ctx: RequestContext,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    return this.contacts.lookup(ctx, { email, phone });
  }

  @Get(':id')
  findOne(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.findOne(ctx, id);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateContactDto) {
    return this.contacts.create(ctx, dto);
  }

  /** KALICI silme — servis katmanı super_admin zorlar (diğer roller 404). */
  @Delete(':id')
  remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.remove(ctx, id);
  }
}
