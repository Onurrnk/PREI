import { describe, it, expect } from 'vitest';
import {
  PRESENTED_STAGES, isPresentedStage, stageLabel, stageOrder, isSold, isLost,
  normalizePresented, summarize, type PresentedStage,
} from './presented.model';

describe('aşamalar', () => {
  it('7 aşama tanımlı', () => {
    expect(PRESENTED_STAGES).toHaveLength(7);
  });

  it('etiketler iki dilde', () => {
    expect(stageLabel('sold')).toBe('Satış tamamlandı');
    expect(stageLabel('contract', 'en')).toBe('Contract stage');
  });

  it('huni sırası: sunuldu < teklif < sözleşme < satıldı', () => {
    expect(stageOrder('presented')).toBeLessThan(stageOrder('offer'));
    expect(stageOrder('offer')).toBeLessThan(stageOrder('contract'));
    expect(stageOrder('contract')).toBeLessThan(stageOrder('sold'));
  });

  // Beğenilmeyen kayıt huniden çıkar — sıralamada en altta.
  it('reddedilen huni dışıdır (sıra 0)', () => {
    expect(stageOrder('rejected')).toBe(0);
    expect(isLost('rejected')).toBe(true);
    expect(isSold('sold')).toBe(true);
  });

  it('bilinmeyen aşama reddedilir', () => {
    expect(isPresentedStage('satildi')).toBe(false);
    expect(isPresentedStage('sold')).toBe(true);
  });
});

describe('normalizePresented', () => {
  it('iç proje ile geçerli', () => {
    const r = normalizePresented({ propertyId: 'p1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.propertyId).toBe('p1');
      expect(r.value.stage).toBe('presented');   // varsayılan
      expect(r.value.currency).toBe('EUR');
    }
  });

  it('dış ilan ile geçerli (projesiz)', () => {
    const r = normalizePresented({
      externalTitle: 'Bodrum Yalıkavak Villa',
      externalListingNo: '1123456789',
      externalUrl: 'https://www.sahibinden.com/ilan/1123456789',
      externalSource: 'sahibinden',
      features: '4+1, 320 m², havuzlu',
      price: 950000, currency: 'usd',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.externalListingNo).toBe('1123456789');
      expect(r.value.currency).toBe('USD');       // büyük harfe çevrildi
      expect(r.value.price).toBe(950000);
    }
  });

  // Boş kayıt anlamsız: ne sunulduğu bilinmiyorsa "ne sunduk" sorusuna
  // cevap vermez.
  it('ne proje ne başlık varsa reddeder', () => {
    const r = normalizePresented({ notes: 'bir şeyler gösterdik' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/proje seçin|başlık/i);
  });

  it('şemasız link reddedilir (tıklanabilir olmaz)', () => {
    const r = normalizePresented({ externalTitle: 'X', externalUrl: 'www.sahibinden.com/ilan/1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/http/i);
  });

  it('geçerli link kabul edilir', () => {
    const r = normalizePresented({ externalTitle: 'X', externalUrl: 'http://ornek.com/a' });
    expect(r.ok).toBe(true);
  });

  it('negatif fiyat reddedilir', () => {
    const r = normalizePresented({ propertyId: 'p1', price: -5 });
    expect(r.ok).toBe(false);
  });

  it('geçersiz aşama reddedilir', () => {
    const r = normalizePresented({ propertyId: 'p1', stage: 'kapandi' });
    expect(r.ok).toBe(false);
  });

  it('boş metinler null olur (boş string kaydedilmez)', () => {
    const r = normalizePresented({ propertyId: 'p1', notes: '   ', location: '' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.notes).toBeNull();
      expect(r.value.location).toBeNull();
    }
  });

  it('fiyat verilmezse null (0 ile karışmaz)', () => {
    const r = normalizePresented({ propertyId: 'p1' });
    expect(r.ok && r.value.price).toBeNull();
  });
});

describe('summarize', () => {
  it('aktif / elenen / satılan ayrımı', () => {
    const stages: PresentedStage[] = [
      'presented', 'interested', 'rejected', 'offer', 'sold', 'rejected',
    ];
    expect(summarize(stages)).toEqual({ total: 6, active: 3, rejected: 2, sold: 1 });
  });

  it('boş liste sıfırlar', () => {
    expect(summarize([])).toEqual({ total: 0, active: 0, rejected: 0, sold: 0 });
  });
});
