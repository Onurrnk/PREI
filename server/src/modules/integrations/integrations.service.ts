// =====================================================================
// PREI | IntegrationsService — tüm entegrasyonların TEK listesi ve durumu.
//
// Amaç: kullanıcı Ayarlar'ı açtığında neyin bağlı, neyin bağlanabilir,
// neyin neden bağlanamadığını tek ekranda görsün. Bugün bu bilgi üç ayrı
// yerde: Google kendi akışında, Meta ortam değişkeninde, geri kalanlar
// arayüzde sabit "yakında" kutuları olarak.
//
// Google BİLEREK kendi akışında bırakıldı: çalışan, imzalı state'li,
// kritik bir entegrasyon. Buraya taşımak onu kırma riski taşır; bunun
// yerine durumu OKUNUR (users.metadata->'googleOAuth'). Yeni sağlayıcılar
// tenant_integrations tablosunu kullanır.
// =====================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import { PROVIDERS, providerById, type ProviderScope } from './provider-registry';

export interface IntegrationStatus {
  id: string;
  label: string;
  description: string;
  scope: ProviderScope;
  /** Bağlanabilir mi (dış onaylar tamamlanmış mı). */
  available: boolean;
  /** Hazır değilse insan-okur gerekçe. */
  blockedReason: string | null;
  connected: boolean;
  /** Bağlıysa hangi hesap ("info@produality.com", "@produality"). */
  accountLabel: string | null;
  connectedAt: string | null;
  lastError: string | null;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, lang: 'tr' | 'en' = 'tr'): Promise<IntegrationStatus[]> {
    const [google, kayitlar] = await this.db.withContext(ctx, async (c) => {
      const { rows: g } = await c.query<{ email: string | null; connected_at: string | null }>(
        `SELECT metadata->'googleOAuth'->>'email' AS email,
                (metadata->'googleOAuth'->>'connectedAt') AS connected_at
           FROM users
          WHERE id = $1 AND metadata ? 'googleOAuth'`,
        [ctx.userId],
      );
      const { rows: t } = await c.query<{
        provider: string; status: string; account_label: string | null;
        created_at: string; last_error: string | null;
      }>(
        `SELECT provider, status, account_label, created_at::text, last_error
           FROM tenant_integrations
          WHERE tenant_id = $1
            AND (scope = 'tenant' OR user_id = $2)`,
        [ctx.tenantId, ctx.userId],
      );
      return [g[0] ?? null, t] as const;
    });

    const byProvider = new Map(kayitlar.map((r) => [r.provider, r]));

    return PROVIDERS.map((p) => {
      const kayit = byProvider.get(p.id);
      // Google'ın gerçeği kendi akışında; tablodan değil oradan okunur.
      const bagli = p.id === 'google' ? !!google : kayit?.status === 'connected';
      return {
        id: p.id,
        label: p.label,
        description: p.description[lang],
        scope: p.scope,
        available: p.available,
        blockedReason: p.available ? null : (p.blockedReason?.[lang] ?? null),
        connected: bagli,
        accountLabel: p.id === 'google' ? google?.email ?? null : kayit?.account_label ?? null,
        connectedAt: p.id === 'google' ? google?.connected_at ?? null : kayit?.created_at ?? null,
        lastError: kayit?.last_error ?? null,
      };
    });
  }

  /**
   * Bağlantıyı kaldırır. Google için burada DEĞİL, kendi ucunda
   * (/api/auth/google/disconnect) — token iptali orada yapılıyor.
   */
  async disconnect(ctx: RequestContext, providerId: string): Promise<{ ok: true }> {
    const p = providerById(providerId);
    if (!p) throw new NotFoundException('Bilinmeyen entegrasyon.');
    if (p.id === 'google') {
      throw new NotFoundException('Google bağlantısı Ayarlar > Google bölümünden kaldırılır.');
    }
    await this.db.withContext(ctx, async (c) => {
      await c.query(
        `DELETE FROM tenant_integrations
          WHERE tenant_id = $1 AND provider = $2 AND (scope = 'tenant' OR user_id = $3)`,
        [ctx.tenantId, providerId, ctx.userId],
      );
    });
    this.logger.log(`Entegrasyon kaldırıldı: ${providerId}`);
    return { ok: true as const };
  }
}
