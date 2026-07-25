import { describe, it, expect } from 'vitest';
import {
  AMENITIES, AMENITY_GROUPS, normalizeAmenities, amenityLabels, amenityCatalog,
} from './amenities';

describe('AMENITIES kataloğu', () => {
  it('kodlar benzersiz', () => {
    const codes = AMENITIES.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('her olanak tanımlı bir gruba ait', () => {
    const groups = new Set(AMENITY_GROUPS.map((g) => g.key));
    expect(AMENITIES.every((a) => groups.has(a.group))).toBe(true);
  });

  it('Onur’un saydığı örnekler listede', () => {
    const trLabels = AMENITIES.map((a) => a.tr);
    for (const label of [
      'Kapalı havuz', 'Açık havuz', '7/24 güvenlik', 'Akıllı ev sistemi',
      'Ankastre seti', 'Yangın alarmı', 'Fiber altyapı',
    ]) {
      expect(trLabels).toContain(label);
    }
  });

  it('TR ve EN etiketler boş değil', () => {
    expect(AMENITIES.every((a) => a.tr.trim() && a.en.trim())).toBe(true);
  });
});

describe('normalizeAmenities', () => {
  it('kodları aynen kabul eder', () => {
    expect(normalizeAmenities(['indoor_pool', 'gym'])).toEqual(['indoor_pool', 'gym']);
  });

  it('virgüllü metni ayırır', () => {
    expect(normalizeAmenities('indoor_pool, gym ,fiber'))
      .toEqual(['indoor_pool', 'gym', 'fiber']);
  });

  it('Türkçe etiketi koda çevirir', () => {
    expect(normalizeAmenities(['Kapalı havuz', 'Yangın alarmı']))
      .toEqual(['indoor_pool', 'fire_alarm']);
  });

  // Türkçe küçük harf: 'I' → 'ı', 'İ' → 'i'. toLowerCase() bunu bozar.
  it('Türkçe büyük/küçük harf farkını yutar', () => {
    expect(normalizeAmenities(['KAPALI HAVUZ'])).toEqual(['indoor_pool']);
    expect(normalizeAmenities(['FİBER ALTYAPI'])).toEqual(['fiber']);
  });

  it('İngilizce etiketi de tanır', () => {
    expect(normalizeAmenities(['Indoor pool', 'Smart home system']))
      .toEqual(['indoor_pool', 'smart_home']);
  });

  it('tanınmayan girdiyi ATAR — çöp olanak listeye girmez', () => {
    expect(normalizeAmenities(['indoor_pool', 'uzay limanı', ''])).toEqual(['indoor_pool']);
  });

  it('tekrarları temizler, sırayı korur', () => {
    expect(normalizeAmenities(['gym', 'Spor salonu', 'fiber', 'gym']))
      .toEqual(['gym', 'fiber']);
  });

  it('boş/null girdide boş dizi', () => {
    expect(normalizeAmenities(null)).toEqual([]);
    expect(normalizeAmenities(undefined)).toEqual([]);
    expect(normalizeAmenities('')).toEqual([]);
    expect(normalizeAmenities([])).toEqual([]);
  });
});

describe('amenityLabels', () => {
  it('kodları Türkçe etikete çevirir', () => {
    expect(amenityLabels(['indoor_pool', 'fiber']))
      .toEqual(['Kapalı havuz', 'Fiber altyapı']);
  });

  it('İngilizce isteyince EN etiket', () => {
    expect(amenityLabels(['indoor_pool'], 'en')).toEqual(['Indoor pool']);
  });

  it('bilinmeyen kodu sessizce atar (etiket uydurmaz)', () => {
    expect(amenityLabels(['indoor_pool', 'yok'])).toEqual(['Kapalı havuz']);
  });
});

describe('amenityCatalog', () => {
  const cat = amenityCatalog();

  it('grup sayısı AMENITY_GROUPS ile aynı', () => {
    expect(cat).toHaveLength(AMENITY_GROUPS.length);
  });

  it('hiçbir grup boş değil', () => {
    expect(cat.every((g) => g.items.length > 0)).toBe(true);
  });

  it('tüm olanaklar bir gruba dağıtılmış (kayıp yok)', () => {
    const total = cat.reduce((s, g) => s + g.items.length, 0);
    expect(total).toBe(AMENITIES.length);
  });
});
