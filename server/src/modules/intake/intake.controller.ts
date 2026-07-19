// =====================================================================
// PREI | IntakeController — /api/intake (admin/personel, JWT).
// Davet linki yönetimi + onay kuyruğu. 'projects' izni.
// =====================================================================
import {
  Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { IntakeService } from './intake.service';
import { CreateInviteDto, ReviewSubmissionDto } from './dto/intake.dto';

@Controller('intake')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('projects')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  // ---- Davet linkleri ----
  @Post('invites')
  createInvite(@Ctx() ctx: RequestContext, @Body() dto: CreateInviteDto) {
    return this.intake.createInvite(ctx, dto);
  }

  @Get('invites')
  listInvites(@Ctx() ctx: RequestContext) {
    return this.intake.listInvites(ctx);
  }

  @Delete('invites/:id')
  async revokeInvite(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    const ok = await this.intake.revokeInvite(ctx, id);
    if (!ok) throw new NotFoundException('Davet bulunamadı');
    return { revoked: true as const };
  }

  // ---- Onay kuyruğu ----
  @Get('queue')
  queue(@Ctx() ctx: RequestContext) {
    return this.intake.listQueue(ctx);
  }

  @Get('queue/count')
  queueCount(@Ctx() ctx: RequestContext) {
    return this.intake.pendingCount(ctx);
  }

  @Get('queue/:id')
  async review(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    const s = await this.intake.getForReview(ctx, id);
    if (!s) throw new NotFoundException('Gönderi bulunamadı');
    return s;
  }

  @Post('queue/:id/approve')
  async approve(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewSubmissionDto) {
    const res = await this.intake.approve(ctx, id, dto.mode ?? 'new');
    if (!res) throw new NotFoundException('Bekleyen gönderi bulunamadı');
    return { approved: true as const, propertyId: res.propertyId, updated: res.updated };
  }

  @Post('queue/:id/reject')
  async reject(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewSubmissionDto) {
    const ok = await this.intake.reject(ctx, id, dto.note ?? null);
    if (!ok) throw new NotFoundException('Bekleyen gönderi bulunamadı');
    return { rejected: true as const };
  }
}
