// =====================================================================
// PREI | RbacGuard — @RequirePermission ile işaretli endpoint'lerde izni
// backend'de zorlar (Blueprint §7.1: asıl kaynak backend). Deny-by-default:
// izni yoksa 404 döner (varlık ifşası yok — G-1).
// =====================================================================
import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY } from './require-permission.decorator';
import { can, type Permission } from './permissions';
import { CTX_KEY, type WithContext } from './request-context';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true; // izin işaretlenmemişse RBAC uygulanmaz (yalnız JwtAuthGuard yeter)

    const req = context.switchToHttp().getRequest<Request & WithContext>();
    const ctx = req[CTX_KEY];
    if (!can(ctx?.role, required)) {
      // 403 değil 404: rolü olmayan varlığın varlığını bile ifşa etme (G-1)
      throw new NotFoundException();
    }
    return true;
  }
}
