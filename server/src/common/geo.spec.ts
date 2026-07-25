import { describe, it, expect } from 'vitest';
import {
  foldTr, COUNTRIES, countryByCode, normalizeCountry, normalizeTarget,
  countryCityConflict,
} from './geo';

describe('foldTr', () => {
  // JS'in /i bayrağı İ'yi i'ye KATLAMAZ — bütün eşleşmelerin temeli bu.
  it('büyük İ ve ı harfini i yapar', () => {
    expect(foldTr('İSPANYA')).toBe('ispanya');
    expect(foldTr('Iğdır')).toBe('igdir');
  });

  it('ayrışmış İ (i + U+0307) ile birleşik İ aynı sonucu verir', () => {
    expect(foldTr('İspanya')).toBe(foldTr('İspanya'));
  });

  it('ş ğ ü ö ç harflerini katlar', () => {
    expect(foldTr('Şişli Göztepe Çankaya')).toBe('sisli goztepe cankaya');
  });
});

describe('COUNTRIES', () => {
  it('kodlar benzersiz ve iki harfli', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
  });

  it('hizmet pazarları listede', () => {
    for (const code of ['TR', 'AE', 'ES', 'GB']) {
      expect(COUNTRIES.some((c) => c.code === code)).toBe(true);
    }
  });
});

describe('countryByCode', () => {
  it('kodu kayda çevirir, küçük harfi kabul eder', () => {
    expect(countryByCode('tr')?.tr).toBe('Türkiye');
    expect(countryByCode('AE')?.tr).toBe('Birleşik Arap Emirlikleri');
  });

  it('bilinmeyen kod ve boş girdi null', () => {
    expect(countryByCode('ZZ')).toBeNull();
    expect(countryByCode(null)).toBeNull();
    expect(countryByCode('')).toBeNull();
  });
});

describe('normalizeCountry', () => {
  it('Türkçe ülke adını çözer', () => {
    expect(normalizeCountry('İspanya')?.code).toBe('ES');
    expect(normalizeCountry('Türkiye')?.code).toBe('TR');
    expect(normalizeCountry('İngiltere')?.code).toBe('GB');
  });

  it('İngilizce adı çözer', () => {
    expect(normalizeCountry('Spain')?.code).toBe('ES');
    expect(normalizeCountry('United Kingdom')?.code).toBe('GB');
  });

  it('BAE/UAE kısaltmalarını aynı ülkeye bağlar', () => {
    expect(normalizeCountry('BAE')?.code).toBe('AE');
    expect(normalizeCountry('uae')?.code).toBe('AE');
    expect(normalizeCountry('Birleşik Arap Emirlikleri')?.code).toBe('AE');
  });

  it('ISO kodunu doğrudan kabul eder', () => {
    expect(normalizeCountry('TR')?.code).toBe('TR');
    expect(normalizeCountry('es')?.code).toBe('ES');
  });

  // Eylül'ün "market" alanına şehir yazdığı gerçek kayıtlar var.
  it('şehir verilse ülkesini çıkarır', () => {
    expect(normalizeCountry('Dubai')?.code).toBe('AE');
    expect(normalizeCountry('Londra')?.code).toBe('GB');
    expect(normalizeCountry('İstanbul')?.code).toBe('TR');
    expect(normalizeCountry('Barcelona')?.code).toBe('ES');
  });

  it('boşluk ve büyük/küçük harf farkını yutar', () => {
    expect(normalizeCountry('  dUbAi  ')?.code).toBe('AE');
    expect(normalizeCountry('dubai   marina')?.code).toBe('AE');
  });

  it('çözemediğinde TAHMİN ETMEZ, null döner', () => {
    expect(normalizeCountry('Ay')).toBeNull();
    expect(normalizeCountry('bilinmeyen yer')).toBeNull();
    expect(normalizeCountry('')).toBeNull();
    expect(normalizeCountry(null)).toBeNull();
    expect(normalizeCountry(undefined)).toBeNull();
  });
});

describe('normalizeTarget', () => {
  it('pazar + şehir ikilisini birleştirir', () => {
    expect(normalizeTarget('Türkiye', 'İstanbul')).toEqual({
      countryCode: 'TR', countryName: 'Türkiye', region: 'İstanbul',
    });
  });

  it('pazar çözülemezse ülkeyi şehirden çıkarır', () => {
    expect(normalizeTarget(null, 'Londra')).toEqual({
      countryCode: 'GB', countryName: 'İngiltere', region: 'Londra',
    });
  });

  it('pazar alanına şehir yazılmışsa onu bölge yapar', () => {
    expect(normalizeTarget('Dubai')).toEqual({
      countryCode: 'AE', countryName: 'Birleşik Arap Emirlikleri', region: 'Dubai',
    });
  });

  it('ülke adı verilmişse bölge uydurmaz', () => {
    expect(normalizeTarget('İspanya')).toEqual({
      countryCode: 'ES', countryName: 'İspanya', region: null,
    });
  });

  it('şehir pazardan önceliklidir (ikisi de doluysa şehir bölge olur)', () => {
    const r = normalizeTarget('Dubai', 'Abu Dabi');
    expect(r?.countryCode).toBe('AE');
    expect(r?.region).toBe('Abu Dabi');
  });

  it('hiçbiri çözülemezse null — boş kayıt üretmez', () => {
    expect(normalizeTarget(null, null)).toBeNull();
    expect(normalizeTarget('', '')).toBeNull();
    expect(normalizeTarget('Mars', 'Olympus')).toBeNull();
  });
});

describe('countryCityConflict', () => {
  // Canlı veride "market: Almanya, city: Barcelona" kaydı var — Eylül
  // yanlış çıkarmış. Sessizce kaydetmek yerine işaretlenmeli.
  it('şehir başka ülkeye aitse uyarı verir', () => {
    const msg = countryCityConflict('DE', 'Barcelona');
    expect(msg).toContain('Barcelona');
    expect(msg).toContain('İspanya');
    expect(msg).toContain('Almanya');
  });

  it('şehir ülkeyle uyumluysa uyarı yok', () => {
    expect(countryCityConflict('TR', 'İstanbul')).toBeNull();
    expect(countryCityConflict('AE', 'Dubai')).toBeNull();
  });

  it('tanınmayan şehir için suçlama yapmaz', () => {
    expect(countryCityConflict('TR', 'Küçükköy')).toBeNull();
  });

  it('şehir boşsa uyarı yok', () => {
    expect(countryCityConflict('TR', null)).toBeNull();
    expect(countryCityConflict('TR', '   ')).toBeNull();
  });
});
