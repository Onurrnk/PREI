// =====================================================================
// toLeadResponse — yatırım hedeflerinin dış sözleşmeye taşınması (003g).
// Canlıda target_market_code hep boştu; gerçek bilgi investment_targets'ta.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { toLeadResponse } from './dto/lead-response.dto';
import type { LeadJoinedRow } from './leads.repository';

const row = (over: Partial<LeadJoinedRow> = {}): LeadJoinedRow => ({
  id: 'lead1', contact_id: 'c1', organization_id: null,
  contact_first_name: 'Onur', contact_last_name: 'Karataş', company: null,
  status: 'new', priority: 'medium', interest_type: 'buy',
  budget_min: null, budget_max: null, currency: 'EUR',
  target_market_code: null, score: null, owner_id: null, notes: null,
  version: 1, created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
  investment_targets: [],
  ...over,
} as LeadJoinedRow);

describe('toLeadResponse — yatırım hedefleri', () => {
  it('hedef yoksa boş dizi (undefined değil)', () => {
    expect(toLeadResponse(row()).investmentTargets).toEqual([]);
  });

  it('ülke kodunu Türkçe ada çevirir', () => {
    const r = toLeadResponse(row({
      investment_targets: [{ countryCode: 'ES', region: 'Barcelona', district: null }],
    }));
    expect(r.investmentTargets).toEqual([
      { countryCode: 'ES', countryName: 'İspanya', region: 'Barcelona', district: null },
    ]);
  });

  it('birden çok hedefi sırayla taşır', () => {
    const r = toLeadResponse(row({
      investment_targets: [
        { countryCode: 'AE', region: 'Dubai Marina', district: null },
        { countryCode: 'TR', region: 'İstanbul', district: 'Nişantaşı' },
      ],
    }));
    expect(r.investmentTargets.map((t) => t.countryName))
      .toEqual(['Birleşik Arap Emirlikleri', 'Türkiye']);
    expect(r.investmentTargets[1].district).toBe('Nişantaşı');
  });

  it('bilinmeyen ülke kodunda kodu olduğu gibi gösterir (kayıp yok)', () => {
    const r = toLeadResponse(row({
      investment_targets: [{ countryCode: 'ZZ', region: null, district: null }],
    }));
    expect(r.investmentTargets[0].countryName).toBe('ZZ');
  });

  it('investment_targets alanı hiç gelmezse çökmez', () => {
    const r = toLeadResponse(row({ investment_targets: undefined }));
    expect(r.investmentTargets).toEqual([]);
  });
});
