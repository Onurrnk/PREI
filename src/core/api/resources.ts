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
  ContactDTO,
  ContractDTO,
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

export interface CreateLeadInput {
  contact_id: string;
  owner_id?: string;
  status?: LeadDTO['status'];
  interest_type?: LeadDTO['interestType'];
  priority?: LeadDTO['priority'];
  budget_min?: number;
  budget_max?: number;
  currency?: string;
  target_market_code?: string;
  score?: number;
  notes?: string;
}

export interface UpdateLeadInput {
  status?: LeadDTO['status'];
  priority?: LeadDTO['priority'];
  owner_id?: string;
  score?: number;
  notes?: string;
  version: number; // optimistic concurrency → 409
}

export interface CreateContactInput {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  preferred_lang?: string;
  marketing_consent?: boolean;
  notes?: string;
}

export const contactsApi = {
  list: (search?: string) => api.get<ContactDTO[]>('/api/contacts', { params: { search } }),
  get: (id: string) => api.get<ContactDTO>(`/api/contacts/${id}`),
  create: (input: CreateContactInput) => api.post<ContactDTO>('/api/contacts', input),
};

export const leadsApi = {
  list: () => api.get<LeadDTO[]>('/api/leads'),
  get: (id: string) => api.get<LeadDTO>(`/api/leads/${id}`),
  create: (input: CreateLeadInput) => api.post<LeadDTO>('/api/leads', input),
  update: (id: string, input: UpdateLeadInput) => api.patch<LeadDTO>(`/api/leads/${id}`, input),
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

export const contractsApi = {
  list: () => api.get<ContractDTO[]>('/api/contracts'),
  get: (id: string) => api.get<ContractDTO>(`/api/contracts/${id}`),
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
