// =====================================================================
// İstihbarat raporu ayrıştırma testleri.
//
// Türkçe 'İ' tuzakları burada KİLİTLİ: canlı raporda pazar tespiti
// sessizce yanlış çalışıyordu (8 pazardan yalnız 1'i bulunuyordu).
// =====================================================================
import { describe, it, expect } from 'vitest';
import {
  foldTr, parseTurkishDate, parsePeriod, detectMarkets, splitSections,
  isSpeculativeSection, extractNewsItems, sectionMarket, parseReportText,
} from './intel-report';

describe('foldTr — Türkçe ASCII katlama', () => {
  it('dotted capital İ harfini i yapar (JS /i bayrağı bunu YAPMAZ)', () => {
    expect(foldTr('İzlenen')).toBe('izlenen');
    expect(foldTr('İSPANYA')).toBe('ispanya');
    // Regresyon: /izlenen/i deseni "İzlenen" ile eşleşmiyor
    expect(/izlenen/i.test('İzlenen')).toBe(false);
    expect(/izlenen/.test(foldTr('İzlenen'))).toBe(true);
  });

  it('dotsuz ı ve büyük I harfini de i yapar', () => {
    expect(foldTr('Yatırım')).toBe('yatirim');
    expect(foldTr('ISPANYA')).toBe('ispanya');
  });

  it('diğer Türkçe harfleri katlar', () => {
    expect(foldTr('Çğöşü ÇĞÖŞÜ')).toBe('cgosu cgosu');
  });

  it('birleşen aksanlı biçimi de çözer (NFD)', () => {
    // 'i' + U+0307 (birleşen nokta) — bazı kaynaklarda İ böyle gelir
    expect(foldTr('i̇spanya')).toBe('ispanya');
  });
});

describe('detectMarkets', () => {
  const line = 'İzlenen Pazarlar: Türkiye • BAE • İspanya • İngiltere • Hollanda • Almanya • Tayland • Global';

  it('canlı rapordaki satırdan SEKİZ pazarı da bulur', () => {
    // Regresyon: düzeltmeden önce yalnız ['TH'] dönüyordu
    expect(detectMarkets(line)).toEqual(['TR', 'AE', 'ES', 'GB', 'NL', 'DE', 'TH', 'GLOBAL']);
  });

  it('İspanya ve İngiltere kaçmaz (İ tuzağı)', () => {
    const m = detectMarkets('İzlenen Pazarlar: İspanya, İngiltere');
    expect(m).toContain('ES');
    expect(m).toContain('GB');
  });

  it('"İzlenen Pazarlar" satırı yoksa başlık bloğuna bakar', () => {
    expect(detectMarkets('Dubai ve Türkiye piyasası hakkında')).toEqual(['TR', 'AE']);
  });

  it('pazar yoksa boş döner (uydurmaz)', () => {
    expect(detectMarkets('Genel piyasa notu')).toEqual([]);
  });
});

describe('parseTurkishDate', () => {
  it('canlı rapor biçimini çözer', () => {
    expect(parseTurkishDate('Rapor Tarihi: 24 Temmuz 2026')).toBe('2026-07-24');
  });
  it('tüm ayları tanır', () => {
    expect(parseTurkishDate('1 Ocak 2026')).toBe('2026-01-01');
    expect(parseTurkishDate('5 Şubat 2026')).toBe('2026-02-05');
    expect(parseTurkishDate('9 Ağustos 2026')).toBe('2026-08-09');
    expect(parseTurkishDate('30 Aralık 2026')).toBe('2026-12-30');
  });
  it('tanımadığı biçimde null döner', () => {
    expect(parseTurkishDate('2026-07-24')).toBeNull();
    expect(parseTurkishDate('bir şey yok')).toBeNull();
  });
});

describe('parsePeriod', () => {
  it('canlı rapordaki en-dash aralığını çözer', () => {
    expect(parsePeriod('Kapsam Dönemi: 17 – 24 Temmuz 2026'))
      .toEqual({ start: '2026-07-17', end: '2026-07-24' });
  });
  it('düz tire ve em-dash ile de çalışır', () => {
    expect(parsePeriod('17 - 24 Temmuz 2026').start).toBe('2026-07-17');
    expect(parsePeriod('17 — 24 Temmuz 2026').end).toBe('2026-07-24');
  });
  it('tek tarih varsa bitiş kabul eder', () => {
    expect(parsePeriod('24 Temmuz 2026')).toEqual({ start: null, end: '2026-07-24' });
  });
  it('tarih yoksa iki null', () => {
    expect(parsePeriod('kapsam belirsiz')).toEqual({ start: null, end: null });
  });
});

describe('splitSections', () => {
  // Canlı raporun yapısı: içindekiler + gerçek bölümler (aynı numaralar!)
  const doc = [
    'HAFTALIK RAPOR',
    'İçindekiler',
    '1. Yönetici Özeti',
    '2. Türkiye',
    '3. Spekülatif Gelişmeler',
    '1. Yönetici Özeti',
    'Bu hafta merkez bankaları öne çıktı. TCMB faizi %37 seviyesinde sabit tuttu ve piyasa bunu bekliyordu.',
    '2. Türkiye',
    'TÜİK Haziran verisinde toplam konut satışı 129.979 adet oldu; ipotekli satışlarda %72,1 artış görüldü.',
    '3. Spekülatif Gelişmeler',
    'Piyasada dolaşan söylentiye göre yeni bir düzenleme gelebilir; doğrulanmış bir kaynak yok.',
  ].join('\n');

  it('içindekiler satırlarını atlayıp gerçek bölümleri bulur', () => {
    const s = splitSections(doc);
    expect(s.length).toBe(3);
    expect(s.map((x) => x.index)).toEqual([1, 2, 3]);
    expect(s[1].heading).toBe('Türkiye');
    expect(s[1].body).toContain('129.979');
  });

  it('gövdesiz başlıkları (içindekiler kalıntısı) atar', () => {
    const s = splitSections('1. Boş Bölüm\n2. Dolu Bölüm\n' + 'x'.repeat(100));
    expect(s.every((x) => x.body.length >= 40)).toBe(true);
  });

  it('numaralı başlık yoksa boş döner', () => {
    expect(splitSections('Sadece düz metin, başlık yok.')).toEqual([]);
  });
});

describe('isSpeculativeSection', () => {
  it('canlı rapordaki spekülatif bölümü yakalar (İ tuzağı dahil)', () => {
    expect(isSpeculativeSection('Spekülatif Gelişmeler ve Piyasa Söylentileri')).toBe(true);
  });
  it('söylenti/rumor/doğrulanmamış varyantlarını yakalar', () => {
    expect(isSpeculativeSection('Piyasa Söylentileri')).toBe(true);
    expect(isSpeculativeSection('Unverified Reports')).toBe(true);
    expect(isSpeculativeSection('Doğrulanmamış Bilgiler')).toBe(true);
  });
  it('doğrulanmış bölümleri spekülatif SAYMAZ', () => {
    expect(isSpeculativeSection('Türkiye')).toBe(false);
    expect(isSpeculativeSection('Yatırım Fırsatları')).toBe(false);
    expect(isSpeculativeSection('Risk Analizi')).toBe(false);
  });
});

describe('sectionMarket', () => {
  it('bölüm başlığından pazarı çıkarır', () => {
    expect(sectionMarket({ index: 5, heading: 'İspanya', body: 'x'.repeat(50) })).toBe('ES');
    expect(sectionMarket({ index: 4, heading: 'Birleşik Arap Emirlikleri (BAE)', body: 'x'.repeat(50) })).toBe('AE');
  });
  it('pazar geçmiyorsa null', () => {
    expect(sectionMarket({ index: 1, heading: 'Yönetici Özeti', body: 'genel bakış '.repeat(5) })).toBeNull();
  });
});

describe('extractNewsItems', () => {
  const section = {
    index: 3, heading: 'Türkiye',
    body: [
      'Kısa satır.',
      'TÜİK Haziran verisinde toplam konut satışı 129.979 adet oldu. İpotekli satışlarda %72,1 yıllık artış manşetlere taşındı ancak baz etkisi göz ardı edilmemeli.',
      'Bu paragrafta hiç rakam yok ama yeterince uzun olduğu için aday sayılabilir, yine de sayısal olanın gerisinde kalmalı.',
      'TCMB politika faizini %37 seviyesinde sabit tuttu; ECB mevduat faizi %2,25 olarak korundu.',
    ].join('\n'),
  };

  it('rakam taşıyan paragrafları öne alır (haber değeri)', () => {
    const items = extractNewsItems(section, 2);
    expect(items.length).toBe(2);
    // İkisi de sayısal olmalı
    expect(items.every((i) => /%|\d{3}/.test(i.headline + (i.detail ?? '')))).toBe(true);
  });

  it('ilk cümleyi başlık, kalanını detay yapar', () => {
    const items = extractNewsItems(section, 4);
    const tuik = items.find((i) => i.headline.includes('129.979'));
    expect(tuik).toBeTruthy();
    expect(tuik!.headline.endsWith('.')).toBe(true);
    expect(tuik!.detail).toContain('72,1');
  });

  it('çok kısa paragrafları atar', () => {
    const items = extractNewsItems(section, 10);
    expect(items.some((i) => i.headline === 'Kısa satır.')).toBe(false);
  });

  it('uzun başlığı kırpar', () => {
    const long = { index: 1, heading: 'X', body: `${'a'.repeat(400)} %5 artış` };
    const items = extractNewsItems(long, 1);
    expect(items[0].headline.length).toBeLessThanOrEqual(201);
  });

  it('boş bölümde boş döner', () => {
    expect(extractNewsItems({ index: 1, heading: 'X', body: '' })).toEqual([]);
  });
});

describe('parseReportText — uçtan uca', () => {
  const doc = [
    'PRODUALITY',
    'Araştırma İstihbarat Masası',
    'HAFTALIK GAYRİMENKUL İSTİHBARAT RAPORU',
    'Kapsam Dönemi: 17 – 24 Temmuz 2026',
    'İzlenen Pazarlar: Türkiye • BAE • İspanya • İngiltere',
    'Rapor Tarihi: 24 Temmuz 2026',
    '1. Yönetici Özeti',
    'Bu hafta merkez bankaları haftası oldu; TCMB %37 seviyesinde sabit kaldı ve piyasa beklentisi karşılandı.',
    '2. Türkiye',
    'TÜİK Haziran verisinde konut satışı 129.979 adet; ipotekli satışta %72,1 artış kaydedildi.',
  ].join('\n');

  it('canlı rapor başlığını, dönemini ve pazarlarını doğru çıkarır', () => {
    const r = parseReportText(doc, 'dosya-adi.docx');
    expect(r.title).toBe('HAFTALIK GAYRİMENKUL İSTİHBARAT RAPORU');
    expect(r.reportDate).toBe('2026-07-24');
    expect(r.periodStart).toBe('2026-07-17');
    expect(r.periodEnd).toBe('2026-07-24');
    expect(r.markets).toEqual(['TR', 'AE', 'ES', 'GB']);
    expect(r.sections.length).toBe(2);
  });

  it('başlık bulunamazsa dosya adına düşer', () => {
    const r = parseReportText('sadece metin', 'yedek-ad.docx');
    expect(r.title).toBe('yedek-ad.docx');
  });

  it('tam metni korur (arama bunun üzerinde çalışır)', () => {
    const r = parseReportText(doc, 'x');
    expect(r.fullText).toContain('129.979');
  });
});
