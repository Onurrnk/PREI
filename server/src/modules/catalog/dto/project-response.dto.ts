// =====================================================================
// PREI | ProjectResponse — API sözleşmesi (properties + geliştirici join).
// Frontend ProjectDTO ile senkron. UI "proje/geliştirme" kavramını modelliyor;
// şemada karşılığı properties satırı + zengin alanlar metadata jsonb'da.
// Alan adları frontend mock'uyla aynı tutuldu (dondurulmuş UI değişmesin).
// =====================================================================
import type { ProjectRow, ProjectDocRow } from '../catalog.repository';

export interface PaymentPlanItem { milestone: string; percentage: number; date: string }
export interface ProjectDocItem { id: string; title: string; type: string; size: string }

export interface ProjectResponse {
  id: string;
  developerId: string | null;
  developerName: string;
  name: string;
  location: string;
  city: string;      // düzenleme formu ön-dolumu için ham değer
  district: string;
  status: string; // 'Off-plan' | 'Under Construction' | 'Completed' (yapım aşaması)
  lifecycleStatus: string; // 'active' | 'sold' | 'paused' | 'archived' (yaşam döngüsü)
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
  /**
   * Daire tipleri ve varyantları — teklif sihirbazı daire tipi seçilince
   * brüt/net m²'yi buradan otomatik dolduruyor (madde 22). Layout bir
   * görsel olduğu için m² ayrı veri alanı olarak taşınır.
   */
  unitTypes: ProjectUnitType[];
}

export interface ProjectUnitVariant {
  label: string;
  layout: string | null;
  areaGross: number | null;
  areaNet: number | null;
}

export interface ProjectUnitType {
  type: string;
  variants: ProjectUnitVariant[];
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

function docType(mime: string): string {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') return 'Spreadsheet';
  return 'PDF';
}
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function toProjectResponse(row: ProjectRow, docs: ProjectDocRow[] = []): ProjectResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const location = [row.district, row.city].filter(Boolean).join(', ') || row.country || '—';
  return {
    id: row.id,
    developerId: row.developer_id ?? null,
    developerName: row.developer_name ?? '—',
    name: row.title,
    location,
    city: row.city ?? '',
    district: row.district ?? '',
    status: str(m.project_status) || 'Off-plan',
    lifecycleStatus: str(m.lifecycle_status) || 'active',
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
    unitTypes: arr<{ type?: unknown; variants?: unknown }>(m.unit_details).map((u) => ({
      type: str(u.type),
      variants: arr<Record<string, unknown>>(u.variants).map((v) => ({
        label: str(v.label),
        layout: typeof v.layout === 'string' ? v.layout : null,
        areaGross: typeof v.areaGross === 'number' ? v.areaGross : null,
        areaNet: typeof v.areaNet === 'number' ? v.areaNet : null,
      })),
    })),
    paymentPlan: arr<PaymentPlanItem>(m.payment_plan),
    documents: docs.map((d) => ({
      id: d.id, title: d.name, type: docType(d.mime_type), size: formatSize(Number(d.size_bytes)),
    })),
  };
}
