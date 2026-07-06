// =====================================================================
// PREI | DeveloperResponse — organizations(org_type='developer') sözleşmesi.
// İç içe projeler = geliştiricinin properties satırları (ProjectResponse).
// Zengin alanlar (tier/partnership/commission/website/keyContact) metadata'da.
// =====================================================================
import type { DeveloperRow, ProjectRow } from '../catalog.repository';
import { toProjectResponse, type ProjectResponse } from './project-response.dto';

export interface DeveloperResponse {
  id: string;
  name: string;
  tier: string;
  headquarters: string;
  activeProjects: number;
  totalCompletedProjects: number;
  partnershipStatus: string;
  commissionRate: string;
  keyContactName: string;
  keyContactEmail: string;
  keyContactPhone: string;
  website: string;
  projects: ProjectResponse[];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function toDeveloperResponse(row: DeveloperRow, projectRows: ProjectRow[]): DeveloperResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const projects = projectRows.map(toProjectResponse);
  const completedFromData = projects.filter((p) => p.status === 'Completed').length;
  return {
    id: row.id,
    name: row.name,
    tier: str(m.tier) || 'Boutique',
    headquarters: str(m.headquarters),
    activeProjects: projects.filter((p) => p.status !== 'Completed').length,
    totalCompletedProjects: num(m.total_completed_projects) || completedFromData,
    partnershipStatus: str(m.partnership_status) || 'Active',
    commissionRate: str(m.commission_rate),
    keyContactName: str(m.key_contact_name),
    keyContactEmail: str(m.key_contact_email) || row.email || '',
    keyContactPhone: str(m.key_contact_phone) || row.phone || '',
    website: str(m.website),
    projects,
  };
}
