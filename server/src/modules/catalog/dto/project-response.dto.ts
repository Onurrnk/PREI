// =====================================================================
// PREI | ProjectResponse — API sözleşmesi (properties + geliştirici join).
// Frontend ProjectDTO ile senkron. UI "proje/geliştirme" kavramını modelliyor;
// şemada karşılığı properties satırı + zengin alanlar metadata jsonb'da.
// Alan adları frontend mock'uyla aynı tutuldu (dondurulmuş UI değişmesin).
// =====================================================================
import type { ProjectRow } from '../catalog.repository';

export interface PaymentPlanItem { milestone: string; percentage: number; date: string }
export interface ProjectDocItem { id: string; title: string; type: string; size: string }

export interface ProjectResponse {
  id: string;
  developerId: string | null;
  developerName: string;
  name: string;
  location: string;
  status: string; // 'Off-plan' | 'Under Construction' | 'Completed'
  totalUnits: number;
  availableUnits: number;
  startingPrice: number;
  currency: string;
  completionDate: string;
  projectManagerName: string;
  projectManagerPhone: string;
  projectManagerEmail: string;
  description: string;
  images: string[];
  amenities: string[];
  paymentPlan: PaymentPlanItem[];
  documents: ProjectDocItem[];
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function toProjectResponse(row: ProjectRow): ProjectResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const location = [row.district, row.city].filter(Boolean).join(', ') || row.country || '—';
  return {
    id: row.id,
    developerId: row.developer_id ?? null,
    developerName: row.developer_name ?? '—',
    name: row.title,
    location,
    status: str(m.project_status) || 'Off-plan',
    totalUnits: num(m.total_units),
    availableUnits: num(m.available_units),
    startingPrice: num(row.price),
    currency: row.currency ?? 'EUR',
    completionDate: str(m.completion_date),
    projectManagerName: str(m.pm_name),
    projectManagerPhone: str(m.pm_phone),
    projectManagerEmail: str(m.pm_email),
    description: row.description ?? '',
    images: arr<string>(m.images),
    amenities: arr<string>(m.amenities),
    paymentPlan: arr<PaymentPlanItem>(m.payment_plan),
    documents: arr<ProjectDocItem>(m.documents),
  };
}
