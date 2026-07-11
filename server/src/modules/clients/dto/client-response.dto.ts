// =====================================================================
// PREI | ClientResponse — müşteri dizini sözleşmesi (contacts + aggregate).
// Frontend ClientDTO ile senkron (alan adları korundu). Müşteriye özgü alanlar
// metadata'dan varsayılanla; yatırım aggregate'leri deals'ten (yoksa 0).
// =====================================================================
import type { ClientRow } from '../clients.repository';

export interface ClientResponse {
  id: string;
  clientId: string;
  name: string;
  type: string;              // Individual | Corporate | VIP
  nationality: string;
  email: string;
  phone: string;
  totalInvestment: number;   // EUR
  activeProperties: number;
  preferredRegions: string[];
  investmentProfile: string; // Conservative | Balanced | Aggressive
  source: string;
  relationshipStatus: string; // Active | Dormant | Churned
  assignedConsultant: string;
  lastContactDate: string;
  unitTypes?: string[];
  purpose?: string;
  budgetRange?: string;
  requirements?: string;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v ? v : fallback;
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function toClientResponse(row: ClientRow): ClientResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    clientId: str(m.client_code, `CL-${row.id.slice(0, 8).toUpperCase()}`),
    name: name || '—',
    type: str(m.client_type, 'Individual'),
    nationality: str(m.nationality, '—'),
    email: row.email ?? '—',
    phone: row.phone ?? '—',
    totalInvestment: Math.round(Number(row.total_investment_eur ?? 0)),
    activeProperties: row.active_properties,
    preferredRegions: arr(m.preferred_regions),
    investmentProfile: str(m.investment_profile, 'Balanced'),
    source: str(m.source, '—'),
    relationshipStatus: str(m.relationship_status, 'Active'),
    assignedConsultant: row.consultant ?? str(m.assigned_consultant, '—'),
    lastContactDate: row.last_contact ?? row.updated_at,
    ...(Array.isArray(m.unit_types) ? { unitTypes: arr(m.unit_types) } : {}),
    ...(typeof m.purpose === 'string' && m.purpose ? { purpose: m.purpose } : {}),
    ...(typeof m.budget_range === 'string' && m.budget_range ? { budgetRange: m.budget_range } : {}),
    ...(typeof m.requirements === 'string' && m.requirements ? { requirements: m.requirements } : {}),
  };
}
