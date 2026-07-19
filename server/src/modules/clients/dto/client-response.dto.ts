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
  /** Yapılandırılmış bütçe (form prefill) — metadata.budget_min/max/currency. */
  budgetMin?: number | null;
  budgetMax?: number | null;
  budgetCurrency?: string | null;
  requirements?: string;
  /** Hoş geldiniz maili gönderim zamanı (contacts.metadata) — null = gönderilmedi. */
  welcomeEmailSentAt: string | null;
  /** Son lead skoru (Eylül/RAG skorlama önbelleği) — null = skorlanmadı. */
  aiScore: number | null;
  /** Yatırım profili alanlarının kaynağı: manuel giriş mi Eylül çıkarımı mı. */
  profileSource: 'manual' | 'eylul' | null;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v ? v : fallback;
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** 1500000 → "1.500.000" (tr biçimi, kuruşsuz). */
function money(v: string | null): string | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString('tr-TR') : null;
}

export function toClientResponse(row: ClientRow): ClientResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const cr = (row.lead_criteria ?? {}) as Record<string, unknown>;
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();

  // ---- Yatırım profili: manuel giriş (Edit Profile) öncelikli; boşsa
  // Eylül'ün konuşmadan çıkardığı lead profili (budget + criteria) kullanılır.
  const manualUnitTypes = Array.isArray(m.unit_types) ? arr(m.unit_types) : null;
  const leadUnitType = str(cr.unit_type) || null;
  const unitTypes = manualUnitTypes && manualUnitTypes.length > 0
    ? manualUnitTypes
    : (leadUnitType ? [leadUnitType] : null);

  const purpose = str(m.purpose) || str(cr.purpose) || null;

  const min = money(row.lead_budget_min);
  const max = money(row.lead_budget_max);
  const cur = str(row.lead_currency, '');
  const leadBudget = min && max
    ? (min === max ? `${min} ${cur}`.trim() : `${min} – ${max} ${cur}`.trim())
    : ((min ?? max) ? `${min ?? max} ${cur}`.trim() : null);

  // Yapılandırılmış manuel bütçe (Edit Profile min/max/döviz) görüntü metnini
  // üretir; yoksa legacy serbest metin (budget_range), o da yoksa Eylül'ün
  // lead çıkarımı kullanılır.
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  const budgetMin = num(m.budget_min);
  const budgetMax = num(m.budget_max);
  const budgetCurrency = str(m.budget_currency) || null;
  const fmtB = (v: number) => Math.round(v).toLocaleString('tr-TR');
  const structuredBudget = budgetMin || budgetMax
    ? (budgetMin && budgetMax && budgetMin !== budgetMax
        ? `${fmtB(budgetMin)} – ${fmtB(budgetMax)} ${budgetCurrency ?? ''}`.trim()
        : `${fmtB((budgetMin ?? budgetMax)!)} ${budgetCurrency ?? ''}`.trim())
    : null;
  const budgetRange = structuredBudget || str(m.budget_range) || leadBudget;

  const manualRegions = arr(m.preferred_regions);
  const leadRegions = [str(cr.market), str(cr.city), str(cr.district)].filter(Boolean);
  const preferredRegions = manualRegions.length > 0 ? manualRegions : leadRegions;

  const leadReq = [
    str(cr.special_requests) || null,
    str(cr.timeline) ? `Zaman ufku: ${str(cr.timeline)}` : null,
  ].filter(Boolean).join(' · ');
  const requirements = str(m.requirements) || leadReq || null;

  const manualHasProfile = Boolean(
    (manualUnitTypes && manualUnitTypes.length > 0) || str(m.purpose)
    || str(m.budget_range) || budgetMin || budgetMax
    || manualRegions.length > 0 || str(m.requirements),
  );
  const eylulHasProfile = Boolean(leadUnitType || str(cr.purpose) || leadBudget || leadRegions.length > 0 || leadReq);
  const profileSource: ClientResponse['profileSource'] =
    manualHasProfile ? 'manual' : (eylulHasProfile ? 'eylul' : null);

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
    preferredRegions,
    investmentProfile: str(m.investment_profile, 'Balanced'),
    source: str(m.source, '—'),
    relationshipStatus: str(m.relationship_status, 'Active'),
    assignedConsultant: row.consultant ?? str(m.assigned_consultant, '—'),
    lastContactDate: row.last_contact ?? row.updated_at,
    ...(unitTypes ? { unitTypes } : {}),
    ...(purpose ? { purpose } : {}),
    ...(budgetRange ? { budgetRange } : {}),
    budgetMin,
    budgetMax,
    budgetCurrency,
    ...(requirements ? { requirements } : {}),
    welcomeEmailSentAt: str(m.welcome_email_sent_at) || null,
    aiScore: typeof row.lead_score === 'number' ? row.lead_score : null,
    profileSource,
  };
}
