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
  BrandingSettingsDTO,
  ClientDTO,
  ClientNoteDTO,
  CreateClientNoteInput,
  ClientAnalysisDTO,
  ClientTimelineEntryDTO,
  ContactDTO,
  ContractDTO,
  ContractWriteInput,
  CreateDeveloperInput,
  CreateMeetingInput,
  UpdateMeetingInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateProposalInput,
  UpdateProposalInput,
  CreateTaskInput,
  UpdateTaskInput,
  DashboardSummaryDTO,
  DeveloperDTO,
  UpdateDeveloperInput,
  FinancialsSummaryDTO,
  GoogleOAuthStatus,
  FinancialsTimeframe,
  MarketingSummaryDTO,
  MarketingTimeframe,
  AdCampaignDTO,
  CreateAdSpendInput,
  ProjectInviteDTO,
  CreateInviteInput,
  ProjectSubmissionDTO,
  PublicInviteInfoDTO,
  MeetingDTO,
  NotificationFeed,
  SocialSummaryDTO,
  SocialPostDTO,
  UpsertFollowersInput,
  CreateSocialPostInput,
  KPIDTO,
  LeadCommunicationDTO,
  LeadDTO,
  LeadScoreDTO,
  LoginResponse,
  MeResponse,
  ProjectDTO,
  ProposalDTO,
  RoleOptionDTO,
  UpdateTeamMemberInput,
  CreateTeamMemberInput,
  CreateTeamMemberResult,
  SendEmailInput,
  TaskDTO,
  TeamMemberDTO,
  ThreadDetailDTO,
  ThreadSummaryDTO,
  UserDetailDTO,
  UpdateBrandingInput,
  UpdateMeInput,
  UserDTO,
  VaultDocumentDTO,
  AdProposalDTO,
  MarketingAnalysisDTO,
  ManagerRunDTO,
  ManagerReportDTO,
  ActivityPageDTO,
  AuditActorDTO,
  ActivityFiltersInput,
  BriefResultDTO,
  LeadDossierDTO,
  IntelReportSummaryDTO,
  IntelReportDetailDTO,
  IntelItemDTO,
  IntelSearchHitDTO,
  PublishingPlanDTO,
  PublishingPlanItemDTO,
  PublishingGenerateResultDTO,
  PlanImageDTO,
} from '../types';

export const authApi = {
  // Legacy mock login (FAZ T demo)
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/api/auth/login', { email, password }),
  me: () => api.get<UserDTO>('/api/auth/me'),
  // Gerçek auth modu: backend GET /api/me → profil + rol
  realMe: () => api.get<MeResponse>('/api/me'),
};

export const meApi = {
  get: () => api.get<MeResponse>('/api/me'),
  update: (input: UpdateMeInput) => api.patch<MeResponse>('/api/me', input),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<MeResponse>('/api/me/avatar', form);
  },
};

export const googleAuthApi = {
  url: () => api.get<{ url: string }>('/api/auth/google/url'),
  status: () => api.get<GoogleOAuthStatus>('/api/auth/google/status'),
  disconnect: () => api.post<{ ok: true }>('/api/auth/google/disconnect'),
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

export interface DuplicateMatch {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  matchedBy: string; // 'e-posta' | 'telefon'
}

export const contactsApi = {
  list: (search?: string) => api.get<ContactDTO[]>('/api/contacts', { params: { search } }),
  get: (id: string) => api.get<ContactDTO>(`/api/contacts/${id}`),
  create: (input: CreateContactInput) => api.post<ContactDTO>('/api/contacts', input),
  // Duplicate ön-kontrolü: kayıttan önce e-posta/telefonla eşleşen kişi.
  lookup: (email?: string, phone?: string) =>
    api.get<{ match: DuplicateMatch | null }>('/api/contacts/lookup', { params: { email, phone } }),
};

export const leadsApi = {
  list: () => api.get<LeadDTO[]>('/api/leads'),
  get: (id: string) => api.get<LeadDTO>(`/api/leads/${id}`),
  create: (input: CreateLeadInput) => api.post<LeadDTO>('/api/leads', input),
  update: (id: string, input: UpdateLeadInput) => api.patch<LeadDTO>(`/api/leads/${id}`, input),
  communications: (id: string) => api.get<LeadCommunicationDTO[]>(`/api/leads/${id}/communications`),
  scores: (id: string) => api.get<LeadScoreDTO[]>(`/api/leads/${id}/scores`),
  /** KALICI silme — yalnız super_admin (backend zorlar); deal bağıysa 409. */
  remove: (id: string) => api.delete<{ deleted: true }>(`/api/leads/${id}`),
};

export const clientsApi = {
  list: () => api.get<ClientDTO[]>('/api/clients'),
  update: (id: string, patch: Partial<ClientDTO>) => api.patch<ClientDTO>(`/api/clients/${id}`, patch),
  notes: (id: string) => api.get<ClientNoteDTO[]>(`/api/clients/${id}/notes`),
  addNote: (id: string, body: CreateClientNoteInput) =>
    api.post<ClientNoteDTO>(`/api/clients/${id}/notes`, body),
  timeline: (id: string) => api.get<ClientTimelineEntryDTO[]>(`/api/clients/${id}/timeline`),
  analyses: (id: string) => api.get<ClientAnalysisDTO[]>(`/api/clients/${id}/analyses`),
  /**
   * KALICI silme — client id = contact id; kişi + tüm lead'leri + iletişim
   * izleri gider. Yalnız super_admin (backend zorlar); deal/finans/sözleşme
   * bağıysa 409.
   */
  remove: (id: string) => api.delete<{ deleted: true }>(`/api/contacts/${id}`),
};

export const developersApi = {
  list: () => api.get<DeveloperDTO[]>('/api/developers'),
  create: (input: CreateDeveloperInput) => api.post<DeveloperDTO>('/api/developers', input),
  update: (id: string, input: UpdateDeveloperInput) => api.patch<DeveloperDTO>(`/api/developers/${id}`, input),
};

export const projectsApi = {
  list: () => api.get<ProjectDTO[]>('/api/projects'),
  create: (input: CreateProjectInput) => api.post<ProjectDTO>('/api/projects', input),
  uploadImages: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.post<ProjectDTO>(`/api/projects/${id}/images`, form);
  },
  setLifecycle: (id: string, status: ProjectDTO['lifecycleStatus']) =>
    api.patch<ProjectDTO>(`/api/projects/${id}/lifecycle`, { status }),
  update: (id: string, input: UpdateProjectInput) => api.patch<ProjectDTO>(`/api/projects/${id}`, input),
};

export const proposalsApi = {
  list: () => api.get<ProposalDTO[]>('/api/proposals'),
  get: (id: string) => api.get<ProposalDTO>(`/api/proposals/${id}`),
  create: (input: CreateProposalInput) => api.post<ProposalDTO>('/api/proposals', input),
  update: (id: string, input: UpdateProposalInput) =>
    api.patch<ProposalDTO>(`/api/proposals/${id}`, input),
  send: (id: string) => api.post<ProposalDTO>(`/api/proposals/${id}/send`),
};

export const contractsApi = {
  list: () => api.get<ContractDTO[]>('/api/contracts'),
  get: (id: string) => api.get<ContractDTO>(`/api/contracts/${id}`),
  create: (input: ContractWriteInput) => api.post<ContractDTO>('/api/contracts', input),
  update: (id: string, input: ContractWriteInput) => api.patch<ContractDTO>(`/api/contracts/${id}`, input),
};

export const meetingsApi = {
  list: () => api.get<MeetingDTO[]>('/api/meetings'),
  create: (input: CreateMeetingInput) => api.post<MeetingDTO>('/api/meetings', input),
  update: (id: string, input: UpdateMeetingInput) => api.patch<MeetingDTO>(`/api/meetings/${id}`, input),
  remove: (id: string) => api.delete<{ id: string; deleted: true }>(`/api/meetings/${id}`),
};

/** Denetim konsolu — YALNIZ super_admin ('audit_full' izni).
 *  Mevcut auditApi.list() ham liste; bu konsol zenginleştirilmiş akış. */
export const auditConsoleApi = {
  activity: (f: ActivityFiltersInput = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    }
    const qs = q.toString();
    return api.get<ActivityPageDTO>(`/api/admin/audit/activity${qs ? `?${qs}` : ''}`);
  },
  actors: () => api.get<AuditActorDTO[]>('/api/admin/audit/actors'),
  entityHistory: (id: string) =>
    api.get<ActivityPageDTO['rows']>(`/api/admin/audit/entity/${id}`),
};

/** GÃ¶rÃ¼ÅŸme hazÄ±rlÄ±k brifingi â€” danÄ±ÅŸman toplantÄ±dan Ã¶nce okur. */
export const meetingBriefApi = {
  brief: (leadId: string) =>
    api.get<BriefResultDTO>(`/api/leads/${leadId}/brief`),
  dossier: (leadId: string) =>
    api.get<LeadDossierDTO>(`/api/leads/${leadId}/dossier`),
  regenerate: (leadId: string) =>
    api.post<BriefResultDTO>(`/api/leads/${leadId}/brief/regenerate`, {}),
};

/** Haftalık istihbarat raporu arşivi ('marketing' izni). */
export const intelApi = {
  list: () => api.get<IntelReportSummaryDTO[]>('/api/intel/reports'),
  detail: (id: string) => api.get<IntelReportDetailDTO>(`/api/intel/reports/${id}`),
  search: (q: string, market?: string) => {
    const p = new URLSearchParams({ q });
    if (market) p.set('market', market);
    return api.get<IntelSearchHitDTO[]>(`/api/intel/reports/search?${p.toString()}`);
  },
  items: (f: { status?: string; market?: string; speculative?: boolean } = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) {
      if (v !== undefined && v !== '') p.set(k, String(v));
    }
    const qs = p.toString();
    return api.get<IntelItemDTO[]>(`/api/intel/reports/items${qs ? `?${qs}` : ''}`);
  },
  updateItem: (id: string, status: IntelItemDTO['status']) =>
    api.patch<IntelItemDTO>(`/api/intel/reports/items/${id}`, { status }),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<IntelReportDetailDTO>('/api/intel/reports/upload', fd);
  },
  fromText: (title: string, text: string) =>
    api.post<IntelReportDetailDTO>('/api/intel/reports/text', { title, text }),
  remove: (id: string) => api.delete<{ deleted: true }>(`/api/intel/reports/${id}`),
};

/**
 * Haftalık yayın akışı. Dikkat: burada "yayınla" ucu YOK — sistem
 * hiçbir yere paylaşım yapmaz, yalnız hazırlar. markItem bir kayıt.
 */
export const publishingApi = {
  list: (limit?: number) =>
    api.get<PublishingPlanDTO[]>(`/api/intel/publishing${limit ? `?limit=${limit}` : ''}`),
  today: () => api.get<PublishingPlanItemDTO[]>('/api/intel/publishing/today'),
  get: (id: string) => api.get<PublishingPlanDTO>(`/api/intel/publishing/${id}`),
  generate: (reportId: string, body: { weekStart?: string; generateImages?: boolean } = {}) =>
    api.post<PublishingGenerateResultDTO>(`/api/intel/publishing/generate/${reportId}`, body),
  pushDrive: (id: string) =>
    api.post<{ ok: boolean; message?: string; folderLink?: string }>(
      `/api/intel/publishing/${id}/drive`, {}),
  buildImages: (id: string) =>
    api.post<{ ok: boolean; message?: string; generated: number; total: number }>(
      `/api/intel/publishing/${id}/images`, {}),
  itemImages: (itemId: string) =>
    api.get<PlanImageDTO[]>(`/api/intel/publishing/items/${itemId}/images`),
  markItem: (itemId: string, status: PublishingPlanItemDTO['status']) =>
    api.patch<{ ok: true }>(`/api/intel/publishing/items/${itemId}`, { status }),
};

export const socialApi = {
  summary: () => api.get<SocialSummaryDTO>('/api/marketing/social/summary'),
  upsertFollowers: (input: UpsertFollowersInput) => api.post<{ ok: true }>('/api/marketing/social/followers', input),
  createPost: (input: CreateSocialPostInput) => api.post<SocialPostDTO>('/api/marketing/social/posts', input),
  updatePostLeads: (id: string, leads: number) => api.patch<{ ok: true }>(`/api/marketing/social/posts/${id}`, { leads }),
  removePost: (id: string) => api.delete<{ deleted: true }>(`/api/marketing/social/posts/${id}`),
};

/** Reklam onay kuyruğu — bütçe kararı yalnız buradan geçer. */
export const adProposalsApi = {
  list: (status?: string) =>
    api.get<AdProposalDTO[]>(`/api/marketing/ad-proposals${status ? `?status=${status}` : ''}`),
  analyze: () => api.post<MarketingAnalysisDTO>('/api/marketing/ad-proposals/analyze', {}),
  approve: (id: string, input: { dailyBudget?: number; note?: string }) =>
    api.post<AdProposalDTO>(`/api/marketing/ad-proposals/${id}/approve`, input),
  reject: (id: string, note?: string) =>
    api.post<AdProposalDTO>(`/api/marketing/ad-proposals/${id}/reject`, { note }),
  publish: (id: string) =>
    api.post<{ ok: boolean; message: string }>(`/api/marketing/ad-proposals/${id}/publish`, {}),
  activate: (id: string) =>
    api.post<{ ok: boolean; message: string }>(`/api/marketing/ad-proposals/${id}/activate`, {}),
  pause: (id: string) =>
    api.post<{ ok: boolean; message: string }>(`/api/marketing/ad-proposals/${id}/pause`, {}),
  // Pazarlama yöneticisi: haftalık çalışma + hedeflere ilerleme
  runManager: () =>
    api.post<ManagerRunDTO>('/api/marketing/ad-proposals/manager/run', {}),
  managerReport: () =>
    api.get<ManagerReportDTO>('/api/marketing/ad-proposals/manager/report'),
};

export const notificationsApi = {
  list: () => api.get<NotificationFeed>('/api/me/notifications'),
  markSeen: () => api.post<{ ok: true }>('/api/me/notifications/seen'),
};

export const documentsApi = {
  list: () => api.get<VaultDocumentDTO[]>('/api/documents'),
  upload: (file: File, folder: string, relatedType?: string, relatedId?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    if (relatedType) form.append('related_type', relatedType);
    if (relatedId) form.append('related_id', relatedId);
    return api.post<VaultDocumentDTO>('/api/documents', form);
  },
  downloadUrl: (id: string) => api.get<{ url: string; name: string }>(`/api/documents/${id}/download`),
  remove: (id: string) => api.delete<{ deleted: true }>(`/api/documents/${id}`),
};

export const gmailApi = {
  threads: (q?: string, maxResults?: number) =>
    api.get<ThreadSummaryDTO[]>('/api/gmail/threads', { params: { q, maxResults } }),
  thread: (id: string) => api.get<ThreadDetailDTO>(`/api/gmail/threads/${id}`),
  send: (input: SendEmailInput) =>
    api.post<{ id: string; threadId: string }>('/api/gmail/send', input),
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
  create: (input: CreateTaskInput) => api.post<TaskDTO>('/api/tasks', input),
  update: (id: string, updates: UpdateTaskInput) =>
    api.put<TaskDTO>(`/api/tasks/${id}`, updates),
};

export const dashboardApi = {
  summary: () => api.get<DashboardSummaryDTO>('/api/dashboard/summary'),
  kpis: () => api.get<KPIDTO[]>('/api/kpi/dashboard'),
  globalActivities: () => api.get<ActivityDTO[]>('/api/activities/global'),
};

export const financialsApi = {
  summary: (timeframe: FinancialsTimeframe) =>
    api.get<FinancialsSummaryDTO>('/api/financials/summary', { params: { timeframe } }),
};

export const marketingApi = {
  summary: (timeframe: MarketingTimeframe) =>
    api.get<MarketingSummaryDTO>('/api/marketing/summary', { params: { timeframe } }),
  campaigns: () => api.get<AdCampaignDTO[]>('/api/marketing/campaigns'),
  create: (input: CreateAdSpendInput) => api.post<AdCampaignDTO>('/api/marketing/campaigns', input),
  import: (rows: CreateAdSpendInput[]) =>
    api.post<{ imported: number }>('/api/marketing/campaigns/import', { rows }),
  remove: (id: string) => api.delete<{ deleted: true }>(`/api/marketing/campaigns/${id}`),
  syncMeta: () =>
    api.post<{ ok: boolean; configured: boolean; rows: number; campaigns: number; spendTotal: number; currency: string | null }>(
      '/api/marketing/meta-sync', {},
    ),
};

// Proje Girişi — admin (davet linki + onay kuyruğu).
export const intakeApi = {
  listInvites: () => api.get<ProjectInviteDTO[]>('/api/intake/invites'),
  createInvite: (input: CreateInviteInput) => api.post<ProjectInviteDTO>('/api/intake/invites', input),
  revokeInvite: (id: string) => api.delete<{ revoked: true }>(`/api/intake/invites/${id}`),
  queue: () => api.get<ProjectSubmissionDTO[]>('/api/intake/queue'),
  queueCount: () => api.get<{ count: number }>('/api/intake/queue/count'),
  review: (id: string) => api.get<ProjectSubmissionDTO>(`/api/intake/queue/${id}`),
  approve: (id: string, mode: 'new' | 'update' = 'new') =>
    api.post<{ approved: true; propertyId: string; updated: boolean }>(`/api/intake/queue/${id}/approve`, { mode }),
  reject: (id: string, note?: string) => api.post<{ rejected: true }>(`/api/intake/queue/${id}/reject`, { note }),
};

// Proje Girişi — public (geliştirici, tokenli, auth'suz).
export const publicIntakeApi = {
  info: (token: string) => api.get<PublicInviteInfoDTO>(`/api/public/intake/${token}`),
  submit: (token: string, form: FormData) =>
    api.post<{ ok: boolean; submissionId: string }>(`/api/public/intake/${token}/submit`, form),
};

export const adminApi = {
  team: () => api.get<TeamMemberDTO[]>('/api/admin/team'),
  userDetail: (id: string) => api.get<UserDetailDTO>(`/api/admin/team/${id}`),
  branding: () => api.get<BrandingSettingsDTO>('/api/admin/branding'),
  updateBranding: (input: UpdateBrandingInput) => api.patch<BrandingSettingsDTO>('/api/admin/branding', input),
  roles: () => api.get<RoleOptionDTO[]>('/api/admin/roles'),
  updateTeamMember: (id: string, input: UpdateTeamMemberInput) =>
    api.patch<TeamMemberDTO>(`/api/admin/team/${id}`, input),
  createTeamMember: (input: CreateTeamMemberInput) =>
    api.post<CreateTeamMemberResult>('/api/admin/team', input),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<BrandingSettingsDTO>('/api/admin/branding/logo', form);
  },
};
