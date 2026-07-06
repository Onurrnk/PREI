// =====================================================================
// PREI | RBAC izin modeli (backend — asıl kaynak).
// Frontend src/core/auth/permissions.ts bunun UI-projeksiyonudur; asıl
// zorlama BURADA (Blueprint §7.1). Master Plan §4 rol matrisiyle uyumlu.
// =====================================================================
import type { AppRole } from './request-context';

export type Permission =
  | 'dashboard' | 'leads' | 'clients' | 'developers' | 'projects' | 'proposals'
  | 'documents' | 'meetings' | 'tasks' | 'contracts' | 'financials'
  | 'financials_confidential' | 'marketing' | 'admin' | 'settings';

const ALL: Permission[] = [
  'dashboard', 'leads', 'clients', 'developers', 'projects', 'proposals',
  'documents', 'meetings', 'tasks', 'contracts', 'financials',
  'financials_confidential', 'marketing', 'admin', 'settings',
];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: ALL,
  manager: ALL.filter((p) => p !== 'admin' && p !== 'financials_confidential'),
  finance_manager: ['dashboard', 'contracts', 'financials', 'financials_confidential', 'documents', 'meetings', 'tasks'],
  marketing_manager: ['dashboard', 'marketing', 'leads', 'documents', 'meetings', 'tasks'],
  consultant: ['dashboard', 'leads', 'clients', 'developers', 'projects', 'proposals', 'documents', 'meetings', 'tasks', 'settings'],
  // Eylül ingest servisi: yalnız lead/contact yazımı; komisyon/admin YOK.
  service_agent: ['leads', 'clients'],
};

export const can = (role: AppRole | null | undefined, perm: Permission): boolean =>
  !!role && ROLE_PERMISSIONS[role]?.includes(perm);
