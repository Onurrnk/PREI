// =====================================================================
// PREI | IntakeIngestController — /api/intake/ingest (n8n, AgentKeyGuard)
// Faz 3: info@ kutusundan gelen mail n8n'de LLM ile alanlara çevrilir, bu uca
// POST edilir. Backend TASLAK (pending) gönderi üretir → aynı onay kuyruğu
// (mükerrer + ön-kontrol + Faz 1.5 güncelleme). Dosya/otomatik-aktifleşme YOK;
// Onur inceleyip onaylar (plan: onaylı-taslak şart, komisyon/fiyat yanlışı
// müşteriye gitmesin).
// =====================================================================
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { IntakeService } from './intake.service';
import { EmailDraftDto } from './dto/intake.dto';

@Controller('intake/ingest')
@UseGuards(AgentKeyGuard)
export class IntakeIngestController {
  constructor(private readonly intake: IntakeService) {}

  @Post('email')
  email(@Ctx() ctx: RequestContext, @Body() dto: EmailDraftDto) {
    return this.intake.createEmailDraft(ctx, dto);
  }
}
