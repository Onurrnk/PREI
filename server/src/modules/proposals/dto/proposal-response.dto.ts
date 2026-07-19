// =====================================================================
// PREI | ProposalResponse — proposals tablosu sözleşmesi (dış yüzey).
// contact→clientName, property→projectName join; status enum→görsel etiket.
// Frontend ProposalDTO ile senkron (alan adları mock'la korundu).
// metadata'dan ödeme planı / ek bayrakları / kapak görseli türetilir;
// eski kayıtlarda alan yoksa hiç gönderilmez (frontend bölümü gizler).
// =====================================================================
import type { ProposalRow } from '../proposals.repository';
import type { RoiReport } from '../roi.util';

export interface ProposalPaymentPlanItem {
  milestone: string;
  percentage: number;
  date: string;
}

export interface ProposalResponse {
  id: string;
  /** Müşteri bağı — ClientProfile "Teklifler" sekmesi bu id ile filtreler. */
  contactId: string | null;
  clientEmail: string | null;
  propertyId: string | null;
  title: string;
  clientName: string;
  projectName: string;
  status: string; // Draft | Sent | Viewed | Accepted | Rejected
  projectLocation?: string;
  totalValue: number;
  listPrice?: number;
  discountPct?: number;
  currency: string;
  paymentPlanOnList?: boolean;
  createdAt: string;
  sentAt?: string;
  lastViewed?: string;
  viewCount: number;
  paymentPlan?: ProposalPaymentPlanItem[];
  unit?: Record<string, unknown>;
  roi?: RoiReport;
  roiInputs?: Record<string, unknown>;
  notes?: string;
  includeBrochurePdf?: boolean;
  includeFloorPlans?: boolean;
  includeRoiSheet?: boolean;
  coverImage?: string;
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

function parsePaymentPlan(v: unknown): ProposalPaymentPlanItem[] {
  if (!Array.isArray(v)) return [];
  const items: ProposalPaymentPlanItem[] = [];
  for (const row of v) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    const milestone = str(r.milestone);
    const pct = Number(r.percentage);
    if (!milestone || !Number.isFinite(pct)) continue;
    items.push({ milestone, percentage: pct, date: str(r.date) });
  }
  return items;
}

export function toProposalResponse(row: ProposalRow): ProposalResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const clientName = [row.contact_first_name, row.contact_last_name].filter(Boolean).join(' ').trim()
    || str(m.client_name) || '—';
  const projectName = row.project_title || str(m.project_name) || '—';
  const res: ProposalResponse = {
    id: row.id,
    contactId: row.contact_id ?? null,
    clientEmail: row.contact_email ?? null,
    propertyId: row.property_id ?? null,
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
  if (row.sent_at) res.sentAt = row.sent_at;

  if (typeof m.listPrice === 'number') res.listPrice = m.listPrice;
  if (typeof m.discountPercent === 'number') res.discountPct = m.discountPercent;
  if (typeof m.paymentPlanOnList === 'boolean') res.paymentPlanOnList = m.paymentPlanOnList;
  if (m.unit && typeof m.unit === 'object' && !Array.isArray(m.unit)) {
    res.unit = m.unit as Record<string, unknown>;
  }
  if (m.roiReport && typeof m.roiReport === 'object' && !Array.isArray(m.roiReport)) {
    res.roi = m.roiReport as unknown as RoiReport;
  }
  if (m.roi && typeof m.roi === 'object' && !Array.isArray(m.roi)) {
    res.roiInputs = m.roi as Record<string, unknown>;
  }
  if (str(m.notes)) res.notes = str(m.notes);

  const location = [row.project_district, row.project_city, row.project_country]
    .filter(Boolean).join(', ');
  if (location) res.projectLocation = location;

  const plan = parsePaymentPlan(m.paymentPlan);
  if (plan.length > 0) res.paymentPlan = plan;
  if (typeof m.includeBrochurePdf === 'boolean') res.includeBrochurePdf = m.includeBrochurePdf;
  if (typeof m.includeFloorPlans === 'boolean') res.includeFloorPlans = m.includeFloorPlans;
  if (typeof m.includeRoiSheet === 'boolean') res.includeRoiSheet = m.includeRoiSheet;
  const photos = Array.isArray(m.selectedPhotos) ? m.selectedPhotos.filter((p): p is string => typeof p === 'string') : [];
  if (photos.length > 0) res.coverImage = photos[0];
  return res;
}
