// =====================================================================
// PREI | RBAC permission model
// Coarse, role-based permissions. The backend remains the source of truth;
// this is the FRONTEND projection used only to hide/disable UI and guard
// routes. Never rely on it for actual data authorization.
// =====================================================================
import type { UserDTO } from '../types';

export type Role = UserDTO['role']; // 'Admin' | 'Consultant' | 'Manager'

export type Permission =
  | 'dashboard'
  | 'leads'
  | 'clients'
  | 'developers'
  | 'projects'
  | 'proposals'
  | 'documents'
  | 'meetings'
  | 'tasks'
  | 'contracts'
  | 'financials'
  | 'marketing'
  | 'admin'
  | 'settings';

const ALL: Permission[] = [
  'dashboard', 'leads', 'clients', 'developers', 'projects', 'proposals',
  'documents', 'meetings', 'tasks', 'contracts', 'financials', 'marketing', 'admin', 'settings',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Full system access (IT / owner).
  Admin: ALL,
  // Everything except the admin & audit console.
  Manager: ALL.filter((p) => p !== 'admin'),
  // Sales consultant: own pipeline & supporting data; no finance/admin/contracts.
  Consultant: [
    'dashboard', 'leads', 'clients', 'developers', 'projects',
    'proposals', 'documents', 'meetings', 'tasks', 'settings',
  ],
};

export const can = (role: Role | undefined, perm: Permission): boolean =>
  !!role && ROLE_PERMISSIONS[role]?.includes(perm);
