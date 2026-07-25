// =====================================================================
// PREI | MeetingBriefController — görüşme hazırlık brifingi uçları.
//
// İki kapı, aynı servis:
//   - JWT + 'leads' izni  → danışman arayüzden okur
//   - AgentKeyGuard       → n8n randevu/skor tetiğinde maile koyar
// =====================================================================
import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { MeetingBriefService } from './meeting-brief.service';

@Controller('leads')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('leads')
export class MeetingBriefController {
  constructor(private readonly briefs: MeetingBriefService) {}

  /** Ham dosya — model olmadan da danışmanın okuyabileceği her şey. */
  @Get(':id/dossier')
  dossier(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.briefs.dossier(ctx, id);
  }

  /** Hazırlık brifingi. force=1 → önbelleği atla, yeniden üret. */
  @Get(':id/brief')
  brief(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ) {
    return this.briefs.brief(ctx, id, force === '1' || force === 'true');
  }

  /** Elle yeniden üretme (arayüzdeki "Yenile" butonu). */
  @Post(':id/brief/regenerate')
  regenerate(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.briefs.brief(ctx, id, true);
  }
}

/**
 * n8n tarafı: randevu alındığında / skor eşiği geçildiğinde brifingi
 * çekip Onur Bey'e maille gönderir. Aynı servis, farklı kimlik doğrulama.
 */
@Controller('agent/leads')
@UseGuards(AgentKeyGuard)
export class AgentMeetingBriefController {
  constructor(private readonly briefs: MeetingBriefService) {}

  @Get(':id/brief')
  brief(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.briefs.brief(ctx, id);
  }

  @Get(':id/dossier')
  dossier(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.briefs.dossier(ctx, id);
  }
}
