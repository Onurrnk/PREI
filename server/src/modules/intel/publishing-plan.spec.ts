import { describe, it, expect } from 'vitest';
import {
  addDays, weekStart, distributeWeek, clampCounts, calendarRows, postToTextFile, weekOverview,
  PLAN_SCHEMA, PLAN_SYSTEM, DAY_NAMES,
  LINKEDIN_POSTS_PER_WEEK, CAROUSELS_PER_WEEK_MIN, CAROUSELS_PER_WEEK_MAX,
} from './publishing-plan';

describe('addDays', () => {
  it('gün ekler', () => {
    expect(addDays('2026-07-27', 6)).toBe('2026-08-02');
  });

  it('geriye gider', () => {
    expect(addDays('2026-08-02', -6)).toBe('2026-07-27');
  });

  it('ay/yıl sınırını aşar', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  // Yerel saat dilimi (Türkiye UTC+3) kullanılırsa tarih bir gün kayar.
  it('saat dilimi kaymaz — 29 Şubat artık yıl', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });
});

describe('weekStart', () => {
  it('pazartesiyi olduğu gibi bırakır', () => {
    // 2026-07-27 pazartesi
    expect(weekStart('2026-07-27')).toBe('2026-07-27');
  });

  it('cumadan pazartesiye çeker', () => {
    expect(weekStart('2026-07-31')).toBe('2026-07-27');
  });

  it('PAZAR günü aynı haftanın pazartesisine çeker (bir sonrakine değil)', () => {
    // getUTCDay pazar için 0 — naif (day-1) hesabı burada patlar.
    expect(weekStart('2026-08-02')).toBe('2026-07-27');
  });

  it('cumartesi', () => {
    expect(weekStart('2026-08-01')).toBe('2026-07-27');
  });
});

describe('distributeWeek', () => {
  const week = distributeWeek('2026-07-27', 4, 3);

  it('4 post + 3 karusel = 7 kalem, her güne bir tane', () => {
    expect(week).toHaveLength(7);
    expect(new Set(week.map((s) => s.dayIndex)).size).toBe(7);
  });

  it('tarihe göre sıralı ve gün adı tarihle tutarlı', () => {
    for (let i = 0; i < week.length; i++) {
      expect(week[i].dayIndex).toBe(i);
      expect(week[i].dayName).toBe(DAY_NAMES[i]);
      expect(week[i].date).toBe(addDays('2026-07-27', i));
    }
  });

  it('postlar hafta içine gider (Pzt, Sal, Per, Cum)', () => {
    const postDays = week.filter((s) => s.kind === 'post').map((s) => s.dayIndex);
    expect(postDays).toEqual([0, 1, 3, 4]);
  });

  it('karuseller Çar/Cmt/Paz', () => {
    const cDays = week.filter((s) => s.kind === 'carousel').map((s) => s.dayIndex);
    expect(cDays).toEqual([2, 5, 6]);
  });

  it('yalnız postlar LinkedIn işaretli; hepsi Meta işaretli', () => {
    for (const s of week) {
      expect(s.linkedin).toBe(s.kind === 'post');
      expect(s.meta).toBe(true);
    }
  });

  it('sıra numaraları 1..n', () => {
    expect(week.filter((s) => s.kind === 'post').map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(week.filter((s) => s.kind === 'carousel').map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it('2 karusel: 6 kalem, gün çakışması yok', () => {
    const w = distributeWeek('2026-07-27', 4, 2);
    expect(w).toHaveLength(6);
    expect(new Set(w.map((s) => s.dayIndex)).size).toBe(6);
  });

  it('fazla kalem istenirse tercih dışı günlere taşar ama çakışmaz', () => {
    const w = distributeWeek('2026-07-27', 5, 3);
    expect(w).toHaveLength(7); // 7 günden fazlası yerleşemez
    expect(new Set(w.map((s) => s.dayIndex)).size).toBe(7);
  });

  it('7 günü aşan istek sessizce kırpılır, kopya gün üretmez', () => {
    const w = distributeWeek('2026-07-27', 6, 5);
    expect(w.length).toBeLessThanOrEqual(7);
    expect(new Set(w.map((s) => s.dayIndex)).size).toBe(w.length);
  });

  it('sıfır kalem → boş plan', () => {
    expect(distributeWeek('2026-07-27', 0, 0)).toEqual([]);
  });
});

describe('clampCounts', () => {
  const p = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

  it('tam sayıda içeriği olduğu gibi bırakır', () => {
    const r = clampCounts(p(4), p(3));
    expect(r.posts).toHaveLength(4);
    expect(r.carousels).toHaveLength(3);
    expect(r.trimmed).toBe(0);
  });

  it('fazla postu 4e kırpar', () => {
    const r = clampCounts(p(7), p(3));
    expect(r.posts).toHaveLength(4);
    expect(r.trimmed).toBe(3);
  });

  it('fazla karuseli 3e kırpar', () => {
    const r = clampCounts(p(4), p(6));
    expect(r.carousels).toHaveLength(3);
    expect(r.trimmed).toBe(3);
  });

  it('eksik içeriği ÇOĞALTMAZ — az post, sahte posttan iyi', () => {
    const r = clampCounts(p(2), p(1));
    expect(r.posts).toHaveLength(2);
    expect(r.carousels).toHaveLength(1);
    expect(r.trimmed).toBe(0);
  });

  it('ilk kalemleri korur (sıra bozulmaz)', () => {
    const r = clampCounts(p(6), p(1));
    expect(r.posts.map((x) => x.id)).toEqual([0, 1, 2, 3]);
  });

  it('dizi olmayan girdide çökmez', () => {
    const r = clampCounts(undefined as never, null as never);
    expect(r.posts).toEqual([]);
    expect(r.carousels).toEqual([]);
    expect(r.trimmed).toBe(0);
  });
});

describe('PLAN_SCHEMA', () => {
  const props = PLAN_SCHEMA.properties as Record<string, any>;

  it('LinkedIn postu sayısını 4 olarak ZORLAR', () => {
    expect(props.linkedinPosts.minItems).toBe(LINKEDIN_POSTS_PER_WEEK);
    expect(props.linkedinPosts.maxItems).toBe(LINKEDIN_POSTS_PER_WEEK);
  });

  it('karusel sayısını 2-3 aralığında zorlar', () => {
    expect(props.carousels.minItems).toBe(CAROUSELS_PER_WEEK_MIN);
    expect(props.carousels.maxItems).toBe(CAROUSELS_PER_WEEK_MAX);
  });

  it('her postta Instagram metni ayrı alan (aynı metin kopyalanmasın)', () => {
    expect(props.linkedinPosts.items.required).toContain('instagramCaption');
  });

  it('karusel slayt sayısı 4-7', () => {
    const slides = props.carousels.items.properties.slides;
    expect(slides.minItems).toBe(4);
    expect(slides.maxItems).toBe(7);
  });

  it('slaytta görsel istemi zorunlu', () => {
    expect(props.carousels.items.properties.slides.items.required).toContain('imagePrompt');
  });

  it('atlananlar şeffaflık için zorunlu alan', () => {
    expect(PLAN_SCHEMA.required).toContain('skipped');
  });

  it('ek alan kabul etmez', () => {
    expect(PLAN_SCHEMA.additionalProperties).toBe(false);
    expect(props.linkedinPosts.items.additionalProperties).toBe(false);
  });
});

describe('PLAN_SYSTEM', () => {
  it('spekülatif bölümden içerik üretmeyi yasaklar', () => {
    expect(PLAN_SYSTEM).toMatch(/SPEKÜLATİF BÖLÜMDEN İÇERİK ÜRETME/);
  });

  it('İspanya Golden Visa kaldırıldı çapasını taşır', () => {
    expect(PLAN_SYSTEM).toMatch(/Golden Visa 3 Nisan 2025'te KALDIRILDI/);
  });

  it('BAE vatandaşlık yok çapasını taşır', () => {
    expect(PLAN_SYSTEM).toMatch(/BAE'de yatırımla VATANDAŞLIK YOK/);
  });

  it('getiri garantisi vermeyi yasaklar', () => {
    expect(PLAN_SYSTEM).toMatch(/Getiri garantisi verme/);
  });

  it('abartı kelimeleri yasaklar', () => {
    expect(PLAN_SYSTEM).toMatch(/kaçırmayın/);
  });

  it('hizmet pazarlarını sayar ve dışını post konusu yapmayı yasaklar', () => {
    expect(PLAN_SYSTEM).toMatch(/Türkiye, BAE\s*\n?\s*\(Dubai\), İspanya ve İngiltere/);
    expect(PLAN_SYSTEM).toMatch(/Almanya, Hollanda, Tayland/);
    expect(PLAN_SYSTEM).toMatch(/hizmet pazarımız değil/);
  });
});

describe('calendarRows', () => {
  const item = (over: Partial<Parameters<typeof calendarRows>[0][0]> = {}) => ({
    scheduledDate: '2026-07-27', dayName: 'Pazartesi', kind: 'post' as const,
    title: 'Konu', marketCode: 'TR', forLinkedin: true, forMeta: true,
    status: 'ready', slideCount: 0, driveFileLink: null, ...over,
  });

  it('başlık satırıyla başlar', () => {
    const r = calendarRows([]);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual([
      'Tarih', 'Gün', 'Tür', 'Konu', 'Pazar', 'LinkedIn', 'Meta', 'Slayt', 'Durum', 'Dosya',
    ]);
  });

  it('kalemi satıra çevirir', () => {
    const [, row] = calendarRows([item({ driveFileLink: 'https://drive/x' })]);
    expect(row).toEqual([
      '2026-07-27', 'Pazartesi', 'Post', 'Konu', 'TR', 'evet', 'evet', '', 'Hazır', 'https://drive/x',
    ]);
  });

  it('karuselde slayt sayısını yazar, postta boş bırakır', () => {
    const rows = calendarRows([
      item({ kind: 'carousel', slideCount: 5, forLinkedin: false }),
      item({ scheduledDate: '2026-07-28' }),
    ]);
    expect(rows[1][7]).toBe('5');
    expect(rows[2][7]).toBe('');
  });

  it('tarihe göre sıralar — haftalar karışık gelse bile', () => {
    const rows = calendarRows([
      item({ scheduledDate: '2026-08-03' }),
      item({ scheduledDate: '2026-07-27' }),
      item({ scheduledDate: '2026-07-30' }),
    ]);
    expect(rows.slice(1).map((r) => r[0]))
      .toEqual(['2026-07-27', '2026-07-30', '2026-08-03']);
  });

  it('girdi dizisini bozmaz (sıralama kopya üzerinde)', () => {
    const input = [item({ scheduledDate: '2026-08-03' }), item({ scheduledDate: '2026-07-27' })];
    calendarRows(input);
    expect(input[0].scheduledDate).toBe('2026-08-03');
  });

  it('durumları Türkçeleştirir', () => {
    const rows = calendarRows([
      item({ status: 'published' }), item({ status: 'skipped' }),
    ]);
    expect(rows[1][8]).toBe('Paylaşıldı');
    expect(rows[2][8]).toBe('Atlandı');
  });

  it('pazar/LinkedIn boşsa boş hücre bırakır (uydurmaz)', () => {
    const [, row] = calendarRows([item({ marketCode: null, forLinkedin: false })]);
    expect(row[4]).toBe('');
    expect(row[5]).toBe('');
  });
});

describe('postToTextFile', () => {
  const file = postToTextFile(
    {
      title: 'Türkiye vatandaşlık eşiği',
      hook: 'Eşik 400.000 USD seviyesinde kaldı.',
      body: 'Detay metin burada.',
      hashtags: ['gayrimenkul', '#yatirim'],
      marketCode: 'TR',
      sourceSection: 'Türkiye — Mevzuat',
    },
    { dayName: 'Pazartesi', date: '2026-07-27' },
  );

  it('gün ve tarih başta', () => {
    expect(file.split('\n')[0]).toBe('Pazartesi · 2026-07-27');
  });

  it('kopyalanacak bölümü net işaretler', () => {
    expect(file).toMatch(/KOPYALANACAK METİN/);
  });

  it('kanca ve gövde metnini içerir', () => {
    expect(file).toContain('Eşik 400.000 USD seviyesinde kaldı.');
    expect(file).toContain('Detay metin burada.');
  });

  it('etiketleri tek # ile yazar (çift # üretmez)', () => {
    expect(file).toContain('#gayrimenkul #yatirim');
    expect(file).not.toContain('##');
  });

  it('kaynak bölümü izlenebilirlik için altta', () => {
    expect(file).toMatch(/Kaynak bölüm: Türkiye — Mevzuat/);
  });

  it('pazar yoksa "genel" yazar', () => {
    const f = postToTextFile(
      { title: 't', hook: 'h', body: 'b', hashtags: [], marketCode: null, sourceSection: 's' },
      { dayName: 'Salı', date: '2026-07-28' },
    );
    expect(f).toContain('Pazar: genel');
  });
});

describe('weekOverview', () => {
  const slots = distributeWeek('2026-07-27', 4, 3);
  const md = weekOverview(
    '2026-07-27 — 2026-08-02', 'Haftalık İstihbarat 24 Temmuz', slots,
    ['Post A', 'Post B', 'Post C', 'Post D'],
    ['Karusel A', 'Karusel B', 'Karusel C'],
    [{ topic: 'Kıbrıs iddiası', reason: 'rapor bunu spekülatif olarak etiketlemiş' }],
  );

  it('hafta etiketini başlıkta gösterir', () => {
    expect(md).toContain('# Yayın Akışı — 2026-07-27 — 2026-08-02');
  });

  it('kaynak raporu belirtir', () => {
    expect(md).toContain('Haftalık İstihbarat 24 Temmuz');
  });

  it('7 satırlık tablo üretir', () => {
    const rows = md.split('\n').filter((l) => l.startsWith('| ') && !l.includes('---'));
    expect(rows).toHaveLength(8); // başlık + 7 gün
  });

  it('başlıkları doğru kaleme eşler', () => {
    expect(md).toMatch(/\| Pazartesi \| 2026-07-27 \| Post \| Post A \| evet \| evet \|/);
    expect(md).toMatch(/\| Çarşamba \| 2026-07-29 \| Karusel \| Karusel A \| — \| evet \|/);
  });

  it('elle paylaşım notunu taşır — otomasyon iddiası etmez', () => {
    expect(md).toMatch(/kendiniz paylaşın/);
    expect(md).toMatch(/otomasyon kullanılmıyor/);
  });

  it('atlananları nedeniyle listeler', () => {
    expect(md).toContain('Kıbrıs iddiası');
    expect(md).toContain('spekülatif');
  });

  it('atlanan yoksa o bölümü hiç yazmaz', () => {
    const clean = weekOverview('h', 'r', slots, [], [], []);
    expect(clean).not.toContain('Bu hafta kullanılmayanlar');
  });
});
