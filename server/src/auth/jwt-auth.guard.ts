// =====================================================================
// PREI | JwtAuthGuard — Supabase Auth JWT doğrular, PREI principal'ını çözer
// DEBT-GMAIL-002: userId/tenantId DAİMA doğrulanmış JWT'den türetilir;
// asla query/body'den güvenilmez. Çözüm: JWT email → PREI users satırı + rol.
// Dev modunda (jwtSecret yoksa) x-dev-user header'ı ile test principal'ı.
// =====================================================================
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import type { Request } from 'express';
import type { AppConfig } from '../config/configuration';
import { DatabaseService } from '../database/database.service';
import { CTX_KEY, type AppRole, type RequestContext, type WithContext } from '../common/request-context';

interface PrincipalRow {
  user_id: string;
  tenant_id: string;
  role: AppRole;
}

// Rol öncelik sırası (birden çok rolde en yetkili seçilir)
const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 6, manager: 5, finance_manager: 4, marketing_manager: 3,
  consultant: 2, service_agent: 1,
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & WithContext>();
    const ctx = req[CTX_KEY];
    if (!ctx) throw new UnauthorizedException('İstek bağlamı yok');

    const email = await this.resolveEmail(req);
    if (!email) throw new UnauthorizedException('Geçersiz veya eksik kimlik');

    const principal = await this.resolvePrincipal(email);
    if (!principal) throw new UnauthorizedException('Bu e-posta için yetkili kullanıcı yok');

    ctx.tenantId = principal.tenant_id;
    ctx.userId = principal.user_id;
    ctx.role = principal.role;
    ctx.authenticated = true;
    return true;
  }

  /** JWT'den (veya dev header'dan) doğrulanmış e-postayı çıkarır. */
  private async resolveEmail(req: Request): Promise<string | null> {
    const secret = this.config.get('supabase', { infer: true }).jwtSecret;

    if (secret) {
      const auth = req.header('authorization');
      const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
        const email = typeof payload.email === 'string' ? payload.email : null;
        return email?.toLowerCase() ?? null;
      } catch (err) {
        this.logger.warn(`JWT doğrulama başarısız: ${(err as Error).message}`);
        return null;
      }
    }

    // DEV modu (jwtSecret yok): yalnız üretim-dışı; gerçek auth kurulana kadar test.
    if (process.env.NODE_ENV !== 'production') {
      const devUser = req.header('x-dev-user');
      if (devUser) {
        this.logger.warn(`DEV auth: x-dev-user=${devUser} (üretimde ASLA aktif olmaz)`);
        return devUser.toLowerCase();
      }
    }
    return null;
  }

  /** E-posta → PREI users satırı + en yetkili rol (tenant öncesi sistem sorgusu). */
  private async resolvePrincipal(email: string): Promise<PrincipalRow | null> {
    const rows = await this.db.raw<{ user_id: string; tenant_id: string; role: AppRole }>(
      `SELECT u.id AS user_id, u.tenant_id, r.key AS role
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
        WHERE lower(u.email) = $1 AND u.deleted_at IS NULL AND u.is_active = true`,
      [email],
    );
    if (rows.length === 0) return null;
    rows.sort((a, b) => (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0));
    return rows[0];
  }
}
