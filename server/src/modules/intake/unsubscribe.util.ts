// =====================================================================
// PREI | Abonelikten çıkma (KVKK) — imzalı token yardımcıları.
// Link tıklaması dış dünyadan gelir; contactId'yi HMAC ile imzalarız ki
// yalnız maili alan kişi geçerli linke sahip olsun (DB'de token saklamaya
// gerek yok). Secret: UNSUBSCRIBE_SECRET, yoksa AGENT_API_KEY (her ikisi de
// server-only; n8n zaten AGENT_API_KEY kullanıyor → garanti dolu).
// =====================================================================
import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.AGENT_API_KEY || '';
}

/** contactId için URL-safe imza (hex, ilk 32 karakter yeterli). */
export function signUnsubscribe(contactId: string, key = secret()): string {
  return createHmac('sha256', key).update(`unsub:${contactId}`).digest('hex').slice(0, 32);
}

/** Sabit-zamanlı doğrulama; secret boşsa daima false (güvenli varsayılan). */
export function verifyUnsubscribe(contactId: string, token: string, key = secret()): boolean {
  if (!key || !token) return false;
  const expected = signUnsubscribe(contactId, key);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Maile gömülecek tam abonelikten-çık URL'i. */
export function unsubscribeUrl(contactId: string, apiBase = process.env.PUBLIC_API_URL || 'https://api.produality.com'): string {
  const base = apiBase.replace(/\/$/, '');
  return `${base}/api/public/unsubscribe?c=${encodeURIComponent(contactId)}&t=${signUnsubscribe(contactId)}`;
}
