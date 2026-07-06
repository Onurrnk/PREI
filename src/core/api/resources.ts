// =====================================================================
// PREI | API resources
// Typed, named functions per backend resource. Components call these
// instead of hand-writing fetch('/api/...') + manual JSON parsing.
// Endpoint paths live here only — one place to change when the backend
// route shape changes.
// =====================================================================
import { api } from './client';
import type {
  ActivityDTO,
  AuditLogDTO,
  ClientDTO,
  DeveloperDTO,
  KPIDTO,
  LeadDTO,
  LoginResponse,
  MeResponse,
  ProjectDTO,
  ProposalDTO,
  TaskDTO,
  UserDTO,
  VaultDocumentDTO,
} from '../types';

export const authApi = {
  // Legacy mock login (FAZ T demo)
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/api/auth/login', { email, password }),
  me: () => api.get<UserDTO>('/api/auth/me'),
  // Gerçek auth modu: backend GET /api/me → profil + rol
  realMe: () => api.get<MeResponse>('/api/me'),
};

export const leadsApi = {
  list: () => api.get<LeadDTO[]>('/api/leads'),
};

export const clientsApi = {
  list: () => api.get<ClientDTO[]>('/api/clients'),
};

export const developersApi = {
  list: () => api.get<DeveloperDTO[]>('/api/developers'),
};

export const projectsApi = {
  list: () => api.get<ProjectDTO[]>('/api/projects'),
};

export const proposalsApi = {
  list: () => api.get<ProposalDTO[]>('/api/proposals'),
};

export const documentsApi = {
  list: () => api.get<VaultDocumentDTO[]>('/api/documents'),
};

export const auditApi = {
  list: () => api.get<AuditLogDTO[]>('/api/audit'),
};

export const usersApi = {
  list: () => api.get<UserDTO[]>('/api/users'),
};

export const tasksApi = {
  list: (assigneeId?: string) =>
    api.get<TaskDTO[]>('/api/tasks', { params: { assigneeId } }),
  update: (id: string, updates: Partial<TaskDTO>) =>
    api.put<TaskDTO>(`/api/tasks/${id}`, updates),
};

export const dashboardApi = {
  kpis: () => api.get<KPIDTO[]>('/api/kpi/dashboard'),
  globalActivities: () => api.get<ActivityDTO[]>('/api/activities/global'),
};
