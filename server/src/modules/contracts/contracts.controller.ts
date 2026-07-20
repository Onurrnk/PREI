// =====================================================================
// PREI | ContractsController — /api/contracts (salt-okuma).
// 'contracts' izni; finance_manager + manager + super_admin görebilir.
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
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract-write.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.contracts.list(ctx, Math.min(limit, 200), offset);
  }

  @Get(':id')
  findOne(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.contracts.findOne(ctx, id);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateContractDto) {
    return this.contracts.create(ctx, dto);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contracts.update(ctx, id, dto);
  }
}
