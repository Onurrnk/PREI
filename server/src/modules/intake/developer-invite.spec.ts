import { describe, it, expect } from 'vitest';
import { parseSender, firmName, detectLang, buildInviteCopy, inviteUrl } from './developer-invite';

describe('parseSender', () => {
  it('tırnaklı ad + adresi ayırır', () => {
    expect(parseSender('"Onur Nazım Karataş" <onur@firma.com>'))
      .toEqual({ name: 'Onur Nazım Karataş', email: 'onur@firma.com' });
  });

  it('tırnaksız adı ayırır', () => {
    expect(parseSender('Ahmet Yılmaz <ahmet@marina.ae>'))
      .toEqual({ name: 'Ahmet Yılmaz', email: 'ahmet@marina.ae' });
  });

  it('düz adresi kabul eder', () => {
    expect(parseSender('info@marina.ae')).toEqual({ name: null, email: 'info@marina.ae' });
  });

  it('adresi küçük harfe çevirir', () => {
    expect(parseSender('<Info@Marina.AE>').email).toBe('info@marina.ae');
  });

  it('boş/bozuk girdide null döner', () => {
    expect(parseSender(null)).toEqual({ name: null, email: null });
    expect(parseSender('adres yok')).toEqual({ name: null, email: null });
  });
});

describe('firmName', () => {
  const s = (name: string | null, email: string | null) => ({ name, email });

  it('modelin çıkardığı firma adını tercih eder', () => {
    expect(firmName('Marina Developments', s('Ahmet', 'a@marina.ae'))).toBe('Marina Developments');
  });

  it('firma adı yoksa kişi adına düşer', () => {
    expect(firmName(null, s('Ahmet Yılmaz', 'a@marina.ae'))).toBe('Ahmet Yılmaz');
  });

  it('ikisi de yoksa alan adından üretir', () => {
    expect(firmName(null, s(null, 'info@marina.ae'))).toBe('Marina');
  });

  // Serbest posta sağlayıcısından firma adı üretmek yanlış olur ("Gmail A.Ş.").
  it('gmail gibi sağlayıcılardan firma adı UYDURMAZ', () => {
    expect(firmName(null, s(null, 'biri@gmail.com'))).toBeNull();
    expect(firmName(null, s(null, 'biri@hotmail.com'))).toBeNull();
  });

  it('hiçbir ipucu yoksa null', () => {
    expect(firmName(null, s(null, null))).toBeNull();
  });
});

describe('detectLang', () => {
  it('Türkçe karakterden anlar', () => {
    expect(detectLang('Yeni projemiz için görüşelim')).toBe('tr');
  });

  it('Türkçe kelimelerden anlar (karaktersiz)', () => {
    expect(detectLang('merhaba proje daire fiyat')).toBe('tr');
  });

  it('İngilizceyi İngilizce sayar', () => {
    expect(detectLang('We would like to present our new development')).toBe('en');
  });

  it('birden çok metni birlikte değerlendirir', () => {
    expect(detectLang('New Project', 'Merhaba, teslim 2027')).toBe('tr');
  });
});

describe('buildInviteCopy', () => {
  const input = {
    contactName: 'Ahmet Yılmaz', firm: 'Marina Developments',
    projectTitle: 'Marina Bay Towers', url: 'https://prei.produality.com/submit/abc',
  };

  it('Türkçe metin: proje adı, tebrik ve link', () => {
    const c = buildInviteCopy('tr', input);
    expect(c.subject).toContain('Marina Bay Towers');
    expect(c.greeting).toBe('Sayın Ahmet Yılmaz,');
    expect(c.paragraphs.join(' ')).toContain('hayırlı olsun');
    expect(c.ctaUrl).toBe(input.url);
  });

  // Asıl ikna noktası: eksik alan = eşleşmeme. Metinden düşerse rica
  // gerekçesiz kalır.
  it('yapay zekâ eşleştirme gerekçesini AÇIKÇA yazar', () => {
    const tr = buildInviteCopy('tr', input).paragraphs.join(' ');
    expect(tr).toContain('yapay zekâ');
    expect(tr).toContain('Boş bıraktığınız her alan');

    const en = buildInviteCopy('en', input).paragraphs.join(' ');
    expect(en).toContain('AI automation');
    expect(en).toContain('cannot be matched');
  });

  it('İngilizce metin ayrı üretilir', () => {
    const c = buildInviteCopy('en', input);
    expect(c.greeting).toBe('Dear Ahmet Yılmaz,');
    expect(c.ctaLabel).toBe('Fill In Project Details');
  });

  it('kişi adı yoksa nötr selamlar', () => {
    expect(buildInviteCopy('tr', { ...input, contactName: null }).greeting).toBe('Merhaba,');
    expect(buildInviteCopy('en', { ...input, contactName: '  ' }).greeting).toBe('Hello,');
  });
});

describe('inviteUrl', () => {
  it('form adresini kurar', () => {
    expect(inviteUrl('https://prei.produality.com', 'tok123'))
      .toBe('https://prei.produality.com/submit/tok123');
  });

  it('sondaki eğik çizgiyi çiftlemez', () => {
    expect(inviteUrl('https://prei.produality.com/', 'tok'))
      .toBe('https://prei.produality.com/submit/tok');
  });
});
