import { describe, it, expect } from 'vitest';
import {
  groupContractsByCompany, UNASSIGNED_COMPANY, UNASSIGNED_LABEL,
} from './contract-grouping';
import type { ContractDTO } from '../../core/types';

const c = (over: Partial<ContractDTO> = {}): ContractDTO => ({
  id: 'c1', developer: 'Revak Yapı', project: 'Mercury', status: 'Active',
  contractType: 'sale', startDate: null, expiryDate: null, commission: '%10',
  legalEntity: '', paymentTerms: '', amount: null, currency: 'EUR',
  propertyId: null, contactId: null, organizationId: 'org-1', documents: [],
  ...over,
});

describe('groupContractsByCompany', () => {
  it('boş liste boş grup', () => {
    expect(groupContractsByCompany([])).toEqual([]);
  });

  it('aynı firmanın sözleşmelerini tek grupta toplar', () => {
    const g = groupContractsByCompany([c({ id: '1' }), c({ id: '2' })]);
    expect(g).toHaveLength(1);
    expect(g[0].name).toBe('Revak Yapı');
    expect(g[0].contracts).toHaveLength(2);
  });

  it('farklı firmaları ayırır', () => {
    const g = groupContractsByCompany([
      c({ id: '1', organizationId: 'a', developer: 'Akkoç' }),
      c({ id: '2', organizationId: 'b', developer: 'Zümrüt' }),
    ]);
    expect(g).toHaveLength(2);
  });

  // Aynı firmanın iki kaydı farklı id taşıyorsa isim aynı olsa da ayrı kalır;
  // asıl mesele id yokken isimle birleşebilmeleri.
  it('organizationId yoksa firma adıyla birleştirir', () => {
    const g = groupContractsByCompany([
      c({ id: '1', organizationId: null, developer: 'Revak Yapı' }),
      c({ id: '2', organizationId: null, developer: 'Revak Yapı' }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].contracts).toHaveLength(2);
  });

  it('firması hiç olmayanı ayrı kovaya koyar — kayıt gizlenmez', () => {
    const g = groupContractsByCompany([c({ organizationId: null, developer: '' })]);
    expect(g[0].key).toBe(UNASSIGNED_COMPANY);
    expect(g[0].name).toBe(UNASSIGNED_LABEL);
    expect(g[0].contracts).toHaveLength(1);
  });

  it('firmalar Türkçe alfabetik, atanmamış EN SONDA', () => {
    const g = groupContractsByCompany([
      c({ id: '1', organizationId: null, developer: '' }),
      c({ id: '2', organizationId: 'z', developer: 'Zümrüt' }),
      c({ id: '3', organizationId: 'c', developer: 'Çınar' }),
      c({ id: '4', organizationId: 'a', developer: 'Akkoç' }),
    ]);
    expect(g.map((x) => x.name)).toEqual(['Akkoç', 'Çınar', 'Zümrüt', UNASSIGNED_LABEL]);
  });

  it('süresi dolan/dolacak sayısını grup başına sayar', () => {
    const g = groupContractsByCompany([
      c({ id: '1', status: 'Active' }),
      c({ id: '2', status: 'Expiring' }),
      c({ id: '3', status: 'Expired' }),
    ]);
    expect(g[0].expiringCount).toBe(2);
  });

  it('uyarı yoksa sayaç sıfır', () => {
    expect(groupContractsByCompany([c()])[0].expiringCount).toBe(0);
  });

  it('firma adındaki boşlukları kırpar (ayrı grup oluşmasın)', () => {
    const g = groupContractsByCompany([
      c({ id: '1', organizationId: null, developer: 'Revak Yapı' }),
      c({ id: '2', organizationId: null, developer: '  Revak Yapı  ' }),
    ]);
    expect(g).toHaveLength(1);
  });
});
