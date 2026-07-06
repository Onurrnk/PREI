import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CorrelationMiddleware } from './common/correlation.middleware';
import { CTX_KEY } from './common/request-context';
import { AuthModule } from './modules/auth/auth.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { LeadsModule } from './modules/leads/leads.module';
import { AgentModule } from './modules/agent/agent.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // F10: yapılandırılmış log; her satıra correlation_id (req bağlamından).
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        // Log'a correlation_id + (maskeli) principal ekle
        customProps: (req) => {
          const ctx = (req as unknown as Record<string, unknown>)[CTX_KEY] as
            | { correlationId?: string; tenantId?: string | null; userId?: string | null; role?: string | null }
            | undefined;
          return {
            correlation_id: ctx?.correlationId,
            tenant_id: ctx?.tenantId ?? undefined,
            user_id: ctx?.userId ?? undefined,
            role: ctx?.role ?? undefined,
          };
        },
        redact: ['req.headers.authorization', 'req.headers["x-agent-key"]', 'req.headers.cookie'],
      },
    }),
    // G-3: global rate limiting (IP bazlı; 60 istek / dakika).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    AuthModule,
    ContactsModule,
    GmailModule,
    LeadsModule,
    AgentModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Her isteğe correlation-id + boş bağlam (guard'lar doldurur).
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
