// =====================================================================
// PREI | AgentKeyGuard — n8n/Eylül ingest için scoped API-key doğrulaması.
// K-3/OV-4: n8n'e service_role verilmez; yalnız bu endpoint'e X-Agent-Key
// ile erişir. Bağlam service_agent rolüyle set edilir (komisyon HARİÇ).
// =====================================================================
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { CTX_KEY, type WithContext } from '../common/request-context';

const AGENT_EMAIL = 'agent.eylul@prei.system';

@Injectable()
export class AgentKeyGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & WithContext>();
    const ctx = req[CTX_KEY];
    if (!ctx) throw new UnauthorizedException('İstek bağlamı yok');

    const expected = process.env.AGENT_API_KEY ?? '';
    const provided = req.header('x-agent-key') ?? '';
    if (!expected || !this.safeEqual(provided, expected)) {
      throw new UnauthorizedException('Geçersiz agent anahtarı');
    }

    // Servis-principal'ı çöz (tenant + agent user id) — sistem sorgusu.
    const rows = await this.db.raw<{ user_id: string; tenant_id: string }>(
      `SELECT id AS user_id, tenant_id FROM users WHERE email = $1 AND is_active = true`,
      [AGENT_EMAIL],
    );
    if (rows.length === 0) throw new UnauthorizedException('Agent principal bulunamadı');

    ctx.tenantId = rows[0].tenant_id;
    ctx.userId = rows[0].user_id;
    ctx.role = 'service_agent';
    ctx.authenticated = true;
    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}
