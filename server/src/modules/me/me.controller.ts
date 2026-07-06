// =====================================================================
// PREI | GET /api/me — doğrulanmış kullanıcının profili + rolü.
// Frontend gerçek login sonrası rolü/kimliği buradan alır (RBAC UI gizleme).
// JwtAuthGuard ctx'i doldurur; userId/role JWT'den gelir (DEBT-GMAIL-002).
// =====================================================================
import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { DatabaseService } from '../../database/database.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async me(@Ctx() ctx: RequestContext) {
    if (!ctx.userId) throw new UnauthorizedException();
    const rows = await this.db.raw<{ id: string; email: string; full_name: string }>(
      `SELECT id, email, full_name FROM users WHERE id = $1 AND is_active = true`,
      [ctx.userId],
    );
    if (rows.length === 0) throw new UnauthorizedException();
    return {
      id: rows[0].id,
      email: rows[0].email,
      name: rows[0].full_name,
      role: ctx.role,           // 5 rol seti: super_admin | manager | finance_manager | marketing_manager | consultant
      tenantId: ctx.tenantId,
    };
  }
}
