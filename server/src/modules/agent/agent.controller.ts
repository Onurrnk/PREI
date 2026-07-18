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
import { WebLeadDto } from './dto/web-lead.dto';
import { MeetingEventDto } from './dto/meeting-event.dto';
import { KnowledgeAddDto } from './dto/knowledge-add.dto';
import { AnalysisSentDto } from './dto/analysis-sent.dto';

@Controller('agent')
@UseGuards(AgentKeyGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('whatsapp-event')
  @HttpCode(200)
  ingest(@Ctx() ctx: RequestContext, @Body() dto: WhatsAppEventDto) {
    return this.agent.ingest(ctx, dto);
  }

  @Post('web-lead')
  @HttpCode(200)
  webLead(@Ctx() ctx: RequestContext, @Body() dto: WebLeadDto) {
    return this.agent.webLead(ctx, dto);
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

  @Get('leads/welcome-follow-up')
  welcomeFollowUpCandidates(
    @Ctx() ctx: RequestContext,
    @Query('days', new DefaultValuePipe(3), ParseIntPipe) days: number,
  ) {
    return this.agent.welcomeFollowUpCandidates(ctx, days);
  }

  @Post('contacts/:id/welcome-follow-up-sent')
  @HttpCode(200)
  markWelcomeFollowUpSent(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agent.markWelcomeFollowUpSent(ctx, id);
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

  /** Calendly randevusu → tasks(type=meeting); idempotent (external_id). */
  @Post('meeting')
  @HttpCode(200)
  recordMeeting(@Ctx() ctx: RequestContext, @Body() dto: MeetingEventDto) {
    return this.agent.recordMeeting(ctx, dto);
  }

  /** Welcome takibi de yanıtsız kalanları 'frozen' statüsüne çeker. */
  @Post('leads/freeze-stale')
  @HttpCode(200)
  freezeStale(
    @Ctx() ctx: RequestContext,
    @Query('days', new DefaultValuePipe(3), ParseIntPipe) days: number,
  ) {
    return this.agent.freezeStaleLeads(ctx, days);
  }

  /** Skor ≥70 veya yaklaşan randevusu olan, analiz maili bekleyen lead'ler. */
  @Get('leads/analysis-candidates')
  analysisCandidates(@Ctx() ctx: RequestContext) {
    return this.agent.analysisCandidates(ctx);
  }

  @Post('leads/:id/analysis-sent')
  @HttpCode(200)
  markAnalysisSent(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnalysisSentDto,
  ) {
    return this.agent.markAnalysisSent(ctx, id, dto);
  }

  /** Son N günün konuşmaları — haftalık kendini-geliştirme döngüsü hammadesi. */
  @Get('conversations/recent')
  recentConversations(
    @Ctx() ctx: RequestContext,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.agent.recentConversations(ctx, days);
  }

  /** Calendly free-tier senkronu: Gmail'deki bildirim eklerinden randevu tara. */
  @Post('calendly-email-sweep')
  @HttpCode(200)
  calendlySweep(
    @Ctx() ctx: RequestContext,
    @Query('days', new DefaultValuePipe(3), ParseIntPipe) days: number,
  ) {
    return this.agent.calendlyEmailSweep(ctx, days);
  }

  /** Onur'un onayladığı Q&A'yı bilgi bankasına ekler (RAG anında görür). */
  @Post('knowledge/add')
  @HttpCode(200)
  addKnowledge(@Ctx() ctx: RequestContext, @Body() dto: KnowledgeAddDto) {
    return this.agent.addKnowledge(ctx, dto);
  }
}
