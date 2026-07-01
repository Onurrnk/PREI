// =====================================================================
// PREI | Gmail controller (thin)
// NOTE: `userId` is a placeholder for the authenticated PREI principal.
// Replace with the value from your JWT/auth guard. Tracked DEBT-GMAIL-002.
// =====================================================================
import { Body, Controller, Get, Param, Post, Query, BadRequestException } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { SendEmailDTO, type ThreadDetailDTO, type ThreadSummaryDTO } from './dto/email.dto';

@Controller('gmail')
export class GmailController {
  constructor(private readonly gmail: GmailService) {}

  @Get('threads')
  listThreads(
    @Query('userId') userId: string,
    @Query('q') q?: string,
    @Query('maxResults') maxResults?: string,
  ): Promise<ThreadSummaryDTO[]> {
    if (!userId) throw new BadRequestException('userId is required');
    const limit = maxResults ? parseInt(maxResults, 10) : 20;
    return this.gmail.listThreads(userId, q, Number.isNaN(limit) ? 20 : limit);
  }

  @Get('threads/:id')
  getThread(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<ThreadDetailDTO> {
    if (!userId) throw new BadRequestException('userId is required');
    return this.gmail.getThread(userId, id);
  }

  @Post('send')
  send(
    @Query('userId') userId: string,
    @Body() dto: SendEmailDTO,
  ): Promise<{ id: string; threadId: string }> {
    if (!userId) throw new BadRequestException('userId is required');
    return this.gmail.sendEmail(userId, dto);
  }
}
