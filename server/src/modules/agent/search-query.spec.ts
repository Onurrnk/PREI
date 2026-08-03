import { describe, it, expect } from 'vitest';
import { buildTopicQuery } from './search-query';

/** Sorguda geçen sözcükleri katlanmış hâlde kümeye çevirir (sıra önemsiz). */
const kelimeler = (s: string) => new Set(s.toLocaleLowerCase('tr').split(/\s+/).filter(Boolean));

describe('buildTopicQuery', () => {
  // Canlıda ölçülen gerçek mesaj. Ham hâli 0,48 skorla e-kitap altbilgisi
  // getiriyordu; konu sorgusu 0,65 ile "Bebek — İstanbul'un Tavan Katı".
  const gercekMesaj = 'Mail için teşekkürler. Açık konuşmak gerekirse boğaz manzarası '
    + 'olmazsa olmazımız ve bu konuda çok güzel bir manzara istiyoruz. Araç park etme '
    + 'konusunda da rahatlık sağlamalı. bebek, yeniköy, üsküdar olabilir.. '
    + 'alternatiflere de açığız';

  it('gerçek mesajdan konu anahtarlarını çıkarır', () => {
    const q = buildTopicQuery({ message: gercekMesaj });
    const k = kelimeler(q);
    // Aranan yerler korunmalı
    expect(k.has('bebek')).toBe(true);
    expect(k.has('yeniköy')).toBe(true);
    expect(k.has('üsküdar')).toBe(true);
    // Alan terimleri korunmalı
    expect(k.has('boğaz')).toBe(true);
    expect(k.has('manzara')).toBe(true);
    expect(k.has('park')).toBe(true);
  });

  it('sohbet doldurmasını atar', () => {
    const k = kelimeler(buildTopicQuery({ message: gercekMesaj }));
    for (const dolgu of ['için', 'teşekkürler', 'olmazsa', 'istiyoruz', 'açığız', 'çok']) {
      expect(k.has(dolgu), dolgu).toBe(false);
    }
  });

  it('bağlamı (önceki turlardan bilinen şehir) öne ekler', () => {
    const q = buildTopicQuery({ message: 'Bebek olabilir', context: ['İstanbul', 'daire'] });
    expect(q.startsWith('İstanbul daire')).toBe(true);
    expect(kelimeler(q).has('bebek')).toBe(true);
  });

  it('bütçeyi ve para birimini korur', () => {
    const k = kelimeler(buildTopicQuery({ message: '10m usd bütçemiz var, Dubai bakıyoruz' }));
    expect([...k].some((x) => x.includes('10m'))).toBe(true);
    expect(k.has('dubai')).toBe(true);
  });

  it('aynı sözcüğü iki kez eklemez', () => {
    const q = buildTopicQuery({ message: 'Boğaz boğaz BOĞAZ manzarası' });
    expect(q.toLocaleLowerCase('tr').split(/\s+/).filter((w) => w === 'boğaz')).toHaveLength(1);
  });

  // Aşırı eleme boş sorgu üretirse arama hiç sonuç dönmez — ham metin daha iyi.
  it('çok kısaldıysa ham mesaja düşer', () => {
    expect(buildTopicQuery({ message: 'evet' })).toBe('evet');
    expect(buildTopicQuery({ message: 'çok teşekkürler' })).toBe('çok teşekkürler');
  });

  it('boş girdide boş döner', () => {
    expect(buildTopicQuery({ message: '' })).toBe('');
    expect(buildTopicQuery({ message: '   ' })).toBe('');
  });

  it('İngilizce mesajda da çalışır', () => {
    const k = kelimeler(buildTopicQuery({ message: 'Looking for a villa with sea view in Bodrum' }));
    expect(k.has('villa')).toBe(true);
    expect(k.has('bodrum')).toBe(true);
  });
});
