// =====================================================================
// PREI | SubmissionTokenGuard — public geliştirici gönderim ucu koruması.
// URL'deki :token'ı DatabaseService.raw (RLS-bypass sistem sorgusu) ile
// doğrular; geçerliyse istek bağlamını token'ın tenant'ıyla + service_agent
// rolüyle doldurur (AgentKeyGuard deseni). Kullanıcı yok (public), userId=null.
// =====================================================================
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { CTX_KEY, type WithContext } from '../../common/request-context';

export interface InviteContext {
  inviteId: string;
  developerId: string | null;
  developerName: string | null;
  tenantId: string;
  label: string | null;
}

export interface WithInvite {
  preiInvite?: InviteContext;
}

@Injectable()
export class SubmissionTokenGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & WithContext & WithInvite>();
    const ctx = req[CTX_KEY];
    if (!ctx) throw new UnauthorizedException('İstek bağlamı yok');

    const token = String(req.params?.token ?? '').trim();
    if (!token || token.length < 16) throw new UnauthorizedException('Geçersiz davet linki');

    const rows = await this.db.raw<{
      id: string; tenant_id: string; developer_id: string | null; developer_name: string | null; label: string | null;
    }>(
      `SELECT i.id, i.tenant_id, i.developer_id, o.name AS developer_name, i.label
         FROM project_invites i
         LEFT JOIN organizations o ON o.id = i.developer_id
        WHERE i.token = $1
          AND i.revoked_at IS NULL
          AND (i.expires_at IS NULL OR i.expires_at > now())
          AND (i.max_uses IS NULL OR i.used_count < i.max_uses)
        LIMIT 1`,
      [token],
    );
    if (rows.length === 0) throw new UnauthorizedException('Geçersiz veya süresi dolmuş davet linki');

    const inv = rows[0];
    ctx.tenantId = inv.tenant_id;
    ctx.userId = null;
    ctx.role = 'service_agent';
    ctx.authenticated = true;

    req.preiInvite = {
      inviteId: inv.id,
      developerId: inv.developer_id,
      developerName: inv.developer_name,
      tenantId: inv.tenant_id,
      label: inv.label,
    };
    return true;
  }
}
