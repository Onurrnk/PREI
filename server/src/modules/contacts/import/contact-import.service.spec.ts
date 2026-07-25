import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ContactImportService, MAX_ROWS } from './contact-import.service';
import type { RequestContext } from '../../../common/request-context';

const ctx: RequestContext = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  role: 'super_admin',
  correlationId: 'test-corr',
} as RequestContext;

/**
 * Sahte PoolClient: her sorguyu kaydeder, SELECT'lere yapılandırılabilir
 * cevap döner. Gerçek Postgres'e gitmeden SQL akışının şeklini doğrular.
 */
class FakeClient {
  queries: Array<{ sql: string; params: unknown[] }> = [];
  /** e-posta/telefon → mevcut kişi kimliği (findByIdentity'yi taklit eder). */
  existing = new Map<string, string>();
  /** contact_id → mevcut hedefler ("CC|region"). */
  existingTargets = new Map<string, string[]>();
  private newId = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(sql: string, params: unknown[] = []): Promise<any> {
    this.queries.push({ sql, params });
    const s = sql.replace(/\s+/g, ' ').trim();

    if (s.startsWith('SELECT id FROM contacts')) {
      const key = String(params[1]);
      const id = this.existing.get(key);
      return { rows: id ? [{ id }] : [], rowCount: id ? 1 : 0 };
    }
    if (s.startsWith('SELECT country_code, region FROM investment_targets')) {
      const have = this.existingTargets.get(String(params[0])) ?? [];
      return {
        rows: have.map((h) => {
          const [country_code, region] = h.split('|');
          return { country_code, region: region || null };
        }),
        rowCount: have.length,
      };
    }
    if (s.startsWith('INSERT INTO contacts')) {
      this.newId += 1;
      return { rows: [{ id: `new-${this.newId}` }], rowCount: 1 };
    }
    if (s.startsWith('INSERT INTO investment_targets')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  /** Yazma niyeti taşıyan ifadeler — dryRun'da hiç olmamalı. */
  writes(): string[] {
    return this.queries
      .map((q) => q.sql.replace(/\s+/g, ' ').trim())
      .filter((s) => /^(INSERT|UPDATE|DELETE)\b/i.test(s));
  }
}

const makeService = (client: FakeClient): ContactImportService => new ContactImportService({
  // withContext'i taklit et: gerçek servis BEGIN/COMMIT'i kendisi sarıyor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withContext: async (_c: unknown, fn: (cl: unknown) => Promise<unknown>) => fn(client),
} as never);

const CSV = 'Ad Soyad;E-posta;Telefon;Ülke\n'
          + 'Ahmet Yılmaz;ahmet@ornek.com;0532 111 22 33;Dubai\n'
          + 'Ayşe Kaya;ayse@ornek.com;+44 7700 900123;İspanya';

describe('ContactImportService', () => {
  let client: FakeClient;

  beforeEach(() => { client = new FakeClient(); });

  // Bu testin tek işi: önizlemenin geri alınamaz bir iz bırakmadığını
  // kanıtlamak. Arayüz kullanıcıya "hiçbir şey yazılmaz" diyor.
  it('önizleme TEK BİR yazma ifadesi çalıştırmaz', async () => {
    const svc = makeService(client);
    const r = await svc.run(ctx, CSV, { defaultDialCode: '90' }, true);

    expect(client.writes()).toEqual([]);
    expect(r.dryRun).toBe(true);
    expect(r.summary.created).toBe(2);
  });

  it('gerçek aktarım kişi + hedef + denetim kaydı yazar', async () => {
    const svc = makeService(client);
    const r = await svc.run(ctx, CSV, { defaultDialCode: '90' }, false);

    const writes = client.writes();
    expect(writes.filter((w) => w.startsWith('INSERT INTO contacts'))).toHaveLength(2);
    expect(writes.filter((w) => w.startsWith('INSERT INTO investment_targets'))).toHaveLength(2);
    // Denetim izi (F10): audit_log + events, her kişi için birer tane.
    expect(writes.filter((w) => w.startsWith('INSERT INTO audit_log'))).toHaveLength(2);
    expect(writes.filter((w) => w.startsWith('INSERT INTO events'))).toHaveLength(2);
    expect(r.summary).toMatchObject({ total: 2, created: 2, matched: 0, skipped: 0, targets: 2 });
  });

  // Toplu aktarımda mükerrer, tekil kayıttan FARKLI davranır: mevcut dosyaya
  // "🔁 Mükerrer kayıt" notu DÜŞMEZ. Aksi hâlde her yeniden yükleme
  // yüzlerce not biriktirirdi.
  it('sistemde kayıtlı kişi için mükerrer notu yazılmaz', async () => {
    client.existing.set('ahmet@ornek.com', 'mevcut-1');
    const svc = makeService(client);
    const r = await svc.run(ctx, CSV, { defaultDialCode: '90' }, false);

    expect(client.writes().some((w) => w.includes('meeting_notes'))).toBe(false);
    expect(r.summary.matched).toBe(1);
    expect(r.summary.created).toBe(1);
    expect(r.rows[0]).toMatchObject({
      outcome: 'matched', contactId: 'mevcut-1', matchedBy: 'e-posta',
    });
  });

  it('eşleşen kişiye yatırım hedefi eklenir (yeniden yükleme = zenginleştirme)', async () => {
    client.existing.set('ahmet@ornek.com', 'mevcut-1');
    const svc = makeService(client);
    await svc.run(ctx, CSV, {}, false);

    const targetInserts = client.queries.filter((q) =>
      q.sql.replace(/\s+/g, ' ').trim().startsWith('INSERT INTO investment_targets'));
    expect(targetInserts.some((q) => q.params[1] === 'mevcut-1')).toBe(true);
  });

  it('önizlemede eşleşen kişinin ZATEN olan hedefi sayılmaz', async () => {
    client.existing.set('ahmet@ornek.com', 'mevcut-1');
    client.existingTargets.set('mevcut-1', ['AE|Dubai']);
    const svc = makeService(client);
    const r = await svc.run(ctx, CSV, {}, true);

    expect(r.rows[0]).toMatchObject({ outcome: 'matched', targetsAdded: 0 });
    expect(r.rows[1].targetsAdded).toBe(1);
  });

  it('telefonla eşleşme de yakalanır', async () => {
    client.existing.set('905321112233', 'tel-1');
    const svc = makeService(client);
    const r = await svc.run(ctx, CSV, { defaultDialCode: '90' }, true);
    expect(r.rows[0]).toMatchObject({ outcome: 'matched', matchedBy: 'telefon' });
  });

  it('boş dosya reddedilir', async () => {
    const svc = makeService(client);
    await expect(svc.run(ctx, '   ', {}, true)).rejects.toThrow(BadRequestException);
  });

  it('yalnız başlık varsa reddedilir', async () => {
    const svc = makeService(client);
    await expect(svc.run(ctx, 'Ad;E-posta', {}, true)).rejects.toThrow(/veri satırı yok/);
  });

  // Sessizce 0 kayıt yazmak en kötü sonuç: kullanıcı "aktardım" sanır.
  it('kimlik kolonu tanınmazsa açık hata verir ve başlıkları gösterir', async () => {
    const svc = makeService(client);
    await expect(svc.run(ctx, 'Zümrüt;Kripto\na;b', {}, true))
      .rejects.toThrow(/Zümrüt \| Kripto/);
  });

  it('satır sınırı aşılırsa reddedilir', async () => {
    const big = `Ad;E-posta\n${Array.from({ length: MAX_ROWS + 1 },
      (_, i) => `Kişi${i};k${i}@x.com`).join('\n')}`;
    const svc = makeService(client);
    await expect(svc.run(ctx, big, {}, true)).rejects.toThrow(new RegExp(`${MAX_ROWS}`));
  });

  it('atlanan satır için yazma yapılmaz', async () => {
    const dup = 'Ad;E-posta\nAhmet;a@b.com\nAhmet;a@b.com';
    const svc = makeService(client);
    const r = await svc.run(ctx, dup, {}, false);

    expect(r.summary).toMatchObject({ created: 1, skipped: 1 });
    expect(client.writes().filter((w) => w.startsWith('INSERT INTO contacts'))).toHaveLength(1);
  });

  it('rapor ayırıcıyı ve kolon eşleşmesini geri bildirir', async () => {
    const svc = makeService(client);
    const r = await svc.run(ctx, CSV, {}, true);
    expect(r.delimiter).toBe(';');
    expect(r.mapping.map((m) => m.field)).toEqual(['fullName', 'email', 'phone', 'countries']);
    expect(r.unmappedHeaders).toEqual([]);
  });
});
