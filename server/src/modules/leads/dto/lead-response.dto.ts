// =====================================================================
// PREI | LeadResponse — API sözleşmesi (dış yüzey).
// DB satırı (snake_case, numeric→string) → istemci sözleşmesi (camelCase).
// Frontend'in elle-senkron LeadDTO'su bu şekle karşılık gelir (OV-8).
// Presentation alanları (contactName/company) join'den gelir; DB kolon
// adlarından bağımsız kararlı bir kontrat sağlar.
// =====================================================================
import type { LeadJoinedRow } from '../leads.repository';

export interface LeadResponse {
  id: string;
  contactId: string;
  contactName: string;
  company: string | null;
  status: string;
  priority: string;
  interestType: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  targetMarketCode: string | null;
  score: number | null;
  ownerId: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** pg numeric alanları string döner — sayıya çevir; NULL'ları koru. */
function num(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fullName(first: string, last: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

export function toLeadResponse(row: LeadJoinedRow): LeadResponse {
  return {
    id: row.id,
    contactId: row.contact_id,
    contactName: fullName(row.contact_first_name, row.contact_last_name),
    company: row.company ?? null,
    status: row.status,
    priority: row.priority,
    interestType: row.interest_type,
    budgetMin: num(row.budget_min),
    budgetMax: num(row.budget_max),
    currency: row.currency,
    targetMarketCode: row.target_market_code ?? null,
    score: row.score,
    ownerId: row.owner_id ?? null,
    notes: row.notes ?? null,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
