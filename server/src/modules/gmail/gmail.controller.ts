// =====================================================================
// PREI | Gmail controller (thin)
// DEBT-GMAIL-002 KAPANDI: userId artık query param'dan DEĞİL, doğrulanmış
// JWT bağlamından (ctx.userId) gelir. Yabancı userId gönderilse bile yok
// sayılır; JwtAuthGuard + RbacGuard('documents') tüm route'ları korur.
// =====================================================================
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { GmailService } from './gmail.service';
import { SendEmailDTO, type ThreadDetailDTO, type ThreadSummaryDTO } from './dto/email.dto';

@Controller('gmail')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('documents')
export class GmailController {
  constructor(private readonly gmail: GmailService) {}

  @Get('threads')
  listThreads(
    @Ctx() ctx: RequestContext,
    @Query('q') q?: string,
    @Query('maxResults') maxResults?: string,
  ): Promise<ThreadSummaryDTO[]> {
    const limit = maxResults ? parseInt(maxResults, 10) : 20;
    return this.gmail.listThreads(ctx.userId!, q, Number.isNaN(limit) ? 20 : limit);
  }

  @Get('threads/:id')
  getThread(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<ThreadDetailDTO> {
    return this.gmail.getThread(ctx.userId!, id);
  }

  @Post('send')
  send(
    @Ctx() ctx: RequestContext,
    @Body() dto: SendEmailDTO,
  ): Promise<{ id: string; threadId: string }> {
    return this.gmail.sendEmail(ctx.userId!, dto);
  }
}
