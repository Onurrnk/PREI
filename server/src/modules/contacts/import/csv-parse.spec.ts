import { describe, it, expect } from 'vitest';
import { parseCsv, parseWith, sniffDelimiter, stripBom } from './csv-parse';

describe('stripBom', () => {
  it('UTF-8 BOM atılır', () => {
    expect(stripBom('﻿Ad')).toBe('Ad');
  });

  it('BOM yoksa metin bozulmaz', () => {
    expect(stripBom('Ad')).toBe('Ad');
    expect(stripBom('')).toBe('');
  });
});

describe('sniffDelimiter', () => {
  // Türkçe Windows Excel noktalı virgülle yazar; virgül varsayarsak
  // tüm satır tek kolona düşer ve içe aktarım sessizce boş kalır.
  it('Türkçe Excel noktalı virgülünü bulur', () => {
    const csv = 'Ad;Soyad;E-posta\nAhmet;Yılmaz;a@b.com\nAyşe;Kaya;c@d.com';
    expect(sniffDelimiter(csv)).toBe(';');
  });

  it('standart virgülü bulur', () => {
    expect(sniffDelimiter('Ad,Soyad\nAhmet,Yılmaz')).toBe(',');
  });

  it('sekme ile ayrılmışı bulur', () => {
    expect(sniffDelimiter('Ad\tSoyad\nAhmet\tYılmaz')).toBe('\t');
  });

  it('boru işaretini bulur', () => {
    expect(sniffDelimiter('Ad|Soyad\nAhmet|Yılmaz')).toBe('|');
  });

  // Not alanında virgül geçen ama gerçek ayırıcısı ";" olan dosya:
  // sayıya değil satır tutarlılığına bakıldığı için doğru seçilir.
  it('veri içindeki virgüller ayırıcıyı şaşırtmaz', () => {
    const csv = 'Ad;Not\nAhmet;"Dubai, Londra, Madrid ile ilgileniyor"\n'
              + 'Ayşe;"İstanbul, Bodrum"';
    expect(sniffDelimiter(csv)).toBe(';');
  });

  it('tek kolonluk dosyada virgüle düşer (ayırıcı yok)', () => {
    expect(sniffDelimiter('E-posta\na@b.com\nc@d.com')).toBe(',');
  });

  it('boş metin virgül döner', () => {
    expect(sniffDelimiter('')).toBe(',');
  });

  // Eşit tutarlılıkta daha çok kolon üreten kazanmalı.
  it('daha çok kolon üreten ayırıcı kazanır', () => {
    const csv = 'a;b;c;d\n1;2;3;4';
    expect(sniffDelimiter(csv)).toBe(';');
  });
});

describe('parseWith', () => {
  it('tırnak içindeki ayırıcı bölmez', () => {
    expect(parseWith('a,"b,c",d', ',')).toEqual([['a', 'b,c', 'd']]);
  });

  it('tırnak içindeki satır sonu satırı bölmez', () => {
    expect(parseWith('a,"iki\nsatır",c', ',')).toEqual([['a', 'iki\nsatır', 'c']]);
  });

  it('"" kaçırılmış tırnak olarak okunur', () => {
    expect(parseWith('a,"de ""merhaba"" dedi",c', ',')).toEqual([
      ['a', 'de "merhaba" dedi', 'c'],
    ]);
  });

  it('CRLF satır sonu desteklenir', () => {
    expect(parseWith('a,b\r\nc,d', ',')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('dosya yeni satırla bitse de son satır kaybolmaz', () => {
    expect(parseWith('a,b\nc,d\n', ',')).toEqual([['a', 'b'], ['c', 'd']]);
    expect(parseWith('a,b\nc,d', ',')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('tamamen boş satırlar atlanır', () => {
    expect(parseWith('a,b\n\nc,d\n\n', ',')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('boş alanlar korunur', () => {
    expect(parseWith('a,,c', ',')).toEqual([['a', '', 'c']]);
  });

  it('boş metin boş dizi', () => {
    expect(parseWith('', ',')).toEqual([]);
  });
});

describe('parseCsv', () => {
  it('başlık ve satırları ayırır, başlığı kırpar', () => {
    const r = parseCsv(' Ad , Soyad \nAhmet,Yılmaz');
    expect(r.header).toEqual(['Ad', 'Soyad']);
    expect(r.rows).toEqual([['Ahmet', 'Yılmaz']]);
  });

  // Tek bozuk satır tüm içe aktarımı düşürmemeli.
  it('kısa satır boş alanla tamamlanır', () => {
    const r = parseCsv('Ad,Soyad,E-posta\nAhmet,Yılmaz');
    expect(r.rows).toEqual([['Ahmet', 'Yılmaz', '']]);
  });

  it('uzun satırın fazlası yok sayılır', () => {
    const r = parseCsv('Ad,Soyad\nAhmet,Yılmaz,fazla');
    expect(r.rows).toEqual([['Ahmet', 'Yılmaz']]);
  });

  it('BOM + noktalı virgül birlikte çalışır (gerçek Excel çıktısı)', () => {
    const r = parseCsv('﻿Ad;Soyad\nAhmet;Yılmaz');
    expect(r.delimiter).toBe(';');
    expect(r.header).toEqual(['Ad', 'Soyad']);
  });

  it('ayırıcı elle verilebilir', () => {
    const r = parseCsv('a;b\n1;2', ',');
    expect(r.delimiter).toBe(',');
    expect(r.header).toEqual(['a;b']);
  });

  it('boş dosyada boş başlık/satır', () => {
    expect(parseCsv('')).toEqual({ delimiter: ',', header: [], rows: [] });
  });

  it('yalnız başlık varsa satır yok', () => {
    const r = parseCsv('Ad,Soyad');
    expect(r.header).toEqual(['Ad', 'Soyad']);
    expect(r.rows).toEqual([]);
  });
});
