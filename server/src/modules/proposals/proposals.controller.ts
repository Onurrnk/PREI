// =====================================================================
// PREI | ProposalsController — /api/proposals (list/detail/create). 'proposals' izni.
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
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';

@Controller('proposals')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.proposals.list(ctx, Math.min(limit, 200), offset);
  }

  @Get(':id')
  findOne(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.findOne(ctx, id);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateProposalDto) {
    return this.proposals.create(ctx, dto);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProposalDto,
  ) {
    return this.proposals.update(ctx, id, dto);
  }

  @Post(':id/send')
  send(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.send(ctx, id);
  }
}
