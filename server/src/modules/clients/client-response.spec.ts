// =====================================================================
// toClientResponse — yatırım profili birleştirme: manuel (Edit Profile)
// öncelikli, boşsa Eylül'ün lead çıkarımı; welcome/skor bayrakları.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { toClientResponse } from './dto/client-response.dto';
import type { ClientRow } from './clients.repository';

const row = (over: Partial<ClientRow> = {}): ClientRow => ({
  id: 'c1', first_name: 'Duygu', last_name: 'Karataş',
  email: null, phone: '+905550000000', metadata: {},
  updated_at: '2026-07-18T10:00:00Z', total_investment_eur: null,
  active_properties: 0, consultant: null, last_contact: null,
  lead_budget_min: null, lead_budget_max: null, lead_currency: null,
  lead_criteria: null, lead_score: null,
  ...over,
});

describe('toClientResponse — Eylül profili fallback', () => {
  it('manuel metadata boşsa lead çıkarımı kullanılır (tip/amaç/bölge/bütçe) ve kaynak eylul olur', () => {
    const r = toClientResponse(row({
      lead_budget_min: '2500000', lead_budget_max: '3200000', lead_currency: 'AED',
      lead_criteria: { unit_type: '3+1', purpose: 'kira getirisi', market: 'BAE', city: 'Dubai', district: 'Marina', special_requests: 'deniz manzarası', timeline: '3-4 ay' },
      lead_score: 74,
    }));
    expect(r.unitTypes).toEqual(['3+1']);
    expect(r.purpose).toBe('kira getirisi');
    expect(r.budgetRange).toBe('2.500.000 – 3.200.000 AED');
    expect(r.preferredRegions).toEqual(['BAE', 'Dubai', 'Marina']);
    expect(r.requirements).toBe('deniz manzarası · Zaman ufku: 3-4 ay');
    expect(r.aiScore).toBe(74);
    expect(r.profileSource).toBe('eylul');
  });

  it('manuel giriş varsa Eylül çıkarımını EZMEZ (manuel öncelikli, kaynak manual)', () => {
    const r = toClientResponse(row({
      metadata: { unit_types: ['Villa'], budget_range: '5M USD', preferred_regions: ['İspanya'] },
      lead_criteria: { unit_type: '1+1', market: 'Türkiye' },
      lead_budget_min: '100', lead_budget_max: '200', lead_currency: 'EUR',
    }));
    expect(r.unitTypes).toEqual(['Villa']);
    expect(r.budgetRange).toBe('5M USD');
    expect(r.preferredRegions).toEqual(['İspanya']);
    expect(r.profileSource).toBe('manual');
  });

  it('tek bütçe rakamı tek değer olarak biçimlenir', () => {
    const r = toClientResponse(row({
      lead_budget_min: '1500000', lead_budget_max: '1500000', lead_currency: 'USD',
    }));
    expect(r.budgetRange).toBe('1.500.000 USD');
  });

  it('bayraklar: e-posta yoksa —, welcome gönderilmemişse null; gönderilmişse tarih', () => {
    const yok = toClientResponse(row());
    expect(yok.email).toBe('—');
    expect(yok.welcomeEmailSentAt).toBeNull();
    expect(yok.profileSource).toBeNull();

    const var_ = toClientResponse(row({
      email: 'd@example.com',
      metadata: { welcome_email_sent_at: '2026-07-15T09:00:00Z' },
    }));
    expect(var_.email).toBe('d@example.com');
    expect(var_.welcomeEmailSentAt).toBe('2026-07-15T09:00:00Z');
  });
});
