import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CorrelationMiddleware } from './common/correlation.middleware';
import { CTX_KEY } from './common/request-context';
import { AuthModule } from './modules/auth/auth.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ClientsModule } from './modules/clients/clients.module';
import { LeadsModule } from './modules/leads/leads.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinancialsModule } from './modules/financials/financials.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { AdminModule } from './modules/admin/admin.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { UsersModule } from './modules/users/users.module';
import { AgentModule } from './modules/agent/agent.module';
import { HealthModule } from './modules/health/health.module';
import { MeModule } from './modules/me/me.module';

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
    ClientsModule,
    GmailModule,
    LeadsModule,
    CatalogModule,
    ContractsModule,
    ProposalsModule,
    TasksModule,
    MeetingsModule,
    DashboardModule,
    FinancialsModule,
    MarketingModule,
    AdminModule,
    DocumentsModule,
    UsersModule,
    AgentModule,
    HealthModule,
    MeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Sentry (E1): beklenmeyen hataları (5xx / HttpException-olmayan)
    // raporlar; 4xx HttpException'lar normal akışta kalır, raporlanmaz.
    // DSN yoksa (lokal dev) filter zararsız pass-through'dur.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Her isteğe correlation-id + boş bağlam (guard'lar doldurur).
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
