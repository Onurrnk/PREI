// =====================================================================
// LeadsService.remove / ContactsService.remove — kalıcı silme yetki kapısı.
// Güvenlik regresyon testi: silme yalnız super_admin (G-1 deny→404);
// deal/iş-verisi bağı 409 ile korunur. Repo mock'lu (birim testi).
// =====================================================================
import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { ContactsService } from '../contacts/contacts.service';
import type { RequestContext } from '../../common/request-context';

const ctx = (role: string): RequestContext => ({
  correlationId: 'c1', tenantId: 't1', userId: 'u1',
  role: role as RequestContext['role'], authenticated: true,
});

const leadsWith = (removeResult: 'ok' | 'not_found' | 'has_deals') =>
  new LeadsService({ remove: vi.fn(async () => removeResult) } as never);

const contactsWith = (removeResult: 'ok' | 'not_found' | 'has_business') =>
  new ContactsService({ remove: vi.fn(async () => removeResult) } as never);

describe('LeadsService.remove (kalıcı silme)', () => {
  it('super_admin + mevcut lead → siler', async () => {
    await expect(leadsWith('ok').remove(ctx('super_admin'), 'l1'))
      .resolves.toEqual({ deleted: true });
  });

  it('super_admin olmayan roller → 404 (repo hiç çağrılmaz)', async () => {
    for (const role of ['consultant', 'finance_manager', 'marketing_manager', 'service_agent']) {
      const repo = { remove: vi.fn() };
      const svc = new LeadsService(repo as never);
      await expect(svc.remove(ctx(role), 'l1')).rejects.toThrow(NotFoundException);
      expect(repo.remove).not.toHaveBeenCalled();
    }
  });

  it('lead bulunamazsa → 404', async () => {
    await expect(leadsWith('not_found').remove(ctx('super_admin'), 'yok'))
      .rejects.toThrow(NotFoundException);
  });

  it("deal'e bağlı lead → 409 (iş verisi koruması)", async () => {
    await expect(leadsWith('has_deals').remove(ctx('super_admin'), 'l1'))
      .rejects.toThrow(ConflictException);
  });
});

describe('ContactsService.remove (kalıcı silme)', () => {
  it('super_admin + mevcut kişi → siler', async () => {
    await expect(contactsWith('ok').remove(ctx('super_admin'), 'c1'))
      .resolves.toEqual({ deleted: true });
  });

  it('super_admin olmayan rol → 404', async () => {
    const repo = { remove: vi.fn() };
    const svc = new ContactsService(repo as never);
    await expect(svc.remove(ctx('consultant'), 'c1')).rejects.toThrow(NotFoundException);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('kişi bulunamazsa → 404', async () => {
    await expect(contactsWith('not_found').remove(ctx('super_admin'), 'yok'))
      .rejects.toThrow(NotFoundException);
  });

  it('deal/finans/sözleşme bağı → 409 (iş verisi koruması)', async () => {
    await expect(contactsWith('has_business').remove(ctx('super_admin'), 'c1'))
      .rejects.toThrow(ConflictException);
  });
});
