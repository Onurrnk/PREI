// =====================================================================
// toContractResponse — contracts satırı → dış sözleşme.
// 'Expiring' türetimi (active + bitişe ≤60 gün), metadata parse, vault
// dokümanları, güvenli fallback.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { toContractResponse } from './dto/contract-response.dto';
import type { ContractRow, ContractDocRow } from './contracts.repository';

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const row = (over: Partial<ContractRow> = {}): ContractRow => ({
  id: 'c1', contract_type: 'agency', status: 'active',
  start_date: '2025-01-01', end_date: daysFromNow(200),
  amount: '500000', currency: 'AED',
  metadata: { commission: '5%', legal_entity: 'Emaar PJSC', payment_terms: '30 Gün' },
  developer_name: 'Emaar', project_title: 'Beachfront', updated_at: '2026-06-15',
  ...over,
});

describe('toContractResponse — displayStatus', () => {
  it('active + bitişe ≤60 gün → Expiring', () => {
    expect(toContractResponse(row({ status: 'active', end_date: daysFromNow(30) })).status).toBe('Expiring');
  });

  it('active + bitişe >60 gün → Active', () => {
    expect(toContractResponse(row({ status: 'active', end_date: daysFromNow(200) })).status).toBe('Active');
  });

  it('active + bitiş geçmişte → Active (Expiring değil)', () => {
    expect(toContractResponse(row({ status: 'active', end_date: daysFromNow(-5) })).status).toBe('Active');
  });

  it('active olmayan status yalnız büyük harfe çevrilir (Expiring mantığı yok)', () => {
    expect(toContractResponse(row({ status: 'draft', end_date: daysFromNow(10) })).status).toBe('Draft');
    expect(toContractResponse(row({ status: 'terminated', end_date: null })).status).toBe('Terminated');
  });
});

describe('toContractResponse — alanlar', () => {
  it('metadata\'dan komisyon/legal/ödeme koşulunu çıkarır', () => {
    const r = toContractResponse(row());
    expect(r.developer).toBe('Emaar');
    expect(r.project).toBe('Beachfront');
    expect(r.commission).toBe('5%');
    expect(r.legalEntity).toBe('Emaar PJSC');
    expect(r.paymentTerms).toBe('30 Gün');
    expect(r.amount).toBe(500000);
  });

  it('vault dokümanlarını boyutla eşler', () => {
    const docs: ContractDocRow[] = [
      { id: 'd1', name: 'Sozlesme.pdf', size_bytes: '2516582', related_id: 'c1' },
    ];
    const r = toContractResponse(row(), docs);
    expect(r.documents).toEqual([{ id: 'd1', name: 'Sozlesme.pdf', size: '2.4 MB' }]);
  });

  it('doküman yoksa documents boş dizi; boş metadata güvenli', () => {
    const r = toContractResponse(row({ metadata: null }));
    expect(r.documents).toEqual([]);
    expect(r.commission).toBe('');
    expect(r.legalEntity).toBe('');
  });
});
