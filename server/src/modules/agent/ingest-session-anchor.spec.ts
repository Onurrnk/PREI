// =====================================================================
// REGRESYON: Telegram'da konuşma hafızasının bölünmesi.
//
// Hata (2026-07-21, Kudret Kalyoncu görüşmesi): Telegram'da `phone` alanına
// chat id yazılıyor ve kişi bu alanla eşleştiriliyordu. Profil çıkarımı gerçek
// telefonu bulup kişiyi güncelleyince normalized_phone eşleşmesi kopuyor,
// sonraki her mesaj YENİ kişi+lead açıyordu. Geçmiş lead_id ile çekildiği için
// Eylül sıfırlanıyor ve zaten verilmiş bilgileri tekrar tekrar soruyordu.
//
// Düzeltme: kişi önce conversation_sessions.external_session_id (kararlı kanal
// dış-kimliği) üzerinden çözülür; yoksa eski telefon davranışına düşülür.
// =====================================================================
import { describe, it, expect, vi } from 'vitest';
import { AgentService } from './agent.service';
import type { RequestContext } from '../../common/request-context';

const ctx = {
  tenantId: 't1', userId: 'u1', role: 'service_agent', correlationId: 'c1',
} as unknown as RequestContext;

/** SQL desenine göre yanıt veren sahte PoolClient. */
function makeClient(opts: { sessionContactId?: string }) {
  const sqls: string[] = [];
  const query = vi.fn(async (sql: string) => {
    sqls.push(sql);
    if (/FROM conversation_sessions s\s+JOIN contacts ct/.test(sql)) {
      return { rows: opts.sessionContactId ? [{ contact_id: opts.sessionContactId }] : [] };
    }
    if (/SELECT id FROM contacts/.test(sql)) return { rows: [] };          // telefonla bulunamadı
    if (/INSERT INTO contacts/.test(sql)) return { rows: [{ id: 'YENI-KISI' }] };
    if (/FROM leads/.test(sql)) return { rows: [{ id: 'lead-1' }] };
    if (/INSERT INTO leads/.test(sql)) return { rows: [{ id: 'lead-1' }] };
    if (/FROM conversation_sessions/.test(sql)) return { rows: [{ id: 'sess-1' }] };
    if (/INSERT INTO conversation_sessions/.test(sql)) return { rows: [{ id: 'sess-1' }] };
    if (/FROM communications/.test(sql)) return { rows: [] };
    return { rows: [] };
  });
  return { client: { query } as never, sqls };
}

function makeService(client: unknown) {
  const db = { withContext: async (_c: unknown, fn: (cl: unknown) => unknown) => fn(client) };
  return new AgentService(db as never, { } as never);
}

const dto = {
  phone: '8981368094',           // Telegram chat id — kişinin GERÇEK telefonu değil
  message: 'Merhaba',
  channel: 'telegram',
  external_session_id: 'tg-8981368094',
} as never;

describe('agent ingest — oturum çapası (hafıza bölünmesi regresyonu)', () => {
  it('oturum varsa mevcut kişiyi kullanır; telefon değişmiş olsa bile YENİ kişi açmaz', async () => {
    const { client, sqls } = makeClient({ sessionContactId: 'MEVCUT-KISI' });
    const res = await makeService(client).ingest(ctx, dto);

    expect(res.contact_id).toBe('MEVCUT-KISI');
    // Kritik: yeni kişi INSERT'i yapılmamalı — hatanın ta kendisi buydu.
    expect(sqls.some((s) => /INSERT INTO contacts/.test(s))).toBe(false);
    // Telefonla arama denemesine bile gerek kalmamalı.
    expect(sqls.some((s) => /SELECT id FROM contacts/.test(s))).toBe(false);
  });

  it('oturum yoksa eski davranışa düşer: telefonla arar, bulamazsa kişi oluşturur', async () => {
    const { client, sqls } = makeClient({});               // oturum yok
    const res = await makeService(client).ingest(ctx, dto);

    expect(res.contact_id).toBe('YENI-KISI');
    expect(sqls.some((s) => /SELECT id FROM contacts/.test(s))).toBe(true);
    expect(sqls.some((s) => /INSERT INTO contacts/.test(s))).toBe(true);
  });

  it('external_session_id yoksa (WhatsApp) oturum sorgusu hiç çalışmaz', async () => {
    const { client, sqls } = makeClient({ sessionContactId: 'MEVCUT-KISI' });
    const waDto = { phone: '905551112233', message: 'Merhaba', channel: 'whatsapp' } as never;
    await makeService(client).ingest(ctx, waDto);

    expect(sqls.some((s) => /FROM conversation_sessions s\s+JOIN contacts ct/.test(s))).toBe(false);
    expect(sqls.some((s) => /SELECT id FROM contacts/.test(s))).toBe(true);
  });
});
