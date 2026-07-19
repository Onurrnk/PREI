// =====================================================================
// IntakeRepository.approve — Faz 1.5 onay modu (new vs update).
// withContext + client mock'lu: SQL içeriğine göre yanıt döner. Doğrular:
//  - mode='update' + property eşleşmesi → properties UPDATE (INSERT yok), updated=true
//  - mode='new' → properties INSERT, updated=false
//  - mode='update' ama eşleşme submission (property değil) → INSERT'e düşer
//  - mode='update' ama hedef property silinmiş → INSERT'e düşer
// =====================================================================
import { describe, it, expect, vi } from 'vitest';
import { IntakeRepository } from './intake.repository';
import type { RequestContext } from '../../common/request-context';

const ctx: RequestContext = {
  correlationId: 'c1', tenantId: 't1', userId: 'u1',
  role: 'super_admin' as RequestContext['role'], authenticated: true,
};

interface Sub { duplicate?: unknown }
const submissionRow = (dup: unknown) => ({
  id: 's1', status: 'pending', title: 'Emaar Beachfront', city: 'Dubai', district: null,
  market_code: 'AE', price_min: '500000', price_max: '900000', currency: 'AED',
  commission_pct: '5', unit_types: ['1+1'], description: 'x', latitude: null, longitude: null,
  image_urls: ['a.jpg'], brochure_path: 'sub/broc.pdf',
  payload: { brochureName: 'b.pdf', brochureSize: 10, duplicate: dup },
  developer_id: 'd1', developer_name: 'Emaar', created_property_id: null, review_note: null, created_at: 'now',
});

/** withContext'i çalıştıran, SQL içeriğine göre yanıt veren sahte DB. */
function repoWithClient(sub: ReturnType<typeof submissionRow>, opts: { propertyExists: boolean }) {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      if (/FROM project_submissions s/.test(sql) && /WHERE s\.id/.test(sql)) return { rows: [sub], rowCount: 1 };
      if (/SELECT id FROM properties WHERE id/.test(sql)) return { rows: opts.propertyExists ? [{ id: 'p1' }] : [], rowCount: opts.propertyExists ? 1 : 0 };
      if (/INSERT INTO properties/.test(sql)) return { rows: [{ id: 'new-prop' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }),
  };
  const db = { withContext: async (_c: RequestContext, fn: (cl: typeof client) => Promise<unknown>) => fn(client) };
  const repo = new IntakeRepository(db as never);
  return { repo, queries };
}

const propertyDup = { refType: 'property', refId: 'p1', refTitle: 'Emaar Beachfront', matchedBy: 'aynı geliştirici' };
const submissionDup = { refType: 'submission', refId: 's9', refTitle: 'Emaar Beachfront', matchedBy: 'aynı şehir' };

describe('IntakeRepository.approve — onay modu', () => {
  it("mode='update' + property eşleşmesi → UPDATE, INSERT yok, updated=true", async () => {
    const { repo, queries } = repoWithClient(submissionRow(propertyDup), { propertyExists: true });
    const res = await repo.approve(ctx, 's1', 'update');
    expect(res).toEqual({ propertyId: 'p1', updated: true });
    expect(queries.some((q) => /UPDATE properties/.test(q))).toBe(true);
    expect(queries.some((q) => /INSERT INTO properties/.test(q))).toBe(false);
  });

  it("mode='new' → INSERT, updated=false", async () => {
    const { repo, queries } = repoWithClient(submissionRow(propertyDup), { propertyExists: true });
    const res = await repo.approve(ctx, 's1', 'new');
    expect(res).toEqual({ propertyId: 'new-prop', updated: false });
    expect(queries.some((q) => /INSERT INTO properties/.test(q))).toBe(true);
  });

  it("mode='update' ama eşleşme submission → güvenli INSERT'e düşer", async () => {
    const { repo, queries } = repoWithClient(submissionRow(submissionDup), { propertyExists: true });
    const res = await repo.approve(ctx, 's1', 'update');
    expect(res?.updated).toBe(false);
    expect(queries.some((q) => /INSERT INTO properties/.test(q))).toBe(true);
  });

  it("mode='update' ama hedef property silinmiş → INSERT'e düşer", async () => {
    const { repo } = repoWithClient(submissionRow(propertyDup), { propertyExists: false });
    const res = await repo.approve(ctx, 's1', 'update');
    expect(res?.updated).toBe(false);
    expect(res?.propertyId).toBe('new-prop');
  });

  it('bekleyen gönderi yoksa → null', async () => {
    const empty = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    };
    const db = { withContext: async (_c: RequestContext, fn: (cl: typeof empty) => Promise<unknown>) => fn(empty) };
    const repo = new IntakeRepository(db as never);
    await expect(repo.approve(ctx, 'yok', 'update')).resolves.toBeNull();
  });
});
