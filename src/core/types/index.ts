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

export interface KPIDTO {
  id: string;
  title: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  percentage: number;
}

export interface LeadDTO {
  id: string;
  name: string;
  company: string;
  status:
    | 'New Lead'
    | 'Contacted'
    | 'Qualified'
    | 'Meeting Scheduled'
    | 'Proposal Sent'
    | 'Negotiation'
    | 'Reservation'
    | 'Closed Won'
    | 'Closed Lost';
  value: number;
  probability: number;
  aiRiskScore: 'Low' | 'Medium' | 'High';
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

export interface UserDTO {
  id: string;
  name: string;
  role: 'Admin' | 'Consultant' | 'Manager';
  avatar: string;
  email?: string;
}

export interface LoginResponse {
  token: string;
  user: UserDTO;
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
