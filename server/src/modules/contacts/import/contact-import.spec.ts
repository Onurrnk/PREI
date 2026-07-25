import { describe, it, expect } from 'vitest';
import {
  mapHeader, splitName, parseConsent, parseTargets, parseLang,
  buildDrafts, draftsFromCsv,
} from './contact-import';
import { parseCsv } from './csv-parse';

describe('mapHeader', () => {
  it('Türkçe başlıkları tanır', () => {
    expect(mapHeader(['Ad', 'Soyad', 'E-posta', 'Telefon']))
      .toEqual(['firstName', 'lastName', 'email', 'phone']);
  });

  it('İngilizce başlıkları tanır', () => {
    expect(mapHeader(['First Name', 'Last Name', 'Email', 'Phone']))
      .toEqual(['firstName', 'lastName', 'email', 'phone']);
  });

  // 'İ' (U+0130) /i bayrağıyla 'i'ye katlanmaz — foldTr olmasa bu kırılır.
  it('büyük İ ile başlayan başlık tanınır', () => {
    expect(mapHeader(['İsim', 'İl'])).toEqual(['firstName', 'city']);
  });

  it('büyük/küçük harf ve fazla boşluk önemsiz', () => {
    expect(mapHeader(['  AD  ', 'E-POSTA'])).toEqual(['firstName', 'email']);
  });

  // Google Kişiler "Phone 1 - Value", "Phone 2 - Value" diye yazar;
  // ikincisi birincisini ezmemeli.
  it('bir alan yalnız ilk eşleşen kolonu alır', () => {
    expect(mapHeader(['Phone 1 - Value', 'Phone 2 - Value']))
      .toEqual(['phone', null]);
  });

  // "Telefon Ülkesi" telefondan türetilmiş bir ipucu; ne telefon ne de
  // yatırım hedefi. İçe aktarılmaz — ama sırf içinde 'telefon' geçtiği için
  // gerçek telefon kolonunun yuvasını da çalmamalı.
  it('"Telefon Ülkesi" yok sayılır ve telefonu çalmaz', () => {
    expect(mapHeader(['Telefon', 'Telefon Ülkesi'])).toEqual(['phone', null]);
    // Sıra tersine dönse bile telefon doğru kolondan gelir:
    expect(mapHeader(['Telefon Ülkesi', 'Telefon'])).toEqual([null, 'phone']);
  });

  it('yok sayılan kolonlar "tanınmadı" uyarısı üretmez', () => {
    const { unmappedHeaders } = buildDrafts(
      parseCsv('Ad,ID,Kayıt Tarihi,Zümrüt\nAhmet,1,2026-01-01,x'),
    );
    expect(unmappedHeaders).toEqual(['Zümrüt']);
  });

  it('tanınmayan başlık null', () => {
    expect(mapHeader(['Zümrüt', ''])).toEqual([null, null]);
  });

  it('ad-soyad tek kolon olarak tanınır', () => {
    expect(mapHeader(['Ad Soyad'])).toEqual(['fullName']);
    expect(mapHeader(['Full Name'])).toEqual(['fullName']);
    expect(mapHeader(['Name'])).toEqual(['fullName']);
  });

  it('nota katlanacak alanlar tanınır', () => {
    expect(mapHeader(['Firma', 'Unvan', 'Bütçe', 'Kaynak']))
      .toEqual(['company', 'title', 'budget', 'source']);
  });
});

describe('splitName', () => {
  it('son kelime soyad', () => {
    expect(splitName('Ahmet Yılmaz')).toEqual({ firstName: 'Ahmet', lastName: 'Yılmaz' });
  });

  // Türkçe'de çok parçalı ÖN AD yaygın; ilk kelimeyi ad sayıp kalanı soyad
  // yapmak "Mehmet Ali"yi ikiye bölerdi.
  it('çok parçalı ön ad bölünmez', () => {
    expect(splitName('Mehmet Ali Kaya'))
      .toEqual({ firstName: 'Mehmet Ali', lastName: 'Kaya' });
  });

  // İçe aktarılan kayıt elle açılanla AYNI bölünmeli, yoksa mükerrer görünür.
  it('uygulamanın geri kalanıyla aynı kural (clients.repository.ts:126)', () => {
    const appRule = (full: string) => {
      const parts = full.trim().split(/\s+/);
      const lastName = parts.length > 1 ? parts.pop()! : null;
      return { firstName: parts.join(' '), lastName };
    };
    for (const n of ['Ahmet Yılmaz', 'Mehmet Ali Kaya', 'Ayşe', 'Hasan Hüseyin Öz']) {
      expect(splitName(n)).toEqual(appRule(n));
    }
  });

  it('tek kelime soyadsız', () => {
    expect(splitName('Ahmet')).toEqual({ firstName: 'Ahmet', lastName: null });
  });

  it('fazla boşluklar temizlenir', () => {
    expect(splitName('  Ahmet   Yılmaz  '))
      .toEqual({ firstName: 'Ahmet', lastName: 'Yılmaz' });
  });

  it('boş girdi boş ad', () => {
    expect(splitName('   ')).toEqual({ firstName: '', lastName: null });
  });
});

describe('parseConsent', () => {
  it('Türkçe olumlu değerler', () => {
    for (const v of ['Evet', 'VAR', 'onaylı', 'izinli', 'E']) {
      expect(parseConsent(v)).toBe(true);
    }
  });

  it('İngilizce ve işaret değerleri', () => {
    for (const v of ['Yes', 'true', '1', 'X']) expect(parseConsent(v)).toBe(true);
  });

  // KVKK: belirsizlik izin sayılmaz.
  it('boş / hayır / anlamsız → izin yok', () => {
    for (const v of ['', '  ', 'hayır', 'no', '0', 'belki', null, undefined]) {
      expect(parseConsent(v)).toBe(false);
    }
  });
});

describe('parseLang', () => {
  it('kodu doğrudan kabul eder', () => {
    expect(parseLang('tr')).toBe('tr');
    expect(parseLang('EN')).toBe('en');
  });

  it('dil adını koda çevirir', () => {
    expect(parseLang('Türkçe')).toBe('tr');
    expect(parseLang('İngilizce')).toBe('en');
    expect(parseLang('Almanca')).toBe('de');
  });

  it('tanınmayan dil null (uydurmaz)', () => {
    expect(parseLang('Klingonca')).toBeNull();
    expect(parseLang('')).toBeNull();
    expect(parseLang(null)).toBeNull();
  });
});

describe('parseTargets', () => {
  it('tek ülke çözülür', () => {
    const r = parseTargets('İngiltere');
    expect(r.targets).toEqual([{ countryCode: 'GB', countryName: 'İngiltere', region: null }]);
    expect(r.unresolved).toEqual([]);
  });

  it('şehirden ülke çıkarılır', () => {
    expect(parseTargets('Dubai').targets[0].countryCode).toBe('AE');
  });

  it('virgül/noktalı virgül/ve ile çoklu ülke', () => {
    expect(parseTargets('Dubai, İngiltere').targets.map((t) => t.countryCode))
      .toEqual(['AE', 'GB']);
    expect(parseTargets('BAE; İspanya').targets.map((t) => t.countryCode))
      .toEqual(['AE', 'ES']);
    expect(parseTargets('Türkiye ve Almanya').targets.map((t) => t.countryCode))
      .toEqual(['TR', 'DE']);
  });

  it('aynı ülke iki kez yazılırsa tek kayıt', () => {
    expect(parseTargets('BAE, UAE').targets).toHaveLength(1);
  });

  it('çözülemeyen parça raporlanır, sessizce düşmez', () => {
    const r = parseTargets('İngiltere, Zümrüt Diyarı');
    expect(r.targets).toHaveLength(1);
    expect(r.unresolved).toEqual(['Zümrüt Diyarı']);
  });

  it('ülke boşsa şehir kolonundan çözülür', () => {
    const r = parseTargets('', 'Barcelona');
    expect(r.targets[0].countryCode).toBe('ES');
  });

  // Şehri her ülkeye iliştirmek yanlış bölge üretirdi.
  it('şehir yalnız ilk hedefe iliştirilir', () => {
    const r = parseTargets('Türkiye, Almanya', 'İstanbul');
    expect(r.targets[0].region).toBe('İstanbul');
    expect(r.targets[1].region).toBeNull();
  });

  it('ikisi de boşsa hedef yok', () => {
    expect(parseTargets('', '')).toEqual({ targets: [], unresolved: [] });
    expect(parseTargets(null, null)).toEqual({ targets: [], unresolved: [] });
  });
});

describe('buildDrafts', () => {
  const build = (csv: string, opts = {}) => buildDrafts(parseCsv(csv), opts);

  it('temel satırı taslağa çevirir', () => {
    const { drafts } = build('Ad,Soyad,E-posta,Telefon\nAhmet,Yılmaz,A@B.com,+90 532 123 45 67');
    expect(drafts[0]).toMatchObject({
      rowNumber: 1, firstName: 'Ahmet', lastName: 'Yılmaz',
      email: 'a@b.com', phone: '+905321234567', phoneCountry: 'TR', skip: false,
    });
    expect(drafts[0].issues).toEqual([]);
  });

  it('tek "Ad Soyad" kolonu bölünür', () => {
    const { drafts } = build('Ad Soyad,E-posta\nAhmet Yılmaz,a@b.com');
    expect(drafts[0]).toMatchObject({ firstName: 'Ahmet', lastName: 'Yılmaz' });
  });

  // Tek "Ad" kolonuna tam isim yazmak çok yaygın.
  it('Ad kolonunda boşluk varsa ve soyad kolonu yoksa bölünür', () => {
    const { drafts } = build('Ad,E-posta\nAhmet Yılmaz,a@b.com');
    expect(drafts[0]).toMatchObject({ firstName: 'Ahmet', lastName: 'Yılmaz' });
  });

  it('soyad kolonu varsa ad kolonu bölünmez', () => {
    const { drafts } = build('Ad,Soyad\nMehmet Ali,Kaya');
    expect(drafts[0]).toMatchObject({ firstName: 'Mehmet Ali', lastName: 'Kaya' });
  });

  it('tamamen boş satır atlanır', () => {
    const { drafts } = build('Ad,E-posta\n,');
    expect(drafts[0].skip).toBe(true);
    expect(drafts[0].issues[0]).toContain('Boş satır');
  });

  // Gerçek bir müşteriyi ismi yazılmamış diye kaybetmek en kötü sonuç.
  it('isimsiz ama e-postalı satır atlanmaz, ad türetilir', () => {
    const { drafts } = build('Ad,E-posta\n,ahmet.yilmaz@b.com');
    expect(drafts[0].skip).toBe(false);
    expect(drafts[0].firstName).toBe('ahmet yilmaz');
    expect(drafts[0].issues[0]).toContain('İsim yok');
  });

  it('isimsiz e-postasız ama telefonlu satır korunur', () => {
    const { drafts } = build('Ad,Telefon\n,+905321234567');
    expect(drafts[0].skip).toBe(false);
    expect(drafts[0].firstName).toBe('İsimsiz');
  });

  it('dosya içi mükerrer e-posta ikinci satırda atlanır', () => {
    const { drafts } = build('Ad,E-posta\nAhmet,a@b.com\nAhmet,a@b.com');
    expect(drafts[0].skip).toBe(false);
    expect(drafts[1].skip).toBe(true);
    expect(drafts[1].issues[0]).toContain('1. satır');
  });

  it('dosya içi mükerrer telefon yakalanır (yazım farkı önemsiz)', () => {
    const { drafts } = build('Ad,Telefon\nAhmet,+90 532 123 45 67\nAhmet,+905321234567');
    expect(drafts[1].skip).toBe(true);
  });

  it('farklı kişiler atlanmaz', () => {
    const { drafts } = build('Ad,E-posta\nAhmet,a@b.com\nAyşe,c@d.com');
    expect(drafts.every((d) => !d.skip)).toBe(true);
  });

  it('yerel numara varsayılan alan koduyla tamamlanır', () => {
    const { drafts } = build('Ad,Telefon\nAhmet,0532 123 45 67', { defaultDialCode: '90' });
    expect(drafts[0].phone).toBe('+905321234567');
    expect(drafts[0].phoneCountry).toBe('TR');
  });

  // Alan kodu verilmezse ülke UYDURULMAZ; kullanıcı uyarılır.
  it('alan kodu verilmezse yerel numara çözülmez ve uyarılır', () => {
    const { drafts } = build('Ad,Telefon\nAhmet,0532 123 45 67');
    expect(drafts[0].phoneCountry).toBeNull();
    expect(drafts[0].issues.some((i) => i.includes('çözülemedi'))).toBe(true);
  });

  it('uluslararası numaraya varsayılan alan kodu eklenmez', () => {
    const { drafts } = build('Ad,Telefon\nAhmet,+971501234567', { defaultDialCode: '90' });
    expect(drafts[0].phoneCountry).toBe('AE');
  });

  it('yatırım hedefleri ülke + şehirden kurulur', () => {
    const { drafts } = build('Ad,Ülke,Şehir\nAhmet,BAE,Dubai');
    expect(drafts[0].targets).toEqual([
      { countryCode: 'AE', countryName: 'Birleşik Arap Emirlikleri', region: 'Dubai' },
    ]);
  });

  it('tanınmayan ülke uyarı üretir ama satırı düşürmez', () => {
    const { drafts } = build('Ad,Ülke\nAhmet,Zümrüt');
    expect(drafts[0].skip).toBe(false);
    expect(drafts[0].issues.some((i) => i.includes('Ülke tanınmadı'))).toBe(true);
  });

  // contacts'ta bu kolonlar yok; atmak yerine nota taşınır.
  it('firma/unvan/bütçe/kaynak nota katlanır', () => {
    const { drafts } = build(
      'Ad,Not,Firma,Unvan,Bütçe,Kaynak\nAhmet,Eski müşteri,ProDuality,CEO,500k,Instagram',
    );
    expect(drafts[0].notes).toBe(
      'Eski müşteri\nFirma: ProDuality · Unvan: CEO · Bütçe: 500k · Kaynak: Instagram',
    );
  });

  it('ek alan yoksa not sadece not kolonudur', () => {
    const { drafts } = build('Ad,Not\nAhmet,Eski müşteri');
    expect(drafts[0].notes).toBe('Eski müşteri');
  });

  it('hiç not yoksa null', () => {
    const { drafts } = build('Ad\nAhmet');
    expect(drafts[0].notes).toBeNull();
  });

  it('tanınmayan başlıklar raporlanır', () => {
    const { unmappedHeaders } = build('Ad,Zümrüt,Kripto\nAhmet,x,y');
    expect(unmappedHeaders).toEqual(['Zümrüt', 'Kripto']);
  });

  it('eşleşme tablosu her başlık için döner', () => {
    const { mapping } = build('Ad,Zümrüt\nAhmet,x');
    expect(mapping).toEqual([
      { header: 'Ad', field: 'firstName' },
      { header: 'Zümrüt', field: null },
    ]);
  });

  it('izin kolonu okunur', () => {
    const { drafts } = build('Ad,İzin\nAhmet,Evet\nAyşe,Hayır');
    expect(drafts[0].consent).toBe(true);
    expect(drafts[1].consent).toBe(false);
  });

  it('satır numaraları başlık hariç 1 tabanlı', () => {
    const { drafts } = build('Ad\nA\nB\nC');
    expect(drafts.map((d) => d.rowNumber)).toEqual([1, 2, 3]);
  });
});

describe('draftsFromCsv', () => {
  // Gerçek Türkçe Excel çıktısı: BOM + noktalı virgül + Türkçe başlıklar.
  it('BOM + noktalı virgüllü Türkçe dosyayı uçtan uca işler', () => {
    const csv = '﻿Adı Soyadı;E-posta;Telefon;İlgilendiği Ülkeler;İzin\n'
              + 'Ahmet Yılmaz;ahmet@ornek.com;0532 111 22 33;Dubai, İngiltere;Evet\n'
              + 'Ayşe Kaya;ayse@ornek.com;+44 7700 900123;İspanya;Hayır';

    const { parsed, drafts, unmappedHeaders } = draftsFromCsv(csv, { defaultDialCode: '90' });

    expect(parsed.delimiter).toBe(';');
    expect(unmappedHeaders).toEqual([]);
    expect(drafts).toHaveLength(2);

    expect(drafts[0]).toMatchObject({
      firstName: 'Ahmet', lastName: 'Yılmaz', email: 'ahmet@ornek.com',
      phone: '+905321112233', phoneCountry: 'TR', consent: true, skip: false,
    });
    expect(drafts[0].targets.map((t) => t.countryCode)).toEqual(['AE', 'GB']);

    expect(drafts[1]).toMatchObject({
      firstName: 'Ayşe', lastName: 'Kaya', phoneCountry: 'GB', consent: false,
    });
  });

  it('boş dosya taslak üretmez', () => {
    expect(draftsFromCsv('').drafts).toEqual([]);
  });
});
