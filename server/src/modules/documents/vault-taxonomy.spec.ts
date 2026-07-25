import { describe, it, expect } from 'vitest';
import {
  CATEGORIES, CATEGORY_CODES, GENERAL_BUCKET, GENERAL_LABEL,
  UNASSIGNED_BUCKET, UNASSIGNED_LABEL,
  normalizeCategory, categoryLabel, buildVaultTree, type VaultDocLike,
} from './vault-taxonomy';

const doc = (over: Partial<VaultDocLike> = {}): VaultDocLike => ({
  id: 'd1', name: 'dosya.pdf', folder: 'contract',
  organizationId: 'org-1', organizationName: 'Revak Yapı',
  projectId: 'prj-1', projectName: 'Mercury Çengelköy',
  sizeMB: 1, ...over,
});

describe('normalizeCategory', () => {
  it('kanonik kodu aynen döndürür', () => {
    for (const c of CATEGORIES) expect(normalizeCategory(c.code)).toBe(c.code);
  });

  it('büyük/küçük harf ve boşluğa dayanıklı', () => {
    expect(normalizeCategory('  CONTRACT ')).toBe('contract');
  });

  // 003e öncesi istemciler ve intake hâlâ eski klasör adlarını gönderebilir.
  it('eski klasör adlarını çevirir', () => {
    expect(normalizeCategory('Contracts')).toBe('contract');
    expect(normalizeCategory('Client KYC')).toBe('kyc');
    expect(normalizeCategory('Marketing')).toBe('marketing');
    expect(normalizeCategory('Developer Agreements')).toBe('contract');
    expect(normalizeCategory('Root')).toBe('other');
  });

  it('tanınmayan değeri "other" yapar — evrak kaybolmaz, hata fırlatmaz', () => {
    expect(normalizeCategory('zzz')).toBe('other');
    expect(normalizeCategory('')).toBe('other');
    expect(normalizeCategory(null)).toBe('other');
    expect(normalizeCategory(undefined)).toBe('other');
  });
});

describe('categoryLabel', () => {
  it('Türkçe etiket verir', () => {
    expect(categoryLabel('contract')).toBe('Sözleşme');
    expect(categoryLabel('kyc')).toBe('KYC & Kimlik');
  });

  it('bilinmeyen kod için Diğer', () => {
    expect(categoryLabel('yok')).toBe('Diğer');
  });
});

describe('buildVaultTree', () => {
  it('boş girdi boş ağaç', () => {
    expect(buildVaultTree([])).toEqual([]);
  });

  it('firma → proje → kategori olarak dallanır', () => {
    const tree = buildVaultTree([doc()]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Revak Yapı');
    expect(tree[0].projects[0].name).toBe('Mercury Çengelköy');
    expect(tree[0].projects[0].categories[0]).toEqual({
      code: 'contract', label: 'Sözleşme', count: 1,
    });
  });

  it('sayıları ve boyutu her seviyede toplar', () => {
    const tree = buildVaultTree([
      doc({ id: 'a', sizeMB: 1.5 }),
      doc({ id: 'b', sizeMB: 2.25, folder: 'permit' }),
      doc({ id: 'c', sizeMB: 1, projectId: 'prj-2', projectName: 'İkinci Proje' }),
    ]);
    expect(tree[0].count).toBe(3);
    expect(tree[0].sizeMB).toBe(4.75);
    const mercury = tree[0].projects.find((p) => p.id === 'prj-1')!;
    expect(mercury.count).toBe(2);
    expect(mercury.sizeMB).toBe(3.75);
    expect(mercury.categories.map((c) => c.code)).toEqual(['contract', 'permit']);
  });

  // Kayan nokta toplamı 0.1+0.2 gibi kuyruk üretir; kullanıcıya 3.0000000004 MB gösterilmez.
  it('boyutu iki basamağa yuvarlar', () => {
    const tree = buildVaultTree([doc({ id: 'a', sizeMB: 0.1 }), doc({ id: 'b', sizeMB: 0.2 })]);
    expect(tree[0].sizeMB).toBe(0.3);
    expect(tree[0].projects[0].sizeMB).toBe(0.3);
  });

  it('projesiz evrak Genel kovasına gider', () => {
    const tree = buildVaultTree([doc({ projectId: null, projectName: null })]);
    expect(tree[0].projects[0].id).toBe(GENERAL_BUCKET);
    expect(tree[0].projects[0].name).toBe(GENERAL_LABEL);
  });

  it('firmasız evrak "Firma atanmamış" altında toplanır', () => {
    const tree = buildVaultTree([doc({ organizationId: null, organizationName: null })]);
    expect(tree[0].id).toBe(UNASSIGNED_BUCKET);
    expect(tree[0].name).toBe(UNASSIGNED_LABEL);
  });

  it('firmalar Türkçe alfabetik, atanmamış EN SONDA', () => {
    const tree = buildVaultTree([
      doc({ id: '1', organizationId: null, organizationName: null }),
      doc({ id: '2', organizationId: 'z', organizationName: 'Zümrüt İnşaat' }),
      doc({ id: '3', organizationId: 'c', organizationName: 'Çınar Yapı' }),
      doc({ id: '4', organizationId: 'a', organizationName: 'Akkoç' }),
    ]);
    expect(tree.map((c) => c.name)).toEqual([
      'Akkoç', 'Çınar Yapı', 'Zümrüt İnşaat', UNASSIGNED_LABEL,
    ]);
  });

  it('projeler alfabetik, Genel EN SONDA', () => {
    const tree = buildVaultTree([
      doc({ id: '1', projectId: null, projectName: null }),
      doc({ id: '2', projectId: 'z', projectName: 'Zeytinburnu' }),
      doc({ id: '3', projectId: 'i', projectName: 'İstinye Park' }),
    ]);
    expect(tree[0].projects.map((p) => p.name)).toEqual([
      'İstinye Park', 'Zeytinburnu', GENERAL_LABEL,
    ]);
  });

  // Kategoriler sayıya göre sıralansa firma değiştikçe düzen bozulurdu.
  it('kategoriler TANIMLI sırada — dosya sayısına göre yer değiştirmez', () => {
    const tree = buildVaultTree([
      doc({ id: '1', folder: 'other' }),
      doc({ id: '2', folder: 'other' }),
      doc({ id: '3', folder: 'other' }),
      doc({ id: '4', folder: 'contract' }),
    ]);
    expect(tree[0].projects[0].categories.map((c) => c.code)).toEqual(['contract', 'other']);
    expect(CATEGORY_CODES.indexOf('contract')).toBeLessThan(CATEGORY_CODES.indexOf('other'));
  });

  it('eski klasör adları ağaçta da normalize edilir', () => {
    const tree = buildVaultTree([doc({ folder: 'Client KYC' })]);
    expect(tree[0].projects[0].categories[0].code).toBe('kyc');
  });

  it('adı boş gelen firma/proje isimsiz kalmaz', () => {
    const tree = buildVaultTree([
      doc({ organizationName: null, projectName: null }),
    ]);
    expect(tree[0].name).toBe('Adsız firma');
    expect(tree[0].projects[0].name).toBe('Adsız proje');
  });

  it('aynı firmanın iki projesi ayrı düğüm olur (karışmaz)', () => {
    const tree = buildVaultTree([
      doc({ id: '1', projectId: 'p1', projectName: 'A Projesi' }),
      doc({ id: '2', projectId: 'p2', projectName: 'B Projesi' }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].projects).toHaveLength(2);
    expect(tree[0].projects.every((p) => p.count === 1)).toBe(true);
  });
});
