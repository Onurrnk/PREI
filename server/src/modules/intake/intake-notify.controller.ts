// =====================================================================
// PREI | IntakeNotifyController — /api/intake/notify (n8n, AgentKeyGuard)
// Faz 2: onaylanan projelere kriter-eşleşen izinli müşteriler için markalı
// bildirim adaylarını döndürür; gönderim sonrası işaretler (idempotent).
// n8n günlük iş: candidates → agent-mail.php → mark.
// =====================================================================
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { IntakeService } from './intake.service';
import { IsArray, IsUUID } from 'class-validator';

class MarkNotifiedDto {
  @IsUUID()
  contactId!: string;

  @IsArray() @IsUUID('all', { each: true })
  propertyIds!: string[];
}

@Controller('intake/notify')
@UseGuards(AgentKeyGuard)
export class IntakeNotifyController {
  constructor(private readonly intake: IntakeService) {}

  @Get('candidates')
  candidates(@Ctx() ctx: RequestContext) {
    return this.intake.notifyCandidates(ctx);
  }

  @Post('mark')
  async mark(@Ctx() ctx: RequestContext, @Body() dto: MarkNotifiedDto) {
    const marked = await this.intake.markNotified(ctx, dto.contactId, dto.propertyIds);
    return { marked };
  }
}
