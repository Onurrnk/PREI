// =====================================================================
// PREI | Meta DM (Instagram / Messenger) — saf yardımcılar.
// Webhook doğrulaması ve yük normalleştirme burada; HTTP yok → birim test
// edilebilir. Meta iki farklı gövde şekli gönderir (instagram / page) ve
// aynı olayda ECHO (bizim gönderdiğimiz mesaj) da gelir — onu ayıklıyoruz,
// yoksa Eylül kendi mesajına cevap yazar (sonsuz döngü).
// =====================================================================
import { createHmac, timingSafeEqual } from 'crypto';

export interface MetaDmMessage {
  channel: 'instagram' | 'facebook';
  /** Gönderenin kanal-içi kalıcı kimliği (IGSID / PSID) — contact eşleşme çapası. */
  senderId: string;
  /** Mesajın gittiği sayfa/hesap kimliği. */
  recipientId: string;
  text: string;
  /** Meta mesaj kimliği — idempotency (aynı olay iki kez gelirse). */
  messageId: string;
  timestamp: number;
}

/**
 * X-Hub-Signature-256 doğrular (Meta ham gövde üzerinden HMAC-SHA256).
 * Zamanlama-güvenli karşılaştırma; imza yoksa/bozuksa false.
 */
export function verifyMetaSignature(rawBody: Buffer | string, header: string | undefined, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const prefix = 'sha256=';
  if (!header.startsWith(prefix)) return false;
  const provided = header.slice(prefix.length).trim();
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;

  const expected = createHmac('sha256', appSecret)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided.toLowerCase(), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook doğrulama el sıkışması (GET): token eşleşirse challenge döner. */
export function verifyChallenge(
  query: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string },
  expectedToken: string,
): string | null {
  if (!expectedToken) return null;
  if (query['hub.mode'] !== 'subscribe') return null;
  if (query['hub.verify_token'] !== expectedToken) return null;
  return query['hub.challenge'] ?? null;
}

interface RawMessaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    attachments?: unknown[];
  };
}

interface RawEntry {
  id?: string;
  time?: number;
  messaging?: RawMessaging[];
}

export interface RawWebhookBody {
  object?: string;         // 'instagram' | 'page'
  entry?: RawEntry[];
}

/**
 * Webhook gövdesinden işlenebilir METİN mesajlarını çıkarır.
 * Atlananlar: echo (kendi mesajımız), silinmiş, metinsiz (yalnız medya),
 * gönderen/kimlik eksik olanlar. Bilinmeyen `object` → boş liste.
 */
export function normalizeMetaWebhook(body: RawWebhookBody): MetaDmMessage[] {
  const channel: 'instagram' | 'facebook' | null =
    body?.object === 'instagram' ? 'instagram' : body?.object === 'page' ? 'facebook' : null;
  if (!channel || !Array.isArray(body.entry)) return [];

  const out: MetaDmMessage[] = [];
  for (const entry of body.entry) {
    for (const m of entry?.messaging ?? []) {
      const msg = m?.message;
      if (!msg || msg.is_echo || msg.is_deleted) continue;
      const text = typeof msg.text === 'string' ? msg.text.trim() : '';
      const senderId = m.sender?.id;
      if (!text || !senderId) continue;
      out.push({
        channel,
        senderId,
        recipientId: m.recipient?.id ?? entry?.id ?? '',
        text,
        messageId: msg.mid ?? '',
        timestamp: m.timestamp ?? entry?.time ?? Date.now(),
      });
    }
  }
  return out;
}
