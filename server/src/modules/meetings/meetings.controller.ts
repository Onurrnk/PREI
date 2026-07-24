// =====================================================================
// PREI | MeetingsController — /api/meetings (takvim, list/create). 'meetings' izni.
// =====================================================================
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

@Controller('meetings')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.meetings.list(ctx);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateMeetingDto) {
    return this.meetings.create(ctx, dto);
  }

  @Patch(':id')
  update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeetingDto) {
    return this.meetings.update(ctx, id, dto);
  }

  @Delete(':id')
  remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.remove(ctx, id);
  }
}
