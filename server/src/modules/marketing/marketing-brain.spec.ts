// =====================================================================
// Pazarlama analiz motoru — prompt kurulumu + çıktı şeması.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { buildAnalysisPrompt, PROPOSAL_SCHEMA, MARKETING_SYSTEM, type MarketingSnapshot } from './marketing-brain';

const empty: MarketingSnapshot = {
  accounts: [], audience: [], posts: [], spend: [], leadsByMarket: [],
};

describe('buildAnalysisPrompt', () => {
  it('veri yokluğunu SAKLAMAZ — modele açıkça söyler', () => {
    const p = buildAnalysisPrompt(empty);
    expect(p).toContain('hiç paylaşım yok');
    expect(p).toContain('hiç reklam harcaması yok');
    expect(p).toContain('(kayıt yok)');
  });

  it('hesap metriklerini sayılarıyla yazar', () => {
    const p = buildAnalysisPrompt({
      ...empty,
      accounts: [{
        platform: 'instagram', followers: 143, reach30d: 1200,
        impressions30d: 3400, accountsEngaged30d: 88, websiteClicks30d: 12,
      }],
    });
    expect(p).toContain('instagram: 143 takipçi');
    expect(p).toContain('erişim 1200');
    expect(p).toContain('site tıklaması 12');
  });

  it('kitle kırılımını boyuta göre gruplar ve büyükten sıralar', () => {
    const p = buildAnalysisPrompt({
      ...empty,
      audience: [
        { dimension: 'country', bucket: 'TR', value: 116 },
        { dimension: 'country', bucket: 'DE', value: 6 },
        { dimension: 'age', bucket: '35-44', value: 81 },
      ],
    });
    expect(p).toContain('country: TR=116, DE=6');
    expect(p).toContain('age: 35-44=81');
  });

  it('kitle listesini ilk 8 ile sınırlar (prompt şişmesin)', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      dimension: 'city', bucket: `Sehir${i}`, value: 100 - i,
    }));
    const p = buildAnalysisPrompt({ ...empty, audience: many });
    expect(p).toContain('Sehir0=100');
    expect(p).not.toContain('Sehir9=');
  });

  it('paylaşım ve harcama satırlarını metriğiyle yazar', () => {
    const p = buildAnalysisPrompt({
      ...empty,
      posts: [{ title: 'Dubai yatırım', postedAt: '2026-07-01', reach: 900, engagements: 45, leads: 3 }],
      spend: [{ name: 'TR Kampanya', marketCode: 'TR', spend: 1500, currency: 'TRY', impressions: 20000, clicks: 300 }],
    });
    expect(p).toContain('"Dubai yatırım" → erişim 900, etkileşim 45, lead 3');
    expect(p).toContain('"TR Kampanya" [TR]: 1500 TRY');
  });

  it('pazarı belirsiz kampanyayı işaretler', () => {
    const p = buildAnalysisPrompt({
      ...empty,
      spend: [{ name: 'X', marketCode: null, spend: 10, currency: 'TRY', impressions: 1, clicks: 0 }],
    });
    expect(p).toContain('[pazar belirsiz]');
  });
});

describe('PROPOSAL_SCHEMA', () => {
  it('dört üst bölümü zorunlu kılar', () => {
    expect(PROPOSAL_SCHEMA.required).toEqual(['findings', 'contentPlan', 'proposals', 'warnings']);
  });

  it('uydurma alanı engeller (additionalProperties: false)', () => {
    expect(PROPOSAL_SCHEMA.additionalProperties).toBe(false);
    expect(PROPOSAL_SCHEMA.properties.proposals.items.additionalProperties).toBe(false);
  });

  it('pazar kodunu ProDuality pazarlarıyla sınırlar', () => {
    expect(PROPOSAL_SCHEMA.properties.proposals.items.properties.marketCode.enum)
      .toEqual(['TR', 'AE', 'ES', 'GB', null]);
  });

  it('her önerinin gerekçe ve bütçe alanını zorunlu kılar', () => {
    const req = PROPOSAL_SCHEMA.properties.proposals.items.required;
    expect(req).toContain('rationale');
    expect(req).toContain('suggestedDailyBudget');
    expect(req).toContain('marketCode');
  });

  it('hedefi geçerli Meta amaçlarıyla sınırlar', () => {
    expect(PROPOSAL_SCHEMA.properties.proposals.items.properties.objective.enum)
      .toContain('OUTCOME_LEADS');
  });
});

describe('MARKETING_SYSTEM', () => {
  it('onay kuralını ve harcama yasağını açıkça söyler', () => {
    expect(MARKETING_SYSTEM).toContain('Onur Bey onaylayacak');
    expect(MARKETING_SYSTEM).toContain('otomatik harcanmayacak');
  });

  it('uydurmayı yasaklar ve veri azlığını bildirmeyi zorunlu kılar', () => {
    expect(MARKETING_SYSTEM).toContain('VARMIŞ GİBİ konuşma');
    expect(MARKETING_SYSTEM).toContain('warnings');
  });

  it('vatandaşlık/oturum çapalarını içerir (yanlış bilgi vermesin)', () => {
    expect(MARKETING_SYSTEM).toContain('Golden Visa');
    expect(MARKETING_SYSTEM).toContain('400.000 USD');
  });

  it('getiri garantisini yasaklar', () => {
    expect(MARKETING_SYSTEM).toContain('Getiri garantisi verme');
  });
});
