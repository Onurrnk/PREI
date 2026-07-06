import { describe, it, expect } from 'vitest';
import { can, ROLE_PERMISSIONS } from './permissions';

// Backend RBAC = asıl yetki kaynağı (Blueprint §7.1). Master Plan §4 rol matrisi.
describe('backend can()', () => {
  it('super_admin gizli komisyon dahil her şeyi görür', () => {
    expect(can('super_admin', 'admin')).toBe(true);
    expect(can('super_admin', 'financials_confidential')).toBe(true);
  });

  it('finance_manager gizli komisyonu görür, admin göremez', () => {
    expect(can('finance_manager', 'financials_confidential')).toBe(true);
    expect(can('finance_manager', 'admin')).toBe(false);
  });

  it('manager gizli komisyonu ve admin konsolunu göremez (K-4)', () => {
    expect(can('manager', 'financials_confidential')).toBe(false);
    expect(can('manager', 'admin')).toBe(false);
    expect(can('manager', 'financials')).toBe(true);
  });

  it('consultant finans/komisyon/admin/marketing göremez', () => {
    expect(can('consultant', 'financials')).toBe(false);
    expect(can('consultant', 'financials_confidential')).toBe(false);
    expect(can('consultant', 'admin')).toBe(false);
    expect(can('consultant', 'marketing')).toBe(false);
    expect(can('consultant', 'leads')).toBe(true);
  });

  it('service_agent (Eylül) yalnız lead/client yazabilir — komisyon/admin YOK', () => {
    expect(can('service_agent', 'leads')).toBe(true);
    expect(can('service_agent', 'clients')).toBe(true);
    expect(can('service_agent', 'financials_confidential')).toBe(false);
    expect(can('service_agent', 'admin')).toBe(false);
    expect(can('service_agent', 'financials')).toBe(false);
  });

  it('rol yoksa her şey kapalı (deny-by-default)', () => {
    expect(can(null, 'leads')).toBe(false);
    expect(can(undefined, 'dashboard')).toBe(false);
  });

  it('hiçbir rolde izin listesinde duplike yok', () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(new Set(perms).size).toBe(perms.length);
    }
  });
});
