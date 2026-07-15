// =====================================================================
// PREI | DevelopersController — /api/developers (organizations, list/detail/create/update).
// =====================================================================
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
  DefaultValuePipe, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { DevelopersService } from './developers.service';
import { CreateDeveloperDto, UpdateDeveloperDto } from './dto/create-developer.dto';

@Controller('developers')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('developers')
export class DevelopersController {
  constructor(private readonly developers: DevelopersService) {}

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
}
