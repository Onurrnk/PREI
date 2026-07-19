// =====================================================================
// toProposalResponse — proposals satırı → dış sözleşme.
// metadata parse (ödeme planı/ekler/kapak), lokasyon join, güvenli fallback.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { toProposalResponse } from './dto/proposal-response.dto';
import type { ProposalRow } from './proposals.repository';

const row = (over: Partial<ProposalRow> = {}): ProposalRow => ({
  id: 'p1', contact_id: 'c1', property_id: null, title: 'Teklif', status: 'sent',
  total_value: '2800000', currency: 'USD',
  view_count: 3, last_viewed_at: null, sent_at: null, created_at: '2026-06-15',
  metadata: null, contact_first_name: 'Ahmet', contact_last_name: 'Yılmaz',
  contact_email: 'ahmet@example.com',
  project_title: 'Marina', project_city: 'Dubai', project_district: 'Marina', project_country: 'BAE',
  ...over,
});

describe('toProposalResponse', () => {
  it('temel alanları ve status büyük harfini eşler', () => {
    const r = toProposalResponse(row());
    expect(r.clientName).toBe('Ahmet Yılmaz');
    expect(r.projectName).toBe('Marina');
    expect(r.status).toBe('Sent');
    expect(r.totalValue).toBe(2800000);
    expect(r.currency).toBe('USD');
    expect(r.projectLocation).toBe('Marina, Dubai, BAE');
  });

  it('geçerli metadata ödeme planını + ek bayraklarını + kapağı türetir', () => {
    const r = toProposalResponse(row({
      metadata: {
        paymentPlan: [{ milestone: 'Peşinat', percentage: 20, date: 'Rezervasyonda' }],
        includeBrochurePdf: true, includeFloorPlans: false,
        selectedPhotos: ['https://x/kapak.jpg', 'https://x/2.jpg'],
      },
    }));
    expect(r.paymentPlan).toEqual([{ milestone: 'Peşinat', percentage: 20, date: 'Rezervasyonda' }]);
    expect(r.includeBrochurePdf).toBe(true);
    expect(r.includeFloorPlans).toBe(false);
    expect(r.coverImage).toBe('https://x/kapak.jpg');
  });

  it('bozuk ödeme planı satırlarını (milestone/percentage yoksa) düşürür', () => {
    const r = toProposalResponse(row({
      metadata: {
        paymentPlan: [
          { milestone: 'Geçerli', percentage: 40, date: 'Q1' },
          { percentage: 20 },                       // milestone yok → düşer
          { milestone: 'Y', percentage: 'abc' },    // NaN → düşer
        ],
      },
    }));
    expect(r.paymentPlan).toEqual([{ milestone: 'Geçerli', percentage: 40, date: 'Q1' }]);
  });

  it('boş metadata\'da opsiyonel alanları hiç göndermez', () => {
    const r = toProposalResponse(row({ metadata: null }));
    expect(r.paymentPlan).toBeUndefined();
    expect(r.includeBrochurePdf).toBeUndefined();
    expect(r.coverImage).toBeUndefined();
  });

  it('kişi adı yoksa clientName için — kullanır', () => {
    const r = toProposalResponse(row({ contact_first_name: null, contact_last_name: null, metadata: null }));
    expect(r.clientName).toBe('—');
  });

  it('zengin metadata (liste/indirim, daire, roi raporu, not) dışa açılır', () => {
    const r = toProposalResponse(row({
      metadata: {
        listPrice: 3000000, discountPercent: 10, paymentPlanOnList: true,
        unit: { type: '2+1', area: 95, facade: 'Deniz', titleDeed: 'kat_mulkiyeti' },
        roi: { rentalType: 'longterm', monthlyRent: 8000 },
        roiReport: { netYieldPct: 5.1, annualTotalReturnPct: 10.1 },
        notes: 'VIP müşteri',
      },
    }));
    expect(r.listPrice).toBe(3000000);
    expect(r.discountPct).toBe(10);
    expect(r.paymentPlanOnList).toBe(true);
    expect(r.unit).toEqual({ type: '2+1', area: 95, facade: 'Deniz', titleDeed: 'kat_mulkiyeti' });
    expect((r.roi as { netYieldPct: number }).netYieldPct).toBe(5.1);
    expect(r.roiInputs).toBeDefined();
    expect(r.notes).toBe('VIP müşteri');
  });

  it('müşteri e-postasını dışa açar (send doğrulaması buna dayanır)', () => {
    expect(toProposalResponse(row()).clientEmail).toBe('ahmet@example.com');
    expect(toProposalResponse(row({ contact_email: null })).clientEmail).toBeNull();
  });
});
