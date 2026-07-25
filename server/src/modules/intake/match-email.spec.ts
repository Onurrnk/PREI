import { describe, it, expect } from 'vitest';
import {
  esc, projectCard, buildMatchEmailHtml, buildMatchEmailText, type MatchProject,
} from './match-email';

const project = (over: Partial<MatchProject> = {}): MatchProject => ({
  title: 'Mercury Çengelköy',
  city: 'İstanbul',
  marketName: 'Türkiye',
  priceLine: '12.500.000 – 18.000.000 TRY',
  imageUrl: 'https://supabase.produality.com/storage/v1/object/public/media/a.png',
  mapUrl: 'https://maps.google.com/?q=41,29',
  amenities: ['Kapalı havuz', 'Fiber altyapı'],
  unitTypes: ['2+1', '3+1'],
  ...over,
});

const input = (over: Partial<Parameters<typeof buildMatchEmailHtml>[0]> = {}) => ({
  projects: [project()],
  en: false,
  logoUrl: 'https://produality.com/logo.png',
  unsubscribeUrl: 'https://api.produality.com/unsub?t=x',
  ...over,
});

describe('esc', () => {
  it('HTML enjeksiyonunu kapatır', () => {
    expect(esc('<script>"x"&y')).toBe('&lt;script&gt;&quot;x&quot;&amp;y');
  });

  it('null/undefined’da çökmez', () => {
    expect(esc(null as never)).toBe('');
  });
});

describe('projectCard', () => {
  it('kapak görselini basar', () => {
    const html = projectCard(project(), false);
    expect(html).toContain('object/public/media/a.png');
    expect(html).toContain('<img');
  });

  // Kırık resim ikonu, hiç görsel olmamasından kötü görünür.
  it('görsel yoksa img etiketi HİÇ üretmez', () => {
    const html = projectCard(project({ imageUrl: null }), false);
    expect(html).not.toContain('<img');
    expect(html).toContain('Mercury Çengelköy');
  });

  it('konum, fiyat ve daire tiplerini gösterir', () => {
    const html = projectCard(project(), false);
    expect(html).toContain('İstanbul, Türkiye');
    expect(html).toContain('12.500.000 – 18.000.000 TRY');
    expect(html).toContain('2+1, 3+1');
  });

  it('boş alanlar için satır üretmez (— göstermez)', () => {
    const html = projectCard(
      project({ city: null, marketName: null, priceLine: null, unitTypes: [] }), false);
    expect(html).not.toContain('Konum');
    expect(html).not.toContain('Fiyat');
    expect(html).not.toContain('Daire tipleri');
  });

  it('olanakları rozet olarak basar', () => {
    const html = projectCard(project(), false);
    expect(html).toContain('Kapalı havuz');
    expect(html).toContain('Fiber altyapı');
  });

  it('6’dan fazla olanağı "+N" ile özetler', () => {
    const html = projectCard(
      project({ amenities: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }), false);
    expect(html).toContain('+2');
  });

  it('harita düğmesi bağlantıyı taşır', () => {
    expect(projectCard(project(), false)).toContain('maps.google.com');
    expect(projectCard(project({ mapUrl: null }), false)).not.toContain('Haritada gör');
  });

  it('İngilizce etiketler', () => {
    const html = projectCard(project(), true);
    expect(html).toContain('Location');
    expect(html).toContain('View on map');
  });

  it('başlıktaki HTML kaçırılır', () => {
    const html = projectCard(project({ title: '<b>X</b>' }), false);
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
  });

  // E-posta istemcileri flexbox/grid desteklemez.
  it('tablo düzeni ve satır-içi stil kullanır', () => {
    const html = projectCard(project(), false);
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('display:grid');
  });
});

describe('buildMatchEmailHtml', () => {
  it('logoyu başa koyar', () => {
    expect(buildMatchEmailHtml(input())).toContain('produality.com/logo.png');
  });

  it('her proje için ayrı kart üretir', () => {
    const html = buildMatchEmailHtml(input({
      projects: [project({ title: 'A' }), project({ title: 'B' })],
    }));
    // Kart sayısı: her proje kendi tablosunda
    expect(html.match(/role="presentation"/g)!.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('A</td>');
    expect(html).toContain('B</td>');
  });

  it('tekil/çoğul dili doğru kurar', () => {
    expect(buildMatchEmailHtml(input())).toContain('yeni eklenen proje:');
    const many = buildMatchEmailHtml(input({ projects: [project(), project()] }));
    expect(many).toContain('projeler');
  });

  // Kabuk zaten "Merhaba {ad}," ekliyor; gövde de eklerse çift selam olur.
  it('selamlama İÇERMEZ (kabuk ekliyor)', () => {
    const html = buildMatchEmailHtml(input());
    expect(html).not.toMatch(/Merhaba|Sayın|Dear |Hello/);
  });

  it('KVKK abonelikten çıkma bağlantısını taşır', () => {
    expect(buildMatchEmailHtml(input())).toContain('unsub?t=x');
    expect(buildMatchEmailHtml(input())).toContain('Abonelikten çık');
  });

  it('İngilizce sürümde EN metinler', () => {
    const html = buildMatchEmailHtml(input({ en: true }));
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('matching your investment criteria');
  });
});

describe('buildMatchEmailText', () => {
  it('projeleri düz metinde listeler', () => {
    const txt = buildMatchEmailText(input());
    expect(txt).toContain('Mercury Çengelköy');
    expect(txt).toContain('İstanbul, Türkiye');
  });

  it('HTML etiketi içermez', () => {
    expect(buildMatchEmailText(input())).not.toContain('<');
  });

  it('abonelikten çıkma bağlantısı düz metinde de var', () => {
    expect(buildMatchEmailText(input())).toContain('unsub?t=x');
  });
});
