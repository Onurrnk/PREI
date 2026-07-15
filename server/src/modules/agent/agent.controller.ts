// =====================================================================
// PREI | AgentController — POST /api/agent/whatsapp-event (OV-4)
// AgentKeyGuard: yalnız X-Agent-Key ile; bağlam service_agent. n8n çağırır.
// =====================================================================
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query,
  DefaultValuePipe, ParseIntPipe, UseGuards, HttpCode,
} from '@nestjs/common';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { AgentService } from './agent.service';
import { WhatsAppEventDto } from './dto/whatsapp-event.dto';
import { LeadScoreEventDto } from './dto/lead-score-event.dto';
import { KnowledgeSearchDto } from './dto/knowledge-search.dto';
import { OutboundMessageDto } from './dto/outbound-message.dto';
import { LeadProfileDto } from './dto/lead-profile.dto';

@Controller('agent')
@UseGuards(AgentKeyGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('whatsapp-event')
  @HttpCode(200)
  ingest(@Ctx() ctx: RequestContext, @Body() dto: WhatsAppEventDto) {
    return this.agent.ingest(ctx, dto);
  }

  @Post('lead-score')
  @HttpCode(200)
  scoreLead(@Ctx() ctx: RequestContext, @Body() dto: LeadScoreEventDto) {
    return this.agent.scoreLead(ctx, dto);
  }

  @Get('leads')
  leadsNeedingScore(@Ctx() ctx: RequestContext) {
    return this.agent.leadsNeedingScore(ctx);
  }

  @Get('leads/:id/communications')
  leadCommunications(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agent.leadCommunications(ctx, id);
  }

  @Post('knowledge/search')
  @HttpCode(200)
  searchKnowledge(@Ctx() ctx: RequestContext, @Body() dto: KnowledgeSearchDto) {
    return this.agent.searchKnowledge(ctx, dto);
  }

  @Post('outbound-message')
  @HttpCode(200)
  recordOutboundMessage(@Ctx() ctx: RequestContext, @Body() dto: OutboundMessageDto) {
    return this.agent.recordOutboundMessage(ctx, dto);
  }

  @Post('lead-profile')
  @HttpCode(200)
  updateLeadProfile(@Ctx() ctx: RequestContext, @Body() dto: LeadProfileDto) {
    return this.agent.updateLeadProfile(ctx, dto);
  }

  @Get('proposals/stale')
  proposalsNeedingFollowUp(
    @Ctx() ctx: RequestContext,
    @Query('days', new DefaultValuePipe(5), ParseIntPipe) days: number,
  ) {
    return this.agent.proposalsNeedingFollowUp(ctx, days);
  }

  @Post('proposals/:id/follow-up-sent')
  @HttpCode(200)
  markProposalFollowUpSent(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agent.markProposalFollowUpSent(ctx, id);
  }

  @Get('clients/active')
  activeClientEmails(@Ctx() ctx: RequestContext) {
    return this.agent.activeClientEmails(ctx);
  }
}
