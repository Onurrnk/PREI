import { describe, it, expect } from 'vitest';
import { barWidth } from './DemandByCountry';

describe('barWidth', () => {
  it('en yüksek talep tam genişlik', () => {
    expect(barWidth(10, 10)).toBe('100%');
  });

  it('oransal hesaplar', () => {
    expect(barWidth(5, 10)).toBe('50%');
    expect(barWidth(3, 4)).toBe('75%');
  });

  // Tek kişilik talep 100 kişilik ülkenin yanında görünmez olmasın.
  it('çok küçük oranı bile görünür tutar (min %6)', () => {
    expect(barWidth(1, 100)).toBe('6%');
  });

  it('sıfır talep sıfır genişlik değil, alt sınıra oturur', () => {
    expect(barWidth(0, 10)).toBe('6%');
  });

  // max=0 yalnız liste boşken olur; 0'a bölme NaN üretmemeli.
  it('max sıfırsa sıfır döner (NaN yok)', () => {
    expect(barWidth(0, 0)).toBe('0%');
    expect(barWidth(5, 0)).toBe('0%');
  });

  it('negatif max güvenli', () => {
    expect(barWidth(5, -1)).toBe('0%');
  });
});
