// =====================================================================
// PREI | ContractResponse — contracts tablosu sözleşmesi (dış yüzey).
// property→proje adı + geliştirici join; status enum→görsel etiket ('Expiring'
// türetilir). Komisyon/legalEntity/paymentTerms metadata jsonb'dan;
// documents ise documents_vault'tan (related_type='contract') — gerçek
// dosyalar, indirilebilir signed URL ile.
// Frontend ContractDTO ile senkron (alan adları mock'la korundu).
// =====================================================================
import type { ContractRow, ContractDocRow } from '../contracts.repository';

export interface ContractDocRef { id: string; name: string; size: string }

export interface ContractResponse {
  id: string;
  developer: string;
  project: string;
  status: string; // Draft | Active | Expiring | Expired | Terminated | Renewed
  contractType: string;
  startDate: string | null;
  expiryDate: string | null;
  commission: string;
  legalEntity: string;
  paymentTerms: string;
  amount: number | null;
  currency: string;
  // Düzenleme formunun proje/müşteri seçicilerini ön-doldurabilmesi için ham FK'ler.
  propertyId: string | null;
  contactId: string | null;
  documents: ContractDocRef[];
}

const EXPIRING_WINDOW_DAYS = 60;

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// active + bitişe <=60 gün → 'Expiring' (contract_renewal_alerts view'ıyla aynı ruh).
function displayStatus(status: string, endDate: string | null): string {
  if (status === 'active' && endDate) {
    const days = (new Date(endDate).getTime() - Date.now()) / 86_400_000;
    if (days >= 0 && days <= EXPIRING_WINDOW_DAYS) return 'Expiring';
  }
  return cap(status);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function toContractResponse(row: ContractRow, docs: ContractDocRow[] = []): ContractResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    developer: row.developer_name ?? str(m.developer) ?? '—',
    project: row.project_title ?? str(m.project) ?? '—',
    status: displayStatus(row.status, row.end_date),
    contractType: row.contract_type,
    startDate: row.start_date ?? null,
    expiryDate: row.end_date ?? null,
    commission: str(m.commission),
    legalEntity: str(m.legal_entity),
    paymentTerms: str(m.payment_terms),
    amount: num(row.amount),
    currency: row.currency,
    propertyId: row.property_id ?? null,
    contactId: row.contact_id ?? null,
    documents: docs.map((d) => ({ id: d.id, name: d.name, size: formatSize(Number(d.size_bytes)) })),
  };
}
