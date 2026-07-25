// =====================================================================
// Görüşme brifingi — profil boşlukları, bütçe biçimi, konuşma özeti,
// prompt kurulumu ve çıktı şeması.
// =====================================================================
import { describe, it, expect } from 'vitest';
import {
  profileGaps, formatBudget, transcriptDigest, buildBriefPrompt,
  BRIEF_SCHEMA, BRIEF_SYSTEM, type LeadDossier, type DossierMessage,
} from './meeting-brief';

const base: LeadDossier = {
  leadId: 'l1', contactId: 'c1', name: 'Kudret Kalyoncuoğlu',
  email: 'k@example.com', phone: '+905551112233', preferredLang: 'tr',
  status: 'contacted', meetingAt: null, meetingTitle: null,
  profile: {
    marketCode: null, city: null, district: null, propertyType: null, rooms: null,
    budgetMin: null, budgetMax: null, currency: null, timeline: null,
    investmentPurpose: null, interestType: null,
  },
  extractedCriteria: null, notes: null,
  scoreHistory: [], messages: [], proposals: [], pastMeetings: [], flags: [],
};

describe('profileGaps', () => {
  it('boş profilde tüm eksikleri soru olarak çıkarır', () => {
    const g = profileGaps(base);
    expect(g.map((x) => x.field)).toEqual([
      'marketCode', 'city', 'budget', 'investmentPurpose', 'timeline', 'propertyType',
    ]);
    expect(g[0].question).toContain('Türkiye');
  });

  it('Eylül kriterlerden doldurduysa o alanı eksik SAYMAZ', () => {
    // Canlı durum: target_market_code boş ama metadata.criteria.market dolu
    const g = profileGaps({
      ...base,
      extractedCriteria: { market: 'Türkiye', city: 'İstanbul', purpose: 'Karma' },
    });
    const fields = g.map((x) => x.field);
    expect(fields).not.toContain('marketCode');
    expect(fields).not.toContain('city');
    expect(fields).not.toContain('investmentPurpose');
    expect(fields).toContain('budget');
  });

  it('CRM kolonu doluysa eksik saymaz', () => {
    const g = profileGaps({
      ...base,
      profile: { ...base.profile, marketCode: 'TR', budgetMin: 250000, currency: 'USD', timeline: '3_months' },
    });
    const fields = g.map((x) => x.field);
    expect(fields).not.toContain('marketCode');
    expect(fields).not.toContain('budget');
    expect(fields).not.toContain('timeline');
  });

  it('yalnız budget_max varsa bütçeyi eksik saymaz', () => {
    const g = profileGaps({ ...base, profile: { ...base.profile, budgetMax: 500000 } });
    expect(g.map((x) => x.field)).not.toContain('budget');
  });
});

describe('formatBudget', () => {
  it('aralığı okunabilir yazar', () => {
    expect(formatBudget(250000, 400000, 'USD')).toBe('250.000 – 400.000 USD');
  });
  it('alt ve üst aynıysa tek değer yazar', () => {
    expect(formatBudget(250000, 250000, 'USD')).toBe('250.000 USD');
  });
  it('tek taraflı aralıkları işaretler', () => {
    expect(formatBudget(250000, null, 'EUR')).toBe('250.000 EUR+');
    expect(formatBudget(null, 500000, 'EUR')).toBe('en fazla 500.000 EUR');
  });
  it('veri yoksa uydurmaz', () => {
    expect(formatBudget(null, null, null)).toBe('belirtilmemiş');
  });
});

describe('transcriptDigest', () => {
  const msg = (dir: 'inbound' | 'outbound', body: string, i = 0): DossierMessage => ({
    direction: dir, channel: 'whatsapp', body,
    sentAt: `2026-07-${String(10 + i).padStart(2, '0')}T12:00:00Z`,
  });

  it('müşteri ve Eylül mesajlarını etiketleyip sayar', () => {
    const d = transcriptDigest([msg('inbound', 'Dubai istiyorum'), msg('outbound', 'Elbette', 1)]);
    expect(d.text).toContain('MÜŞTERİ: Dubai istiyorum');
    expect(d.text).toContain('EYLÜL: Elbette');
    expect(d.inbound).toBe(1);
    expect(d.outbound).toBe(1);
    expect(d.truncated).toBe(false);
  });

  it('müşteri mesajını Eylül mesajından DAHA AZ kırpar (asıl veri müşteride)', () => {
    const long = 'a'.repeat(1000);
    const d = transcriptDigest([msg('inbound', long), msg('outbound', long, 1)]);
    const lines = d.text.split('\n');
    const inLine = lines.find((l) => l.includes('MÜŞTERİ'))!;
    const outLine = lines.find((l) => l.includes('EYLÜL'))!;
    expect(inLine.length).toBeGreaterThan(outLine.length);
  });

  it('uzun sohbette baş ve sonu korur, ortayı atlar', () => {
    const many = Array.from({ length: 200 }, (_, i) => msg('inbound', `mesaj ${i} ${'x'.repeat(200)}`, i % 20));
    const d = transcriptDigest(many, 3000);
    expect(d.truncated).toBe(true);
    expect(d.text).toContain('mesaj atlandı');
    expect(d.text).toContain('mesaj 0');
    expect(d.text).toContain('mesaj 199');
  });

  it('boş konuşmada çökmez', () => {
    const d = transcriptDigest([]);
    expect(d.text).toBe('');
    expect(d.inbound).toBe(0);
  });

  it('satır sonlarını temizler (prompt bozulmasın)', () => {
    const d = transcriptDigest([msg('inbound', 'satir1\n\nsatir2   satir3')]);
    expect(d.text).toContain('satir1 satir2 satir3');
  });
});

describe('buildBriefPrompt', () => {
  it('boş alanları GİZLEMEZ — "(boş)" olarak gösterir', () => {
    const p = buildBriefPrompt(base);
    expect(p).toContain('Pazar: (boş)');
    expect(p).toContain('Bütçe: belirtilmemiş');
  });

  it('eksikleri açıkça openQuestions için listeler', () => {
    const p = buildBriefPrompt(base);
    expect(p).toContain('CRM\'DE EKSİK OLANLAR');
    expect(p).toContain('Hangi ülkeyi düşünüyor?');
  });

  it('randevuyu üste taşır', () => {
    const p = buildBriefPrompt({ ...base, meetingAt: '2026-07-28T14:00:00Z', meetingTitle: 'Tanışma' });
    expect(p).toContain('RANDEVU: 2026-07-28 14:00 — Tanışma');
  });

  it('Eylül kriterlerini ayrı bölümde verir', () => {
    const p = buildBriefPrompt({
      ...base,
      extractedCriteria: { city: 'İstanbul', district: 'Nişantaşı', special_requests: 'Prestijli' },
    });
    expect(p).toContain('EYLÜL\'ÜN SOHBETTEN ÇIKARDIĞI KRİTERLER');
    expect(p).toContain('district: Nişantaşı');
  });

  it('skor geçmişini gerekçe ve sinyallerle yazar', () => {
    const p = buildBriefPrompt({
      ...base,
      scoreHistory: [{
        score: 75, reasoning: 'Bütçe net, zaman ufku kısa',
        signals: { budget_clarity: 'high', urgency: 'medium' },
        source: 'n8n_ai', createdAt: '2026-07-20T10:00:00Z',
      }],
    });
    expect(p).toContain('75/100 (n8n_ai) — Bütçe net');
    expect(p).toContain('budget_clarity=high');
  });

  it('bayrakları ve teklifleri dahil eder', () => {
    const p = buildBriefPrompt({
      ...base,
      flags: ['Son mesajdan 30 gün geçmiş — sohbet soğumuş.'],
      proposals: [{ title: 'Dubai Marina', status: 'sent', totalValue: 450000, currency: 'USD', sentAt: '2026-07-01T00:00:00Z' }],
    });
    expect(p).toContain('sohbet soğumuş');
    expect(p).toContain('"Dubai Marina" · sent · 450.000 USD');
  });

  it('mesaj yoksa dürüstçe söyler', () => {
    expect(buildBriefPrompt(base)).toContain('(hiç mesaj yok)');
  });
});

describe('BRIEF_SCHEMA', () => {
  it('danışmanın ihtiyacı olan tüm bölümleri zorunlu kılar', () => {
    for (const k of ['headline', 'whoIsThis', 'topicsDiscussed', 'profileSummary',
                     'expectations', 'buyingSignals', 'riskSignals', 'openQuestions',
                     'suggestedAgenda', 'sensitivities', 'scoreRationale']) {
      expect(BRIEF_SCHEMA.required).toContain(k);
    }
  });

  it('uydurma alanı engeller', () => {
    expect(BRIEF_SCHEMA.additionalProperties).toBe(false);
    expect(BRIEF_SCHEMA.properties.profileSummary.additionalProperties).toBe(false);
    expect(BRIEF_SCHEMA.properties.topicsDiscussed.items.additionalProperties).toBe(false);
  });

  it('profil özetinde bölge ve pazar ayrı alanlar (kullanıcı ikisini de istedi)', () => {
    const ps = BRIEF_SCHEMA.properties.profileSummary.properties;
    expect(ps.markets.type).toBe('array');
    expect(ps.regions.type).toBe('array');
  });

  it('her konunun DETAYINI zorunlu kılar (yüzeysel liste olmasın)', () => {
    expect(BRIEF_SCHEMA.properties.topicsDiscussed.items.required).toEqual(['topic', 'detail']);
  });
});

describe('BRIEF_SYSTEM', () => {
  it('bilinmeyeni saklamayı yasaklar', () => {
    expect(BRIEF_SYSTEM).toContain('BİLİNMEYENİ SAKLAMA');
    expect(BRIEF_SYSTEM).toContain('openQuestions');
  });
  it('somut olmayı ve alıntı kullanmayı zorunlu kılar', () => {
    expect(BRIEF_SYSTEM).toContain('SOMUT ol');
    expect(BRIEF_SYSTEM).toContain('ALINTI');
  });
  it('vatandaşlık/oturum çapalarını içerir', () => {
    expect(BRIEF_SYSTEM).toContain('Golden Visa');
    expect(BRIEF_SYSTEM).toContain('400.000 USD');
  });
  it('az veri durumunu dürüstçe bildirmeyi ister', () => {
    expect(BRIEF_SYSTEM).toContain('çok kısaysa');
  });
});
