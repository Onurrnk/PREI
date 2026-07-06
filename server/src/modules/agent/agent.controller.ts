// =====================================================================
// PREI | AgentController — POST /api/agent/whatsapp-event (OV-4)
// AgentKeyGuard: yalnız X-Agent-Key ile; bağlam service_agent. n8n çağırır.
// =====================================================================
import { Body, Controller, Post, UseGuards, HttpCode } from '@nestjs/common';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { AgentService } from './agent.service';
import { WhatsAppEventDto } from './dto/whatsapp-event.dto';

@Controller('agent')
@UseGuards(AgentKeyGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('whatsapp-event')
  @HttpCode(200)
  ingest(@Ctx() ctx: RequestContext, @Body() dto: WhatsAppEventDto) {
    return this.agent.ingest(ctx, dto);
  }
}
