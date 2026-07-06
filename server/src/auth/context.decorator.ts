// =====================================================================
// PREI | @Ctx() — controller'lara doğrulanmış RequestContext'i enjekte eder.
// =====================================================================
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CTX_KEY, type RequestContext, type WithContext } from '../common/request-context';

export const Ctx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const req = ctx.switchToHttp().getRequest<Request & WithContext>();
    const c = req[CTX_KEY];
    if (!c) throw new Error('RequestContext yok — CorrelationMiddleware kayıtlı mı?');
    return c;
  },
);
