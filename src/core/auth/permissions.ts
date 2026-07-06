// =====================================================================
// PREI | RBAC permission model (FRONTEND projeksiyonu)
// Asıl zorlama backend'de (Blueprint §7.1). Bu katman yalnız UI gizler/route
// gard eder. Hem legacy mock rolleri (Admin/Manager/Consultant) hem gerçek
// backend rol anahtarları (super_admin/... — /api/me'den gelir) desteklenir;
// FAZ T mock demosu + gerçek auth aynı anda çalışsın.
// =====================================================================

export type Role =
  // Gerçek backend rolleri (Master Plan §4)
  | 'super_admin' | 'manager' | 'finance_manager' | 'marketing_manager' | 'consultant'
  // Legacy mock rolleri (FAZ T demo — geriye uyum)
  | 'Admin' | 'Consultant' | 'Manager';

export type Permission =
  | 'dashboard' | 'leads' | 'clients' | 'developers' | 'projects' | 'proposals'
  | 'documents' | 'meetings' | 'tasks' | 'contracts' | 'financials' | 'marketing'
  | 'admin' | 'settings';

const ALL: Permission[] = [
  'dashboard', 'leads', 'clients', 'developers', 'projects', 'proposals',
  'documents', 'meetings', 'tasks', 'contracts', 'financials', 'marketing', 'admin', 'settings',
];

const CONSULTANT: Permission[] = [
  'dashboard', 'leads', 'clients', 'developers', 'projects',
  'proposals', 'documents', 'meetings', 'tasks', 'settings',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // --- Gerçek roller ---
  super_admin: ALL,
  manager: ALL.filter((p) => p !== 'admin'),
  finance_manager: ['dashboard', 'leads', 'clients', 'developers', 'projects', 'proposals', 'documents', 'meetings', 'tasks', 'contracts', 'financials'],
  marketing_manager: ['dashboard', 'leads', 'clients', 'documents', 'meetings', 'tasks', 'marketing'],
  consultant: CONSULTANT,
  // --- Legacy mock (FAZ T) ---
  Admin: ALL,
  Manager: ALL.filter((p) => p !== 'admin'),
  Consultant: CONSULTANT,
};

export const can = (role: Role | undefined, perm: Permission): boolean =>
  !!role && ROLE_PERMISSIONS[role]?.includes(perm);
