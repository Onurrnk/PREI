// =====================================================================
// PREI | DatabaseService — RLS-aktif Postgres erişimi
// Her sorgu bir transaction içinde çalışır ve app.tenant_id/user_id/role
// GUC'lerini SET LOCAL ile yazar → RLS politikaları aktive olur (defense
// in depth). NOBYPASSRLS bir role bağlanınca RLS gerçekten zorlar; service
// katmanı ayrıca tenant_id ile scope'lar (belt & suspenders).
// =====================================================================
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { AppConfig } from '../config/configuration';
import type { RequestContext } from '../common/request-context';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const db = this.config.get('database', { infer: true });
    if (!db.url) {
      this.logger.warn('DATABASE_URL boş — DB çağrıları başarısız olacak. .env ayarla.');
    }
    this.pool = new Pool({
      connectionString: db.url,
      ssl: db.ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
    this.pool.on('error', (err) => this.logger.error('pg pool hatası', err.stack));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  /**
   * Bağlamsız (RLS-bypass gerektiren) sistem sorgusu — yalnız auth/bootstrap
   * gibi tenant öncesi işler için. GUC set edilmez.
   */
  async raw<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<T[]> {
    const res = await this.pool.query<T>(text, params as never[]);
    return res.rows;
  }

  /**
   * RLS bağlamında transaction: GUC'leri set eder, fn'i çalıştırır, commit/rollback.
   * ctx.userId/role/tenantId NULL ise ilgili GUC boş bırakılır (RLS reddeder).
   */
  async withContext<T>(
    ctx: RequestContext,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // set_config(key, value, is_local=true) → transaction-yerel, injection-güvenli
      await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', ctx.tenantId ?? '']);
      await client.query('SELECT set_config($1, $2, true)', ['app.user_id', ctx.userId ?? '']);
      await client.query('SELECT set_config($1, $2, true)', ['app.role', ctx.role ?? '']);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
