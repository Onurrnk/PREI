// =====================================================================
// PREI | ProposalResponse — proposals tablosu sözleşmesi (dış yüzey).
// contact→clientName, property→projectName join; status enum→görsel etiket.
// Frontend ProposalDTO ile senkron (alan adları mock'la korundu).
// =====================================================================
import type { ProposalRow } from '../proposals.repository';

export interface ProposalResponse {
  id: string;
  title: string;
  clientName: string;
  projectName: string;
  status: string; // Draft | Sent | Viewed | Accepted | Rejected
  totalValue: number;
  currency: string;
  createdAt: string;
  lastViewed?: string;
  viewCount: number;
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function num(v: string | null): number {
  if (v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function toProposalResponse(row: ProposalRow): ProposalResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const clientName = [row.contact_first_name, row.contact_last_name].filter(Boolean).join(' ').trim()
    || str(m.client_name) || '—';
  const projectName = row.project_title || str(m.project_name) || '—';
  const res: ProposalResponse = {
    id: row.id,
    title: row.title,
    clientName,
    projectName,
    status: cap(row.status),
    totalValue: num(row.total_value),
    currency: row.currency,
    createdAt: row.created_at,
    viewCount: row.view_count,
  };
  if (row.last_viewed_at) res.lastViewed = row.last_viewed_at;
  return res;
}
