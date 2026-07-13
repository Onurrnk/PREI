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
export interface DashboardSummaryDTO {
  activeLeads: number;
  pipelineValueEur: number;
  closedWonEur: number;
  proposalsActive: number;
  meetingsThisWeek: number;
  marketSplit: MarketSplitItemDTO[];
}

export interface KPIDTO {
  id: string;
  title: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  percentage: number;
}

// Backend lead_status enum (7 değer) — dondurulmuş 9-aşamalı Kanban buna hizalandı (Faz 1 kararı).
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'unqualified'
  | 'nurturing'
  | 'converted'
  | 'lost';

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
  channel: 'whatsapp' | 'email' | 'phone' | 'sms';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string | null;
  sentAt: string | null;
  handledBy: string | null;
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
  /* Yatırım kriterleri (opsiyonel — gerçek backend'de contacts.metadata'ya eşlenir) */
  unitTypes?: string[];              // aranan daire tipleri: Studio, 1+1, 2+1...
  purpose?: 'Investment' | 'End-use' | 'Golden Visa' | 'Relocation';
  budgetRange?: string;              // örn. '€1.5M – €3.0M'
  requirements?: string;             // özel talepler: deniz manzarası, yüksek kat...
}

export interface ClientNoteDTO {
  id: string;
  author: string;
  role: string;
  tag: 'Meeting' | 'Call' | 'General';
  createdAt: string;
  text: string;
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

export interface ProposalDTO {
  id: string;
  title: string;
  clientName: string;
  projectName: string;
  status: 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Rejected';
  totalValue: number;
  createdAt: string;
  lastViewed?: string;
  viewCount: number;
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

export interface VaultDocumentDTO {
  id: string;
  name: string;
  folder: 'Client KYC' | 'Contracts' | 'Marketing' | 'Developer Agreements' | 'Root';
  type: 'pdf' | 'image' | 'excel' | 'word';
  sizeMB: number;
  uploadedAt: string;
  uploadedBy: string;
  relatedId?: string;
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
  role: Role;
  tenantId: string;
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
