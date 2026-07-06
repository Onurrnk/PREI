// =====================================================================
// PREI | JwtAuthGuard — Supabase Auth JWT doğrular, PREI principal'ını çözer
// DEBT-GMAIL-002: userId/tenantId DAİMA doğrulanmış JWT'den türetilir;
// asla query/body'den güvenilmez. Çözüm: doğrulanmış JWT email → PREI users
// satırı + rol.
//
// Doğrulama sırası:
//   1) SUPABASE_JWT_SECRET verilmişse → HS256 lokal (hızlı).
//   2) aksi halde → Supabase /auth/v1/user ile UZAKTAN doğrulama: imza
//      algoritmasından (HS256/ES256) ve anahtar rotasyonundan bağımsız,
//      secret gerektirmez. Kısa süreli in-memory cache ile hız.
//   3) NODE_ENV!=production ve JWT yoksa → dev x-dev-user header (test).
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

const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 6, manager: 5, finance_manager: 4, marketing_manager: 3,
  consultant: 2, service_agent: 1,
};

interface CacheEntry { email: string; exp: number }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  // token → {email, exp}: aynı token için /auth/v1/user çağrısını tekrarlama.
  private readonly cache = new Map<string, CacheEntry>();

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

  private async resolveEmail(req: Request): Promise<string | null> {
    const sb = this.config.get('supabase', { infer: true });
    const auth = req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    if (token) {
      // 1) HS256 lokal (secret verilmişse)
      if (sb.jwtSecret) {
        try {
          const { payload } = await jwtVerify(token, new TextEncoder().encode(sb.jwtSecret));
          return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
        } catch (err) {
          this.logger.warn(`HS256 doğrulama başarısız: ${(err as Error).message}`);
          return null;
        }
      }
      // 2) Uzaktan doğrulama (secret yok)
      return this.verifyRemote(token, sb.url, sb.anonKey);
    }

    // 3) DEV modu
    if (process.env.NODE_ENV !== 'production') {
      const devUser = req.header('x-dev-user');
      if (devUser) {
        this.logger.warn(`DEV auth: x-dev-user=${devUser} (üretimde ASLA aktif olmaz)`);
        return devUser.toLowerCase();
      }
    }
    return null;
  }

  /** Supabase /auth/v1/user ile token'ı sunucu tarafında doğrular. */
  private async verifyRemote(token: string, url: string, anonKey: string): Promise<string | null> {
    const now = Date.now();
    const cached = this.cache.get(token);
    if (cached && cached.exp > now) return cached.email;

    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      });
      if (!res.ok) {
        this.logger.warn(`Uzaktan doğrulama reddedildi: HTTP ${res.status}`);
        return null;
      }
      const user = (await res.json()) as { email?: string };
      const email = user.email?.toLowerCase() ?? null;
      if (email) {
        this.cache.set(token, { email, exp: now + 60_000 }); // 60 sn cache
        if (this.cache.size > 500) this.cache.clear(); // basit sınır
      }
      return email;
    } catch (err) {
      this.logger.error(`Uzaktan doğrulama hatası: ${(err as Error).message}`);
      return null;
    }
  }

  private async resolvePrincipal(email: string): Promise<{ user_id: string; tenant_id: string; role: AppRole } | null> {
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
