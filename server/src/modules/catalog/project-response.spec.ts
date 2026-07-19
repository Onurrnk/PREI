// =====================================================================
// toProjectResponse — properties satırı → dış sözleşme.
// metadata parse (görsel/olanak/ödeme planı), vault dokümanları eşleme,
// lokasyon join, güvenli fallback.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { toProjectResponse } from './dto/project-response.dto';
import type { ProjectRow, ProjectDocRow } from './catalog.repository';

const row = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  id: 'pr1', developer_id: 'd1', developer_name: 'Emaar', title: 'Beachfront',
  city: 'Dubai', district: 'Marina', country: 'BAE', price: '1240000', currency: 'EUR',
  description: 'Açıklama', metadata: null, updated_at: '2026-06-15',
  ...over,
});

describe('toProjectResponse', () => {
  it('temel alanlar + lokasyon join + status varsayılanı', () => {
    const r = toProjectResponse(row());
    expect(r.name).toBe('Beachfront');
    expect(r.developerName).toBe('Emaar');
    expect(r.location).toBe('Marina, Dubai');
    expect(r.startingPrice).toBe(1240000);
    expect(r.status).toBe('Off-plan'); // metadata yoksa varsayılan
    expect(r.lifecycleStatus).toBe('active'); // metadata yoksa varsayılan
  });

  it('lifecycle_status metadata\'dan okunur', () => {
    expect(toProjectResponse(row({ metadata: { lifecycle_status: 'sold' } })).lifecycleStatus).toBe('sold');
    expect(toProjectResponse(row({ metadata: { lifecycle_status: 'paused' } })).lifecycleStatus).toBe('paused');
  });

  it('metadata görsel/olanak/ödeme planı/status\'u türetir', () => {
    const r = toProjectResponse(row({
      metadata: {
        project_status: 'Completed', total_units: 120, available_units: 8,
        images: ['a.jpg', 'b.jpg'], amenities: ['Havuz', 'Spor Salonu'],
        payment_plan: [{ milestone: 'Peşinat', percentage: 20, date: 'Q1' }],
      },
    }));
    expect(r.status).toBe('Completed');
    expect(r.totalUnits).toBe(120);
    expect(r.availableUnits).toBe(8);
    expect(r.images).toEqual(['a.jpg', 'b.jpg']);
    expect(r.amenities).toEqual(['Havuz', 'Spor Salonu']);
    expect(r.paymentPlan).toHaveLength(1);
  });

  it('vault dokümanlarını tür + boyutla eşler', () => {
    const docs: ProjectDocRow[] = [
      { id: 'doc1', name: 'Brosur.pdf', mime_type: 'application/pdf', size_bytes: '2516582', related_id: 'pr1' },
      { id: 'doc2', name: 'Sunum.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size_bytes: '51200', related_id: 'pr1' },
    ];
    const r = toProjectResponse(row(), docs);
    expect(r.documents).toEqual([
      { id: 'doc1', title: 'Brosur.pdf', type: 'PDF', size: '2.4 MB' },
      { id: 'doc2', title: 'Sunum.xlsx', type: 'Spreadsheet', size: '50 KB' },
    ]);
  });

  it('doküman yoksa documents boş dizi', () => {
    const r = toProjectResponse(row());
    expect(r.documents).toEqual([]);
  });

  it('developer_name yoksa — kullanır, lokasyon country\'ye düşer', () => {
    const r = toProjectResponse(row({ developer_name: null, city: null, district: null }));
    expect(r.developerName).toBe('—');
    expect(r.location).toBe('BAE');
  });
});
