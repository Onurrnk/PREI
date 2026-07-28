import { describe, it, expect } from 'vitest';
import { withProvenance, humanDate, monthsSince, STALE_AFTER_MONTHS } from './provenance';

const NOW = new Date('2026-07-28T00:00:00Z');

describe('humanDate', () => {
  it('ISO ayı Türkçeye çevirir', () => {
    expect(humanDate('2026-07-15')).toBe('Temmuz 2026');
    expect(humanDate('2025-11-04')).toBe('Kasım 2025');
  });

  it('çözülemeyen değeri olduğu gibi döner', () => {
    expect(humanDate('bilinmiyor')).toBe('bilinmiyor');
    expect(humanDate('2026-13-01')).toBe('2026-13-01');   // geçersiz ay
  });
});

describe('monthsSince', () => {
  it('ay farkını hesaplar', () => {
    expect(monthsSince('2026-07-01', NOW)).toBe(0);
    expect(monthsSince('2025-11-04', NOW)).toBe(8);
    expect(monthsSince('2026-06-01', NOW)).toBe(1);
  });

  it('geçersiz tarihte null', () => {
    expect(monthsSince('yok', NOW)).toBeNull();
  });
});

describe('withProvenance', () => {
  it('kaynak + tarih künyesi ekler', () => {
    const out = withProvenance('Dubai kira getirisi %7.', {
      source: 'ProDuality Bilgi Bankası',
      title: 'BAE Piyasa Zekâsı',
      last_verified: '2026-07-10',
    }, NOW);
    expect(out).toContain('Kaynak: ProDuality Bilgi Bankası — BAE Piyasa Zekâsı');
    expect(out).toContain('Doğrulama: Temmuz 2026');
    expect(out).toContain('Dubai kira getirisi %7.');
  });

  // Asıl amaç: eski veriyi model TAM GÜVENLE söylemesin.
  it('6 aydan eski doğrulamada uyarı basar', () => {
    const out = withProvenance('İstanbul m² fiyatı X.', {
      source: 'ProDuality Bilgi Bankası', last_verified: '2025-11-04',
    }, NOW);
    expect(out).toContain('⚠ 8 ay önce doğrulandı');
    expect(out).toContain('teyit et');
  });

  it('taze veride uyarı YOK', () => {
    const out = withProvenance('X', { last_verified: '2026-07-01' }, NOW);
    expect(out).not.toContain('⚠');
  });

  it('eşik sınırında uyarır', () => {
    const iso = '2026-01-01';   // NOW'a 6 ay
    expect(monthsSince(iso, NOW)).toBe(STALE_AFTER_MONTHS);
    expect(withProvenance('X', { last_verified: iso }, NOW)).toContain('⚠');
  });

  it('editöryel görüşü ayrı işaretler (kesin veri sanılmasın)', () => {
    const out = withProvenance('Bence Beşiktaş yükselir.', {
      confidence: 'editorial_opinion', last_verified: '2026-07-01',
    }, NOW);
    expect(out).toContain('editöryel görüş');
  });

  it('tazelik notunu taşır', () => {
    const out = withProvenance('Ücret politikası…', {
      freshness_note: 'Haziran 2026 itibarıyla günceldir.',
    }, NOW);
    expect(out).toContain('Haziran 2026 itibarıyla günceldir.');
  });

  // Dış kaynaklar ve eski kayıtlar bozulmamalı.
  it('metadata yoksa metni bozmaz', () => {
    expect(withProvenance('düz metin', null, NOW)).toBe('düz metin');
    expect(withProvenance('düz metin', {}, NOW)).toBe('düz metin');
  });

  it('yalnız başlık varsa Belge olarak yazar', () => {
    const out = withProvenance('X', { title: 'Knight Frank 2026' }, NOW);
    expect(out).toContain('Belge: Knight Frank 2026');
  });

  it('künye satırı metinden ÖNCE gelir', () => {
    const out = withProvenance('GÖVDE', { last_verified: '2026-07-01' }, NOW);
    expect(out.indexOf('[')).toBeLessThan(out.indexOf('GÖVDE'));
  });
});
