import { describe, it, expect } from 'vitest';
import { parseDurationMinutes } from './google-calendar.service';

describe('parseDurationMinutes', () => {
  it('saat + dakika kombinasyonlarını çözer', () => {
    expect(parseDurationMinutes('1h')).toBe(60);
    expect(parseDurationMinutes('30m')).toBe(30);
    expect(parseDurationMinutes('1h 30m')).toBe(90);
    expect(parseDurationMinutes('2h')).toBe(120);
  });

  it('salt sayıyı dakika kabul eder', () => {
    expect(parseDurationMinutes('45')).toBe(45);
    expect(parseDurationMinutes('90')).toBe(90);
  });

  it('boş/çözülemez → varsayılan 60', () => {
    expect(parseDurationMinutes('')).toBe(60);
    expect(parseDurationMinutes(undefined)).toBe(60);
    expect(parseDurationMinutes(null)).toBe(60);
    expect(parseDurationMinutes('abc')).toBe(60);
  });
});
