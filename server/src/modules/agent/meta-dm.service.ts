// =====================================================================
// PREI | MetaDmService — Instagram / Messenger DM köprüsü.
// Sorumluluk: gelen DM'i PREI'ye kaydet (contact+lead+communication) ve
// Eylül'ün cevabını Graph API ile gönder. Beyin (RAG + LLM) n8n'de kalır;
// bu servis kimlik/erişim ve kayıt tarafını üstlenir — Meta token'ı yalnız
// backend'de durur, n8n'e verilmez.
//
// Kimlik: gönderenin IGSID/PSID'si kanal handle'ı olarak saklanır
// (metadata.channel_handles) → Telegram'daki mükerrer-kayıt hatasının aynısı
// burada oluşmaz; aynı kişi yazınca aynı dosyaya düşer.
// =====================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import type { MetaDmMessage } from './meta-dm.util';

const GRAPH = 'https://graph.facebook.com';

export interface MetaDmIngestResult {
  contactId: string;
  leadId: string;
  deduped: boolean;
}

@Injectable()
export class MetaDmService {
  private readonly logger = new Logger(MetaDmService.name);
  private pageTokenCache: { token: string; at: number } | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Webhook'un kendi bağlamı yok (Meta çağırır, X-Agent-Key göndermez) —
   * AgentKeyGuard ile AYNI servis principal'ını çözeriz: bağlam service_agent
   * rolüyle kurulur, RLS böylece doğru tenant'ta çalışır.
   */
  async serviceContext(correlationId: string): Promise<RequestContext> {
    const rows = await this.db.raw<{ user_id: string; tenant_id: string }>(
      `SELECT id AS user_id, tenant_id FROM users WHERE email = $1 AND is_active = true`,
      ['agent.eylul@prei.system'],
    );
    if (rows.length === 0) throw new Error('Agent principal bulunamadı');
    return {
      correlationId,
      tenantId: rows[0].tenant_id,
      userId: rows[0].user_id,
      role: 'service_agent',
      authenticated: true,
    };
  }

  /**
   * Sayfa erişim token'ı (mesaj göndermek için gerekir) — kullanıcı token'ı
   * ile çekilir, 10 dk önbelleklenir. Sayfa atanmamışsa null.
   */
  private async pageToken(): Promise<string | null> {
    const now = Date.now();
    if (this.pageTokenCache && now - this.pageTokenCache.at < 10 * 60_000) {
      return this.pageTokenCache.token;
    }
    const ads = this.config.get('metaAds', { infer: true });
    const dm = this.config.get('metaDm', { infer: true });
    if (!ads.accessToken || !dm.pageId) return null;
    try {
      const res = await fetch(
        `${GRAPH}/${ads.apiVersion}/${dm.pageId}?fields=access_token&access_token=${encodeURIComponent(ads.accessToken)}`,
      );
      const json = (await res.json()) as { access_token?: string; error?: { message?: string } };
      if (!res.ok || !json.access_token) {
        this.logger.warn(`Sayfa token'ı alınamadı: ${json.error?.message ?? res.status}`);
        return null;
      }
      this.pageTokenCache = { token: json.access_token, at: now };
      return json.access_token;
    } catch (e) {
      this.logger.warn(`Sayfa token'ı hatası: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Gelen DM'i PREI'ye yazar: kişi (kanal handle'ıyla eşleşir/oluşur) →
   * açık lead → communications(inbound). Aynı Meta mesajı iki kez gelirse
   * (Meta tekrar dener) idempotent davranır.
   */
  async ingest(ctx: RequestContext, msg: MetaDmMessage, senderName?: string): Promise<MetaDmIngestResult> {
    return this.db.withContext(ctx, async (c) => {
      // Idempotency: aynı Meta mesaj kimliği zaten işlendiyse tekrar yazma.
      if (msg.messageId) {
        const { rows: dup } = await c.query<{ contact_id: string; lead_id: string | null }>(
          `SELECT contact_id, lead_id FROM communications
            WHERE tenant_id = $1 AND channel = $2 AND external_id = $3 LIMIT 1`,
          [ctx.tenantId, msg.channel, msg.messageId],
        );
        if (dup.length > 0) {
          return { contactId: dup[0].contact_id, leadId: dup[0].lead_id ?? '', deduped: true };
        }
      }

      // Kişi: kanal handle'ı KALICI çapadır (telefon/e-posta sonradan
      // öğrenilip değişse bile eşleşme kopmaz).
      const { rows: found } = await c.query<{ id: string }>(
        `SELECT id FROM contacts
          WHERE tenant_id = $1 AND metadata->'channel_handles'->>$2 = $3
            AND deleted_at IS NULL AND merged_into_id IS NULL
          LIMIT 1`,
        [ctx.tenantId, msg.channel, msg.senderId],
      );
      let contactId = found[0]?.id ?? null;
      if (!contactId) {
        const label = senderName?.trim() || (msg.channel === 'instagram' ? 'Instagram' : 'Facebook');
        const parts = label.split(/\s+/);
        const { rows: created } = await c.query<{ id: string }>(
          `INSERT INTO contacts (tenant_id, first_name, last_name, metadata, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
          [ctx.tenantId, parts[0], parts.slice(1).join(' ') || null,
           JSON.stringify({ channel_handles: { [msg.channel]: msg.senderId } }), ctx.userId],
        );
        contactId = created[0].id;
      }

      // Açık lead (yoksa oluştur)
      const { rows: leadRows } = await c.query<{ id: string }>(
        `SELECT id FROM leads
          WHERE tenant_id = $1 AND contact_id = $2 AND deleted_at IS NULL
            AND status NOT IN ('converted','lost')
          ORDER BY created_at DESC LIMIT 1`,
        [ctx.tenantId, contactId],
      );
      let leadId = leadRows[0]?.id ?? null;
      if (!leadId) {
        const { rows: newLead } = await c.query<{ id: string }>(
          `INSERT INTO leads (tenant_id, contact_id, status, created_by, updated_by)
           VALUES ($1,$2,'new',$3,$3) RETURNING id`,
          [ctx.tenantId, contactId, ctx.userId],
        );
        leadId = newLead[0].id;
        await c.query(
          `INSERT INTO events (tenant_id, aggregate_type, aggregate_id, event_type, payload, correlation_id, created_by)
           VALUES ($1,'lead',$2,'lead.created',$3,$4,$5)`,
          [ctx.tenantId, leadId, JSON.stringify({ via: `${msg.channel}_dm` }), ctx.correlationId, ctx.userId],
        );
      }

      await c.query(
        `INSERT INTO communications (tenant_id, lead_id, contact_id, channel, direction, body, external_id, sent_at, created_by)
         VALUES ($1,$2,$3,$4,'inbound',$5,$6,to_timestamp($7),$8)`,
        [ctx.tenantId, leadId, contactId, msg.channel, msg.text, msg.messageId || null,
         Math.floor(msg.timestamp / 1000), ctx.userId],
      );

      return { contactId, leadId, deduped: false };
    });
  }

  /** Eylül'ün cevabını Meta'ya gönderir + outbound olarak kaydeder. */
  async reply(
    ctx: RequestContext,
    input: { channel: 'instagram' | 'facebook'; recipientId: string; text: string; leadId?: string; contactId?: string },
  ): Promise<{ sent: boolean; message?: string }> {
    const token = await this.pageToken();
    if (!token) {
      return { sent: false, message: 'Sayfa erişim jetonu yok (sayfa PREI CRM sistem kullanıcısına atanmamış olabilir).' };
    }
    const ads = this.config.get('metaAds', { infer: true });
    const dm = this.config.get('metaDm', { infer: true });

    try {
      const res = await fetch(`${GRAPH}/${ads.apiVersion}/${dm.pageId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: input.recipientId },
          message: { text: input.text },
          messaging_type: 'RESPONSE',
          access_token: token,
        }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok || json.error) {
        const message = json.error?.message ?? `HTTP ${res.status}`;
        this.logger.warn(`Meta DM gönderilemedi (${input.channel}): ${message}`);
        return { sent: false, message };
      }
    } catch (e) {
      const message = (e as Error).message;
      this.logger.warn(`Meta DM ağ hatası: ${message}`);
      return { sent: false, message };
    }

    // Gönderilen mesajı konuşma geçmişine yaz (Eylül'ün hafızası buradan okur).
    if (input.leadId && input.contactId) {
      await this.db.withContext(ctx, (c) =>
        c.query(
          `INSERT INTO communications (tenant_id, lead_id, contact_id, channel, direction, body, sent_at, created_by)
           VALUES ($1,$2,$3,$4,'outbound',$5,now(),$6)`,
          [ctx.tenantId, input.leadId, input.contactId, input.channel, input.text, ctx.userId],
        ),
      ).catch((e) => this.logger.warn(`Outbound kaydı yazılamadı: ${(e as Error).message}`));
    }
    return { sent: true };
  }

  /** Gönderenin görünen adı (IG kullanıcı adı) — yoksa null. */
  async fetchSenderName(senderId: string): Promise<string | null> {
    const token = await this.pageToken();
    if (!token) return null;
    const ads = this.config.get('metaAds', { infer: true });
    try {
      const res = await fetch(
        `${GRAPH}/${ads.apiVersion}/${senderId}?fields=name,username&access_token=${encodeURIComponent(token)}`,
      );
      const json = (await res.json()) as { name?: string; username?: string };
      return json.name?.trim() || json.username?.trim() || null;
    } catch {
      return null;
    }
  }
}
