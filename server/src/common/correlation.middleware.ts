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
    // correlation_id DB'de uuid tipinde (audit_log/events) → yalnız geçerli UUID
    // gelen header'ı koru, aksi halde yeni üret.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const incoming = req.header('x-correlation-id');
    const correlationId = incoming && UUID_RE.test(incoming) ? incoming : uuidv4();
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
