// =====================================================================
// PREI | Correlation middleware — her isteğe correlationId + boş bağlam
// F10: UI→API→DB→audit zincirini tek request_id ile bağlar. İstemci
// X-Correlation-Id gönderirse korunur, yoksa üretilir.
// =====================================================================
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CTX_KEY, type RequestContext, type WithContext } from './request-context';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request & WithContext, res: Response, next: NextFunction): void {
    const incoming = req.header('x-correlation-id');
    const correlationId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : uuidv4();
    const ctx: RequestContext = {
      correlationId,
      tenantId: null,
      userId: null,
      role: null,
      authenticated: false,
    };
    req[CTX_KEY] = ctx;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  }
}
