// =====================================================================
// PREI | MeetingsController — /api/meetings (takvim, salt-okuma). 'meetings' izni.
// =====================================================================
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { MeetingsService } from './meetings.service';

@Controller('meetings')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.meetings.list(ctx);
  }
}
