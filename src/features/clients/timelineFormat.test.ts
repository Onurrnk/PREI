import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime } from './timelineFormat';

const NOW = new Date('2026-07-15T12:00:00Z');

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bir dakikadan az → "just now" / "az önce"', () => {
    const iso = new Date(NOW.getTime() - 10_000).toISOString();
    expect(formatRelativeTime(iso, 'en-GB')).toBe('just now');
    expect(formatRelativeTime(iso, 'tr-TR')).toBe('az önce');
  });

  it('dakika aralığı → "Nm" / "Ndk"', () => {
    const iso = new Date(NOW.getTime() - 15 * 60_000).toISOString();
    expect(formatRelativeTime(iso, 'en-GB')).toBe('15m');
    expect(formatRelativeTime(iso, 'tr-TR')).toBe('15dk');
  });

  it('saat aralığı → "Nh" / "Nsa"', () => {
    const iso = new Date(NOW.getTime() - 5 * 3_600_000).toISOString();
    expect(formatRelativeTime(iso, 'en-GB')).toBe('5h');
    expect(formatRelativeTime(iso, 'tr-TR')).toBe('5sa');
  });

  it('gün aralığı (< 30 gün) → "Nd" / "Ng"', () => {
    const iso = new Date(NOW.getTime() - 6 * 86_400_000).toISOString();
    expect(formatRelativeTime(iso, 'en-GB')).toBe('6d');
    expect(formatRelativeTime(iso, 'tr-TR')).toBe('6g');
  });

  it('30 günden eski → takvim tarihine düşer', () => {
    const iso = new Date(NOW.getTime() - 45 * 86_400_000).toISOString();
    expect(formatRelativeTime(iso, 'en-GB')).not.toMatch(/^\d+[dhm]$/);
    expect(formatRelativeTime(iso, 'en-GB')).toMatch(/\d{2}/); // gün/ay içerir
  });
});
