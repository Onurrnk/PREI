// =====================================================================
// PREI | Domain Types (DTOs)
// Single source of truth for API contracts shared across the app.
// Previously these lived inside src/mocks/handlers.ts, which coupled the
// UI to the mock layer. Features should import types from here so that
// removing the mock backend never breaks the type contract.
// =====================================================================

export interface ActivityDTO {
  id: string;
  type: 'LEAD_CREATED' | 'MEETING_SCHEDULED' | 'PROPOSAL_SENT';
  actor: string;
  timestamp: string;
  details: string;
}

// GET /api/dashboard/summary — gerçek aggregate (EUR bazlı). Trend/spark yok
// (zaman-serisi geçmiş ister); frontend onları temsili tutar.
export interface MarketSplitItemDTO { code: string; name: string; valueEur: number }
export interface WeeklyTrendsDTO {
  weeks: string[];          // 'W14' … (son 12 ISO haftası)
  pipelineEur: number[];
  activeLeads: number[];
  meetings: number[];
  closedWonEur: number[];
}

export interface LeadSourceItemDTO { name: string; value: number }

export interface DashboardSummaryDTO {
  activeLeads: number;
  pipelineValueEur: number;
  closedWonEur: number;
  proposalsActive: number;
  meetingsThisWeek: number;
  marketSplit: MarketSplitItemDTO[];
  trends: WeeklyTrendsDTO;
  leadSources: LeadSourceItemDTO[];
}

// GET /api/financials/summary?timeframe=Q1|Q2|YTD|1Y — gerçek aggregate (EUR).
// Kaynak: deals(status='won') = ciro; financials(type='commission',status='paid') = komisyon.
export type FinancialsTimeframe = 'Q1' | 'Q2' | 'YTD' | '1Y';
export interface FinancialsSplitItemDTO { code: string; name: string; valueEur: number }
export interface FinancialsProjectItemDTO { name: string; valueEur: number }
export interface FinancialsMonthlyItemDTO { month: string; valueEur: number }
export interface FinancialsSummaryDTO {
  kpis: {
    totalRevenueEur: number; totalRevenueDeltaPct: number | null;
    totalSales: number; totalSalesDeltaPct: number | null;
    conversionRatePct: number; conversionRateDeltaPct: number | null;
    avgDealSizeEur: number; avgDealSizeDeltaPct: number | null;
    commissionEarnedEur: number; commissionEarnedDeltaPct: number | null;
  };
  targets: {
    monthlyLeads: { actual: number; target: number };
    monthlySales: { actual: number; target: number };
    monthlyRevenueEur: { actual: number; target: number };
    yearlyRevenueEur: { actual: number; target: number };
  };
  monthlyRevenue: FinancialsMonthlyItemDTO[];
  salesByMarket: FinancialsSplitItemDTO[];
  salesByProject: FinancialsProjectItemDTO[];
  saleTypeSplit: FinancialsSplitItemDTO[];
  purposeSplit: FinancialsSplitItemDTO[];
}

// =====================================================================
// Marketing — GET /api/marketing/summary + kampanya (ad_spend) CRUD.
// Harcama/gösterim/tıklama ad_spend'den (elle/CSV); funnel/CPL/ROAS gerçek
// CRM'den. Atıf (CTWA) olmayan kampanya alanları null → UI "—".
// =====================================================================
export type MarketingTimeframe = '30D' | '90D' | 'YTD' | '1Y';

export interface MarketingCampaignDTO {
  id: string;
  name: string;
  market: string | null;
  status: 'active' | 'paused';
  spendEur: number;
  leads: number | null;
  qualified: number | null;
  cpl: number | null;
  closed: number | null;
  roas: number | null;
  attributed: boolean;
}

export interface MarketingConversationDTO {
  id: string;
  name: string;
  market: string | null;
  channel: string | null;
  snippet: string | null;
  score: number | null;
  lastActivityAt: string | null;
}

export interface MarketingSummaryDTO {
  hasSpendData: boolean;
  kpis: {
    adSpendEur: number; adSpendDeltaPct: number | null;
    avgCplEur: number | null; avgCplDeltaPct: number | null;
    convQualifiedPct: number; convQualifiedDeltaPct: number | null;
    roas: number | null; roasDeltaPct: number | null;
    spendSpark: number[]; cplSpark: number[]; qualifiedSpark: number[]; roasSpark: number[];
  };
  funnel: {
    impressions: number; ctwaClicks: number; conversations: number;
    qualified: number; meetings: number; closedWon: number;
  };
  weeklySpendCpl: { label: string; spendEur: number; cpl: number | null }[];
  spendByMarket: FinancialsSplitItemDTO[];
  campaigns: MarketingCampaignDTO[];
  conversations: MarketingConversationDTO[];
}

// =====================================================================
// Proje Girişi (intake) — davet linkleri + onay kuyruğu.
// =====================================================================
export interface ProjectInviteDTO {
  id: string;
  developerId: string | null;
  developerName: string | null;
  label: string | null;
  url: string;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  status: 'active' | 'revoked' | 'expired' | 'exhausted';
  createdAt: string;
}

export interface CreateInviteInput {
  developerId?: string;
  label?: string;
  expiresInDays?: number;
  maxUses?: number;
}

export interface ProjectSubmissionDTO {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  title: string;
  developerName: string | null;
  city: string | null;
  district: string | null;
  marketCode: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  commissionPct: number | null;
  unitTypes: string[];
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
  imageUrls: string[];
  imagesByCategory: Record<string, string[]>;
  downPaymentPct: number | null;
  installmentMonths: number | null;
  paymentNote: string | null;
  brochureUrl: string | null;
  createdPropertyId: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface PublicInviteInfoDTO {
  valid: boolean;
  developerName: string | null;
  label: string | null;
}

// ad_spend yönetim satırı (GET /api/marketing/campaigns, POST/PATCH).
export interface AdCampaignDTO {
  id: string;
  name: string;
  campaignRef: string | null;
  marketCode: string | null;
  channel: string;
  status: 'active' | 'paused';
  periodStart: string;
  periodEnd: string;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
}

export interface CreateAdSpendInput {
  name: string;
  campaignRef?: string;
  marketCode?: string;
  channel?: string;
  status?: string;
  periodStart: string;
  periodEnd: string;
  spend: number;
  currency?: string;
  impressions?: number;
  clicks?: number;
}

// GET/PATCH /api/admin/branding — tenant-seviyesi marka/komisyon ayarları.
export interface BrandingSettingsDTO {
  companyName: string;
  websiteUrl: string;
  primaryColor: string;
  logoUrl: string;
  offPlanCommissionPct: number;
  secondaryCommissionPct: number;
}

export type UpdateBrandingInput = Partial<BrandingSettingsDTO>;

// GET /api/admin/team, /api/admin/team/:id — ekip performans özeti (gerçek veri).
export interface TeamMemberDTO {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  lastActiveAt: string | null;
  clientsRegistered: number;
}
export interface RoleOptionDTO { key: string; name: string }
export interface UpdateTeamMemberInput { roleKey?: string; isActive?: boolean }
export interface CreateTeamMemberInput { fullName: string; email: string; roleKey: string; phone?: string }
export interface CreateTeamMemberResult { member: TeamMemberDTO; tempPassword: string }
export interface PipelineBucketDTO { key: string; count: number }
export interface PipelineClientDTO {
  id: string; bucket: string; name: string; interest: string | null;
  date: string; reason: string | null;
}
export interface TransactionRowDTO {
  id: string; property: string; client: string; amount: number; currency: string;
  status: 'open' | 'won' | 'lost';
}
export interface TimelineEntryDTO { id: string; occurredAt: string; label: string; entityType: string }
export interface UserDetailDTO {
  id: string; name: string; role: string; isActive: boolean;
  kpis: {
    salesVolumeEur: number; commissionEur: number; activeDeals: number; conversionRatePct: number;
  };
  pipeline: PipelineBucketDTO[];
  pipelineClients: PipelineClientDTO[];
  transactions: TransactionRowDTO[];
  timeline: TimelineEntryDTO[];
}

export interface KPIDTO {
  id: string;
  title: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  percentage: number;
}

// Backend lead_status enum (8 değer) — dondurulmuş 9-aşamalı Kanban buna hizalandı (Faz 1 kararı).
// 'frozen' (002i): welcome takibi de yanıtsız kalan lead — otomasyon atar, elle de seçilebilir.
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'unqualified'
  | 'nurturing'
  | 'converted'
  | 'lost'
  | 'frozen';

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LeadInterest = 'buy' | 'rent' | 'sell' | 'invest';

// GET /api/leads sözleşmesi — backend LeadResponse ile elle senkron (OV-8).
// Alan adları/tipleri backend dto/lead-response.dto.ts ile birebir eşleşmeli.
export interface LeadDTO {
  id: string;
  contactId: string;
  contactName: string;
  company: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  interestType: LeadInterest;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  targetMarketCode: string | null;
  score: number | null; // 0..100 qualification skoru
  ownerId: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// GET /api/leads/:id/communications sözleşmesi — backend LeadCommunicationResponse ile senkron.
export interface LeadCommunicationDTO {
  id: string;
  channel: 'whatsapp' | 'email' | 'phone' | 'sms' | 'telegram';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string | null;
  sentAt: string | null;
  handledBy: string | null;
}

// GET /api/leads/:id/scores sözleşmesi — backend LeadScoreResponse ile senkron.
export interface LeadScoreDTO {
  id: string;
  score: number;
  reasoning: string | null;
  signals: Record<string, unknown>;
  source: 'manual' | 'n8n_ai';
  createdAt: string;
  createdBy: string | null;
}

// GET/POST /api/contacts sözleşmesi — backend ContactResponse ile senkron (OV-8).
export interface ContactDTO {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  preferredLang: string;
  marketingConsent: boolean;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDTO {
  id: string;
  clientId: string;
  name: string;
  type: 'Individual' | 'Corporate' | 'VIP';
  nationality: string;
  email: string;
  phone: string;
  totalInvestment: number;
  activeProperties: number;
  preferredRegions: string[];
  investmentProfile: 'Conservative' | 'Balanced' | 'Aggressive';
  source: string;
  relationshipStatus: 'Active' | 'Dormant' | 'Churned';
  assignedConsultant: string;
  lastContactDate: string;
  /* Yatırım kriterleri (opsiyonel — manuel giriş VEYA Eylül'ün konuşma çıkarımı) */
  unitTypes?: string[];              // aranan daire tipleri: Studio, 1+1, 2+1...
  purpose?: string;                  // 'Investment' vb. veya Eylül'ün serbest metni ('kira getirisi')
  budgetRange?: string;              // örn. '€1.5M – €3.0M' veya '2.500.000 – 3.200.000 AED'
  requirements?: string;             // özel talepler: deniz manzarası, yüksek kat...
  /* Durum bayrakları + kaynak (gerçek backend üretir; mock'ta opsiyonel) */
  welcomeEmailSentAt?: string | null; // null = hoş geldiniz maili gönderilmedi
  aiScore?: number | null;            // son lead skoru (Eylül/RAG)
  profileSource?: 'manual' | 'eylul' | null; // kriterlerin kaynağı
}

/** AI Analiz raporu (n8n analiz workflow'u üretir, meeting_notes'ta saklanır). */
export interface ClientAnalysisDTO {
  id: string;
  subject: string;
  report: string;    // düz metin (Özet:/Profil:/Sinyaller:... bölümleri)
  createdAt: string;
}

export interface ClientNoteDTO {
  id: string;
  author: string;
  role: string;
  tag: 'Meeting' | 'Call' | 'General';
  createdAt: string;
  text: string;
}

export interface ClientTimelineEntryDTO {
  id: string;
  kind: 'email' | 'call' | 'whatsapp' | 'telegram' | 'sms';
  title: string;
  body: string;
  time: string;
  score?: number;
}

export interface DocumentDTO {
  id: string;
  title: string;
  type: 'PDF' | 'Image' | 'Spreadsheet';
  size: string;
}

export interface PaymentPlanDTO {
  milestone: string;
  percentage: number;
  date: string;
}

export interface ProjectDTO {
  id: string;
  developerId: string;
  developerName: string;
  name: string;
  location: string;
  status: 'Off-plan' | 'Under Construction' | 'Completed';
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
  paymentPlan: PaymentPlanDTO[];
  documents: DocumentDTO[];
}

export interface CreateProjectInput {
  title: string;
  developerId?: string;
  status?: 'Off-plan' | 'Under Construction' | 'Completed';
  city?: string;
  district?: string;
  description?: string;
  price?: number;
  currency?: string;
  completionDate?: string;
  totalUnits?: number;
  availableUnits?: number;
  paymentPlan?: PaymentPlanDTO[];
  amenities?: string[];
}

export interface DeveloperDTO {
  id: string;
  name: string;
  tier: 'Tier 1' | 'Tier 2' | 'Boutique';
  headquarters: string;
  activeProjects: number;
  totalCompletedProjects: number;
  partnershipStatus: 'Active' | 'Negotiating' | 'Inactive';
  commissionRate: string;
  keyContactName: string;
  keyContactEmail: string;
  keyContactPhone: string;
  website: string;
  projects: ProjectDTO[];
}

export interface CreateDeveloperInput {
  name: string;
  tier?: DeveloperDTO['tier'];
  headquarters?: string;
  partnershipStatus?: DeveloperDTO['partnershipStatus'];
  commissionRate?: string;
  keyContactName?: string;
  keyContactEmail?: string;
  keyContactPhone?: string;
  website?: string;
}

export type UpdateDeveloperInput = Partial<CreateDeveloperInput>;

export interface ProposalDTO {
  id: string;
  title: string;
  clientName: string;
  projectName: string;
  status: 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Rejected';
  projectLocation?: string;
  totalValue: number;
  currency: string;
  createdAt: string;
  lastViewed?: string;
  viewCount: number;
  paymentPlan?: PaymentPlanDTO[];
  includeBrochurePdf?: boolean;
  includeFloorPlans?: boolean;
  includeRoiSheet?: boolean;
  coverImage?: string;
}

export interface CreateProposalInput {
  title: string;
  contactId: string;
  propertyId?: string;
  totalValue?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

// GET /api/contracts sözleşmesi — backend ContractResponse ile senkron (OV-8).
export type ContractStatus = 'Draft' | 'Active' | 'Expiring' | 'Expired' | 'Terminated' | 'Renewed';
export interface ContractDocRef { id: string; name: string; size: string }
export interface ContractDTO {
  id: string;
  developer: string;
  project: string;
  status: ContractStatus;
  contractType: string;
  startDate: string | null;
  expiryDate: string | null;
  commission: string;
  legalEntity: string;
  paymentTerms: string;
  amount: number | null;
  currency: string;
  documents: ContractDocRef[];
}

// GET /api/meetings sözleşmesi — backend MeetingResponse ile senkron (OV-8).
// Kaynak: tasks(task_type='meeting'); toplantıya özgü alanlar metadata'dan.
export interface MeetingDTO {
  id: string;
  title: string;
  date: string | null;    // ISO (due_date)
  durationLabel: string;
  client: string;
  location: string;
  platform: string;
  notes: string;
  kind: string;           // viewing | signing | meeting
}

export interface CreateMeetingInput {
  title: string;
  date: string;           // ISO
  durationLabel?: string;
  client?: string;
  location?: string;
  platform?: 'In-person' | 'Zoom';
  notes?: string;
  kind?: 'meeting' | 'viewing' | 'signing';
}

export interface VaultDocumentDTO {
  id: string;
  name: string;
  folder: 'Client KYC' | 'Contracts' | 'Marketing' | 'Developer Agreements' | 'Root';
  type: 'pdf' | 'image' | 'excel' | 'word' | 'other';
  sizeMB: number;
  uploadedAt: string;
  uploadedBy: string;
  relatedId?: string;
}

// GET /api/gmail/threads, /api/gmail/threads/:id sözleşmesi — backend
// server/src/modules/gmail/dto/email.dto.ts ile senkron.
export interface ContactMatchDTO {
  contactId: string;
  type: 'lead' | 'client';
  name: string;
}

export interface ThreadSummaryDTO {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  snippet: string;
  date: string;
  unread: boolean;
  contact: ContactMatchDTO | null;
}

export interface EmailMessageDTO {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string[];
  subject: string;
  date: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string | null;
}

export interface ThreadDetailDTO {
  id: string;
  subject: string;
  contact: ContactMatchDTO | null;
  messages: EmailMessageDTO[];
}

export interface EmailAttachmentInput {
  filename: string;
  mimeType: string;
  dataBase64: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments?: EmailAttachmentInput[];
  threadId?: string;
  inReplyTo?: string;
  recipientName?: string;
}

export interface AuditLogDTO {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress: string;
  status: 'Success' | 'Failed' | 'Warning';
}

// Rol seti permissions.ts'te tanımlı (legacy mock + gerçek backend rolleri).
import type { Role } from '../auth/permissions';

export interface UserDTO {
  id: string;
  name: string;
  role: Role;
  avatar: string;
  email?: string;
}

export interface LoginResponse {
  token: string;
  user: UserDTO;
}

// GET /api/me yanıtı (gerçek auth modu)
export interface MeResponse {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  tenantId: string;
  jobTitle: string | null;
  aboutMe: string | null;
  theme: 'light' | 'dark' | 'system';
  locale: string | null;
  timezone: string;
  notificationPrefs: Record<string, boolean>;
}

export interface GoogleOAuthStatus {
  connected: boolean;
  email: string | null;
}

export interface UpdateMeInput {
  fullName?: string;
  jobTitle?: string;
  phone?: string;
  aboutMe?: string;
  theme?: 'light' | 'dark' | 'system';
  locale?: 'en' | 'tr';
  timezone?: string;
  notificationPrefs?: Record<string, boolean>;
}

export interface TaskDTO {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  assigneeId: string;
  relatedEntity?: { type: 'Lead' | 'Client' | 'Project'; name: string; id: string };
  type: 'Task' | 'Meeting';
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'High' | 'Medium' | 'Low';
  assigneeId?: string;
}
