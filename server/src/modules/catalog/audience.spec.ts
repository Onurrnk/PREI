import { describe, it, expect } from 'vitest';
import { toAudience } from './audience';
import type { AudienceRow } from './catalog.repository';

const row = (over: Partial<AudienceRow> = {}): AudienceRow => ({
  id: 'p1',
  contact_id: 'c1',
  contact_name: 'Duygu Karataş',
  lifecycle_stage: 'prospect',
  stage: 'presented',
  price: null,
  currency: 'EUR',
  presented_at: '2026-07-01T10:00:00Z',
  deal_id: null,
  ...over,
});

describe('toAudience', () => {
  it('kişileri aşama etiketiyle döner', () => {
    const out = toAudience([row({ stage: 'interested' })]);
    expect(out.total).toBe(1);
    expect(out.people[0].name).toBe('Duygu Karataş');
    expect(out.people[0].stageLabel).toBe('İlgilendi');
  });

  it('müşteri ile adayı ayırır', () => {
    const out = toAudience([
      row({ id: 'a', lifecycle_stage: 'customer' }),
      row({ id: 'b', lifecycle_stage: 'prospect' }),
    ]);
    expect(out.people.map((p) => p.isCustomer)).toEqual([true, false]);
  });

  it('satılan ve beğenilmeyen sayısını çıkarır', () => {
    const out = toAudience([
      row({ id: 'a', stage: 'sold' }),
      row({ id: 'b', stage: 'rejected' }),
      row({ id: 'c', stage: 'offer' }),
    ]);
    expect(out).toMatchObject({ total: 3, sold: 1, rejected: 1 });
  });

  it('fiyatı sayıya çevirir, yoksa null bırakır', () => {
    const out = toAudience([row({ price: '250000.00' }), row({ id: 'b' })]);
    expect(out.people[0].price).toBe(250000);
    expect(out.people[1].price).toBeNull();
  });

  // Ekranın çökmemesi bilinçli: bozuk aşama uydurulmaz, en başa düşürülür.
  it('tanınmayan aşamayı sunuldu sayar', () => {
    const out = toAudience([row({ stage: 'bilinmeyen' })]);
    expect(out.people[0].stage).toBe('presented');
    expect(out.people[0].stageLabel).toBe('Sunuldu');
  });

  it('adı boş kişiyi isimsiz gösterir', () => {
    expect(toAudience([row({ contact_name: null })]).people[0].name).toBe('İsimsiz kişi');
  });

  it('İngilizce etiket verir', () => {
    expect(toAudience([row({ stage: 'contract' })], 'en').people[0].stageLabel)
      .toBe('Contract stage');
  });

  it('boş listede sıfırlar', () => {
    expect(toAudience([])).toEqual({ total: 0, sold: 0, rejected: 0, people: [] });
  });
});
