import { describe, it, expect } from 'vitest';
import { countryFromPhone } from './phone-country';

describe('countryFromPhone', () => {
  it('Türk numarasını çözer', () => {
    expect(countryFromPhone('+90 532 123 45 67')?.countryCode).toBe('TR');
    expect(countryFromPhone('+90 532 123 45 67')?.countryName).toBe('Türkiye');
  });

  it('BAE, İngiltere, İspanya', () => {
    expect(countryFromPhone('+971 50 123 4567')?.countryCode).toBe('AE');
    expect(countryFromPhone('+44 7700 900123')?.countryCode).toBe('GB');
    expect(countryFromPhone('+34 600 123 456')?.countryCode).toBe('ES');
  });

  it('00 uluslararası önekini + sayar', () => {
    expect(countryFromPhone('0090 532 123 45 67')?.countryCode).toBe('TR');
  });

  it('boşluk, tire, parantez temizlenir', () => {
    expect(countryFromPhone('+90 (532) 123-45-67')?.countryCode).toBe('TR');
    expect(countryFromPhone('+971-50-123-4567')?.countryCode).toBe('AE');
  });

  // +1 (ABD) ile +90/+971 gibi kodların çakışmaması için uzun kod önce denenir.
  it('uzun ülke kodu kısa olandan önce eşleşir', () => {
    expect(countryFromPhone('+971501234567')?.countryCode).toBe('AE');   // 9 değil 971
    expect(countryFromPhone('+995555123456')?.countryCode).toBe('GE');   // 9 değil 995
    expect(countryFromPhone('+12125551234')?.countryCode).toBe('US');
  });

  it('normalize edilmiş numarayı döner', () => {
    expect(countryFromPhone('0090 532 123 45 67')?.normalized).toBe('+905321234567');
  });

  // Ülke kodu olmayan yerel numaradan ülke UYDURULMAZ.
  it('yerel format (0532…) çözülmez', () => {
    expect(countryFromPhone('0532 123 45 67')).toBeNull();
    expect(countryFromPhone('532 123 45 67')).toBeNull();
  });

  it('boş / kısa / anlamsız girdi null', () => {
    for (const bad of ['', '   ', null, undefined, '+90', '+1234', 'abc']) {
      expect(countryFromPhone(bad as never)).toBeNull();
    }
  });

  it('tanınmayan ülke kodu null döner (yanlış ülke atamaz)', () => {
    expect(countryFromPhone('+678 123456789')).toBeNull();
  });

  it('geo.ts dışındaki ülkeler için de ad üretir', () => {
    expect(countryFromPhone('+7 912 345 6789')?.countryName).toBe('Rusya');
    expect(countryFromPhone('+965 5012 3456')?.countryName).toBe('Kuveyt');
  });
});
