// =====================================================================
// IntakeRepository.findDuplicateProject — kaynak bağımsız mükerrer proje
// ön-kontrolü. db.raw (prei_bootstrap) mock'lu birim testi: başlık normalize
// edilir, boş başlıkta sorgu atılmaz, dönen satır DuplicateProjectMatch'e
// eşlenir (properties önce, sonra project_submissions).
// =====================================================================
import { describe, it, expect, vi } from 'vitest';
import { IntakeRepository } from './intake.repository';

const repoWithRaw = (raw: ReturnType<typeof vi.fn>) =>
  new IntakeRepository({ raw } as never);

describe('IntakeRepository.findDuplicateProject', () => {
  it('boş/whitespace başlık → null, sorgu HİÇ atılmaz', async () => {
    const raw = vi.fn();
    const repo = repoWithRaw(raw);
    await expect(
      repo.findDuplicateProject('t1', { title: '   ', developerId: 'd1', city: 'Dubai' }),
    ).resolves.toBeNull();
    expect(raw).not.toHaveBeenCalled();
  });

  it('başlık normalize edilir (küçük harf + boşluk sıkıştırma) ve param olarak geçer', async () => {
    const raw = vi.fn(async () => []);
    const repo = repoWithRaw(raw);
    await repo.findDuplicateProject('t1', {
      title: '  Emaar   Beachfront  ', developerId: 'd1', city: '  Dubai ',
    });
    expect(raw).toHaveBeenCalledTimes(1);
    const params = (raw.mock.calls[0] as unknown[])[1] as unknown[];
    expect(params[0]).toBe('t1');            // tenant elle süzülür (BYPASSRLS)
    expect(params[1]).toBe('d1');            // developerId
    expect(params[2]).toBe('emaar beachfront'); // normalize başlık
    expect(params[3]).toBe('dubai');         // normalize şehir
    expect(params[4]).toBeNull();            // excludeSubmissionId yok
  });

  it('eşleşme yoksa → null', async () => {
    const repo = repoWithRaw(vi.fn(async () => []));
    await expect(
      repo.findDuplicateProject('t1', { title: 'X', developerId: null, city: null }),
    ).resolves.toBeNull();
  });

  it('katalog eşleşmesi (property) → DuplicateProjectMatch olarak eşlenir', async () => {
    const raw = vi.fn(async () => [{
      ref_type: 'property', ref_id: 'p1', ref_title: 'Emaar Beachfront', matched_by: 'aynı geliştirici',
    }]);
    const repo = repoWithRaw(raw);
    await expect(
      repo.findDuplicateProject('t1', { title: 'Emaar Beachfront', developerId: 'd1', city: 'Dubai' }),
    ).resolves.toEqual({
      refType: 'property', refId: 'p1', refTitle: 'Emaar Beachfront', matchedBy: 'aynı geliştirici',
    });
  });

  it('bekleyen gönderi eşleşmesi (submission, aynı şehir) → eşlenir', async () => {
    const raw = vi.fn(async () => [{
      ref_type: 'submission', ref_id: 's9', ref_title: 'Marina Tower', matched_by: 'aynı şehir',
    }]);
    const repo = repoWithRaw(raw);
    await expect(
      repo.findDuplicateProject('t1', { title: 'Marina Tower', developerId: null, city: 'Dubai' }),
    ).resolves.toEqual({
      refType: 'submission', refId: 's9', refTitle: 'Marina Tower', matchedBy: 'aynı şehir',
    });
  });
});
