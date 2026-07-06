// =====================================================================
// PREI | UsersController — /api/users (ekip listesi; görev atama/seçici için).
// 'tasks' izni (ekip üyeleri görevlerle ilişkili). Salt-okuma.
// =====================================================================
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('tasks')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.users.list(ctx);
  }
}
