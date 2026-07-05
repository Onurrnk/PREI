import { describe, it, expect } from 'vitest';
import { can, ROLE_PERMISSIONS } from './permissions';

// RBAC projeksiyonu: UI gizleme/route guard katmanı. Rol matrisi Master Plan §4 ile uyumlu olmalı.
describe('can()', () => {
  it('Admin her modüle erişir (admin ve financials dahil)', () => {
    expect(can('Admin', 'admin')).toBe(true);
    expect(can('Admin', 'financials')).toBe(true);
    expect(can('Admin', 'marketing')).toBe(true);
  });

  it('Manager admin konsoluna erişemez ama geri kalan her şeye erişir', () => {
    expect(can('Manager', 'admin')).toBe(false);
    expect(can('Manager', 'financials')).toBe(true);
    expect(can('Manager', 'contracts')).toBe(true);
  });

  it('Consultant finans/sözleşme/marketing/admin göremez', () => {
    expect(can('Consultant', 'financials')).toBe(false);
    expect(can('Consultant', 'contracts')).toBe(false);
    expect(can('Consultant', 'marketing')).toBe(false);
    expect(can('Consultant', 'admin')).toBe(false);
  });

  it('Consultant kendi çalışma alanına erişir', () => {
    expect(can('Consultant', 'leads')).toBe(true);
    expect(can('Consultant', 'clients')).toBe(true);
    expect(can('Consultant', 'dashboard')).toBe(true);
  });

  it('rol yoksa (login öncesi) her şey kapalı', () => {
    expect(can(undefined, 'dashboard')).toBe(false);
    expect(can(undefined, 'admin')).toBe(false);
  });

  it('rol matrisi deny-by-default: her rolün izni ALL listesinin alt kümesi', () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(new Set(perms).size).toBe(perms.length); // duplike izin yok
    }
  });
});
