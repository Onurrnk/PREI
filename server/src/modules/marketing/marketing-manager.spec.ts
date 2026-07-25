// =====================================================================
// Pazarlama yöneticisi — aşama tespiti, prompt kurulumu, eylem şeması.
// =====================================================================
import { describe, it, expect } from 'vitest';
import {
  detectStage, buildManagerPrompt, MANAGER_SCHEMA, MANAGER_SYSTEM,
  type ManagerContext,
} from './marketing-manager';

const base: ManagerContext = {
  snapshot: { accounts: [], audience: [], posts: [], spend: [], leadsByMarket: [] },
  goals: [],
  previous: null,
  campaigns: [],
};

const post = { title: 'Dubai', postedAt: '2026-07-01', reach: 900, engagements: 45, leads: 3 };
const campaign = {
  name: 'TR Test', campaignRef: 'c1', marketCode: 'TR', spend: 1500,
  currency: 'TRY', impressions: 20000, clicks: 300, ctr: 1.5, cpc: 5,
};

describe('detectStage', () => {
  it('hiç içerik ve kampanya yoksa kuruluş aşaması', () => {
    expect(detectStage(base)).toBe('setup');
  });
  it('paylaşım varsa ama kampanya yoksa büyüme aşaması', () => {
    expect(detectStage({ ...base, snapshot: { ...base.snapshot, posts: [post] } })).toBe('growth');
  });
  it('aktif kampanya varsa optimizasyon aşaması (paylaşım olmasa bile)', () => {
    expect(detectStage({ ...base, campaigns: [campaign] })).toBe('optimization');
  });
});

describe('buildManagerPrompt', () => {
  it('ilk çalışmada geçmiş olmadığını açıkça söyler', () => {
    const p = buildManagerPrompt(base);
    expect(p).toContain('bu ilk çalışma');
  });

  it('hedef tanımlı değilse bunu uyarı olarak işaretlenmesini ister', () => {
    expect(buildManagerPrompt(base)).toContain('hedef tanımlanmamış');
  });

  it('hedefleri ilerleme yüzdesiyle yazar', () => {
    const p = buildManagerPrompt({
      ...base,
      goals: [{ metric: 'followers', target: 50, actual: 12, period: 'monthly', progressPct: 24 }],
    });
    expect(p).toContain('followers (monthly): hedef 50, gerçekleşen 12 → %24');
  });

  it('ölçülemeyen ilerlemeyi sıfır göstermez', () => {
    const p = buildManagerPrompt({
      ...base,
      goals: [{ metric: 'reach', target: 5000, actual: 0, period: 'monthly', progressPct: null }],
    });
    expect(p).toContain('ölçülemedi');
  });

  it('GEÇEN ÇALIŞMANIN önerilerinin akıbetini taşır (hafıza)', () => {
    const p = buildManagerPrompt({
      ...base,
      previous: {
        runAt: '2026-07-18 09:00', assessment: 'İçerik yokluğu ana darboğaz', stage: 'setup',
        outcomes: [
          { title: 'İstanbul test kampanyası', kind: 'new_campaign', status: 'approved', publishState: 'active' },
          { title: 'Reels: Golden Visa', kind: 'content', status: 'rejected', publishState: 'none' },
        ],
      },
    });
    expect(p).toContain('İçerik yokluğu ana darboğaz');
    expect(p).toContain('[new_campaign] "İstanbul test kampanyası" → approved (active)');
    expect(p).toContain('[content] "Reels: Golden Visa" → rejected');
  });

  it('kampanya verimini TO/TBM ile yazar; yoksa uydurmaz', () => {
    const p = buildManagerPrompt({
      ...base,
      campaigns: [campaign, { ...campaign, name: 'Yeni', impressions: 0, clicks: 0, ctr: null, cpc: null }],
    });
    expect(p).toContain('TO %1.50');
    expect(p).toContain('TBM 5.00 TRY');
    expect(p).toContain('TO yok');
    expect(p).toContain('TBM yok');
  });

  it('içerik yokluğunu darboğaz olarak görünür kılar', () => {
    expect(buildManagerPrompt(base)).toContain('içerik üretimi henüz başlamamış');
  });

  it('kitle kırılımını hedefleme temeli olarak sunar', () => {
    const p = buildManagerPrompt({
      ...base,
      snapshot: { ...base.snapshot, audience: [{ dimension: 'country', bucket: 'TR', value: 116 }] },
    });
    expect(p).toContain('KİTLE (hedeflemenin temeli)');
    expect(p).toContain('country: TR=116');
  });
});

describe('MANAGER_SCHEMA', () => {
  it('her eylemin gerekçe ve beklenen etkisini zorunlu kılar', () => {
    const req = MANAGER_SCHEMA.properties.actions.items.required;
    expect(req).toContain('rationale');
    expect(req).toContain('expectedImpact');
    expect(req).toContain('targeting');
  });

  it('eylem tiplerini sınırlar — içerik ve durdurma da eylemdir', () => {
    expect(MANAGER_SCHEMA.properties.actions.items.properties.kind.enum)
      .toEqual(['new_campaign', 'optimization', 'content', 'pause']);
  });

  it('uydurma alanı engeller', () => {
    expect(MANAGER_SCHEMA.additionalProperties).toBe(false);
    expect(MANAGER_SCHEMA.properties.actions.items.additionalProperties).toBe(false);
  });

  it('geçen çalışmanın gözden geçirilmesini zorunlu kılar', () => {
    expect(MANAGER_SCHEMA.required).toContain('previousReview');
  });
});

describe('MANAGER_SYSTEM', () => {
  it('içerik yokken reklam vermeyi açıkça yasaklar', () => {
    expect(MANAGER_SYSTEM).toContain('para yakmaktır');
  });
  it('onay kuralını tekrarlar', () => {
    expect(MANAGER_SYSTEM).toContain('Onur Bey\'in onayına gider');
  });
  it('hedeflemeyi kitle verisine bağlar', () => {
    expect(MANAGER_SYSTEM).toContain('körlemesine bütçe koyma');
  });
  it('az ve iyi öneri ister', () => {
    expect(MANAGER_SYSTEM).toContain('liste uzunluğu değer değildir');
  });
});
