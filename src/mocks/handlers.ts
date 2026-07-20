import { http, HttpResponse } from 'msw';
import { computeRoi } from '../features/proposals/roi';
import type {
  ClientNoteDTO,
  ClientTimelineEntryDTO,
  ActivityDTO,
  BrandingSettingsDTO,
  UpdateBrandingInput,
  GoogleOAuthStatus,
  KPIDTO,
  LeadCommunicationDTO,
  LeadDTO,
  LeadScoreDTO,
  ClientDTO,
  ContactDTO,
  ContractDTO,
  ContractWriteInput,
  CreateDeveloperInput,
  CreateMeetingInput,
  CreateProjectInput,
  CreateProposalInput,
  CreateTaskInput,
  DashboardSummaryDTO,
  FinancialsSummaryDTO,
  MarketingSummaryDTO,
  AdCampaignDTO,
  CreateAdSpendInput,
  MeetingDTO,
  MeResponse,
  TeamMemberDTO,
  RoleOptionDTO,
  UpdateTeamMemberInput,
  CreateTeamMemberInput,
  CreateTeamMemberResult,
  UserDetailDTO,
  ProjectDTO,
  DeveloperDTO,
  ProposalDTO,
  ProposalRoiInputs,
  UpdateDeveloperInput,
  UpdateMeInput,
  VaultDocumentDTO,
  AuditLogDTO,
  UserDTO,
  TaskDTO,
  ThreadDetailDTO,
  ThreadSummaryDTO,
} from '../core/types';

// Re-export domain types for backward compatibility. The canonical source
// of truth now lives in src/core/types. New code should import from there.
export type * from '../core/types';

const mkLead = (o: Partial<LeadDTO> & Pick<LeadDTO, 'id' | 'contactName' | 'status'>): LeadDTO => ({
  contactId: o.id, company: null, priority: 'medium', interestType: 'buy',
  budgetMin: null, budgetMax: null, currency: 'EUR', targetMarketCode: null,
  score: null, ownerId: null, notes: null, version: 1,
  createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-15T00:00:00Z', ...o,
});

// Şekil, gerçek API sözleşmesi (LeadResponse) ile birebir — mock↔API kayması
// derleme anında yakalanır (OV-8). Çok pazarlı gerçekçi set.
const mockLeads: LeadDTO[] = [
  mkLead({ id: '1', contactName: 'Stefan Brandt', company: 'Nordwind Capital', status: 'new', budgetMax: 1500000, currency: 'EUR', targetMarketCode: 'ES', interestType: 'invest', score: 30 }),
  mkLead({ id: '2', contactName: 'Sarah Ahmed', company: 'Emirates Corp', status: 'contacted', budgetMax: 3200000, currency: 'AED', targetMarketCode: 'AE', interestType: 'buy', score: 71 }),
  mkLead({ id: '3', contactName: 'Edward Langley', company: 'InvestUK', status: 'qualified', budgetMax: 850000, currency: 'GBP', targetMarketCode: 'GB', interestType: 'buy', score: 62 }),
  mkLead({ id: '4', contactName: 'Elena Rossi', company: 'Rossi Group', status: 'nurturing', budgetMax: 4500000, currency: 'EUR', targetMarketCode: 'ES', interestType: 'invest', score: 74 }),
  mkLead({ id: '5', contactName: 'Ahmet Yılmaz', company: 'Yılmaz Holding', status: 'converted', budgetMax: 2100000, currency: 'TRY', targetMarketCode: 'TR', interestType: 'buy', score: 88 }),
];

// leadId → geçmiş — yalnız 2 lead'de örnek veri var (gerçek DB'de communications
// tablosu boş; agent ingest WhatsApp API onayı bekliyor — B-5). Diğer lead'lerde
// boş durum kasıtlı: "veri yok" ile "veri var ama gösterilmiyor" farkı net olsun.
const mockCommunicationsByLead: Record<string, LeadCommunicationDTO[]> = {
  '2': [
    { id: 'c1', channel: 'whatsapp', direction: 'inbound', subject: null, body: 'Merhaba, Dubai Marina bölgesinde 3+1 daire arıyorum, bütçem 3-3.5M AED civarı.', sentAt: '2026-06-20T09:14:00Z', handledBy: null },
    { id: 'c2', channel: 'whatsapp', direction: 'outbound', subject: null, body: 'Merhaba Sarah, birkaç seçenek hazırlıyorum. Peşinat oranı ve teslim tarihi tercihiniz var mı?', sentAt: '2026-06-20T09:22:00Z', handledBy: 'Onur Nazım Karataş' },
    { id: 'c3', channel: 'whatsapp', direction: 'inbound', subject: null, body: 'Peşinat %30 civarı olabilir, 2027 teslim tercih ederim.', sentAt: '2026-06-20T09:30:00Z', handledBy: null },
    { id: 'c4', channel: 'phone', direction: 'outbound', subject: 'Tanışma görüşmesi', body: '15 dakikalık ön görüşme — Emirates Corp adına kurumsal yatırım, 2. mülk. Golden Visa hedefi teyit edildi.', sentAt: '2026-06-21T13:00:00Z', handledBy: 'Onur Nazım Karataş' },
  ],
  '4': [
    { id: 'c5', channel: 'email', direction: 'inbound', subject: 'İspanya yatırım fırsatları', body: 'Merhaba, Rossi Group adına Costa del Sol bölgesinde çoklu ünite yatırımı değerlendiriyoruz.', sentAt: '2026-06-18T11:00:00Z', handledBy: null },
    { id: 'c6', channel: 'email', direction: 'outbound', subject: 'Re: İspanya yatırım fırsatları', body: 'Merhaba Elena, ekte 3 proje özeti bulunuyor. Uygun olduğunuzda görüşme ayarlayalım.', sentAt: '2026-06-18T15:40:00Z', handledBy: 'Onur Nazım Karataş' },
  ],
};

// leadId → skor geçmişi — yalnız lead '2'de gerçek n8n_ai örneği var (diğerlerinde
// leads.score hâlâ eski manuel demo değeri; LeadProfile bu durumda dürüst "manuel" uyarısını gösterir).
const mockScoresByLead: Record<string, LeadScoreDTO[]> = {
  '2': [
    { id: 's2', score: 71, source: 'n8n_ai', createdAt: '2026-06-21T16:10:00Z', createdBy: 'Eylül (WhatsApp Agent)',
      reasoning: 'Telefon görüşmesinde kurumsal alım (Emirates Corp adına 2. mülk) ve Golden Visa hedefi teyit edildi — bu ikisi birlikte güçlü satın alma niyeti gösteriyor. Peşinat oranı (%30) ve teslim tarihi (2027) netleşti, bütçeyle uyumlu envanter mevcut.',
      signals: { budget_clarity: 'high', corporate_buyer: true, urgency_signal: 'golden_visa_deadline' } },
    { id: 's1', score: 52, source: 'n8n_ai', createdAt: '2026-06-20T09:35:00Z', createdBy: 'Eylül (WhatsApp Agent)',
      reasoning: 'Bütçe net (3-3.5M AED) ve bölge tercihi belirgin (Dubai Marina, 3+1). Ancak henüz tek taraflı ilgi — aciliyet sinyali yok.',
      signals: { budget_clarity: 'high', urgency_signal: 'none' } },
  ],
};

const mockTeam: TeamMemberDTO[] = [
  { id: 'u1', name: 'Onur N. Karataş', role: 'super_admin', isActive: true, lastActiveAt: new Date().toISOString(), clientsRegistered: 9 },
  { id: 'u2', name: 'Selin Yıldız', role: 'consultant', isActive: true, lastActiveAt: null, clientsRegistered: 0 },
  { id: 'u3', name: 'Marco Bianchi', role: 'consultant', isActive: true, lastActiveAt: null, clientsRegistered: 0 },
];

let mockProposals: ProposalDTO[] = [
  {
    id: 'prop1', title: 'Beachfront Residences - 3BR Pitch', clientName: 'Oliver Hartwell', projectName: 'Beachfront Residences',
    projectLocation: 'Dubai Marina, Dubai', status: 'Sent', totalValue: 2800000, currency: 'USD', createdAt: '2026-06-15', viewCount: 0,
    paymentPlan: [
      { milestone: 'Down Payment', percentage: 20, date: 'On Booking' },
      { milestone: 'During Construction', percentage: 40, date: 'Across 2 Years' },
      { milestone: 'On Handover', percentage: 40, date: 'Q4 2027' },
    ],
    includeBrochurePdf: true, includeFloorPlans: true,
  },
  { id: 'prop2', title: 'Downtown Heights - Penthouse Offer', clientName: 'Sarah Ahmed', projectName: 'Downtown Heights', status: 'Viewed', totalValue: 4200000, currency: 'USD', createdAt: '2026-06-14', lastViewed: '2026-06-16T10:30:00Z', viewCount: 3 },
  { id: 'prop3', title: 'DAMAC Hills - Villa 45', clientName: 'Mohammed Al Fayed', projectName: 'DAMAC Hills Villas', status: 'Accepted', totalValue: 3800000, currency: 'USD', createdAt: '2026-06-10', lastViewed: '2026-06-12T14:15:00Z', viewCount: 5 },
  { id: 'prop4', title: 'Belmont Investment Portfolio', clientName: 'Carmen Ortega', projectName: 'Belmont Residences', status: 'Draft', totalValue: 1200000, currency: 'EUR', createdAt: '2026-06-16', viewCount: 0 }
];

const mockVaultDocuments: VaultDocumentDTO[] = [
  { id: 'doc1', name: 'Oliver_Hartwell_Passport.pdf', folder: 'Client KYC', type: 'pdf', sizeMB: 2.4, uploadedAt: '2026-06-15', uploadedBy: 'Elif Şahin' },
  { id: 'doc2', name: 'Beachfront_Brochure_V2.pdf', folder: 'Marketing', type: 'pdf', sizeMB: 15.6, uploadedAt: '2026-06-10', uploadedBy: 'Marketing Team' },
  { id: 'doc3', name: 'SPA_Template_Emaar.word', folder: 'Contracts', type: 'word', sizeMB: 1.1, uploadedAt: '2026-06-01', uploadedBy: 'Legal Dept', relatedId: 'C-1001' },
  { id: 'doc4', name: 'Downtown_Heights_Floorplans.pdf', folder: 'Marketing', type: 'pdf', sizeMB: 8.2, uploadedAt: '2026-05-20', uploadedBy: 'Elif Şahin' },
  { id: 'doc5', name: 'MOU_Sarah_Ahmed_Signed.pdf', folder: 'Contracts', type: 'pdf', sizeMB: 4.5, uploadedAt: '2026-06-14', uploadedBy: 'Elif Şahin', relatedId: 'C-1002' },
  { id: 'doc6', name: 'ROI_Calculator_2026.xlsx', folder: 'Root', type: 'excel', sizeMB: 0.5, uploadedAt: '2026-01-10', uploadedBy: 'Finance' },
  { id: 'doc7', name: 'Beachfront_Brochure.pdf', folder: 'Marketing', type: 'pdf', sizeMB: 12, uploadedAt: '2026-06-01', uploadedBy: 'Marketing Team', relatedId: 'p1' },
  { id: 'doc8', name: 'Villa_Layouts.pdf', folder: 'Marketing', type: 'pdf', sizeMB: 10, uploadedAt: '2026-05-15', uploadedBy: 'Marketing Team', relatedId: 'p3' },
];

// Sözleşmeler — module-level, oturum-içi kalıcı (create/update mock modda görünür).
let mockContracts: ContractDTO[] = [
  { id: 'C-1001', developer: 'Emaar Properties', project: 'Downtown Views II', status: 'Active', contractType: 'pm', startDate: '2025-01-01', expiryDate: '2026-12-31', commission: '5%', legalEntity: 'Emaar Development PJSC', paymentTerms: '30 Days Net', amount: null, currency: 'AED', propertyId: null, contactId: null, documents: [] },
  { id: 'C-1002', developer: 'Nakheel', project: 'Palm Beach Towers', status: 'Active', contractType: 'pm', startDate: '2025-06-15', expiryDate: '2027-06-14', commission: '4%', legalEntity: 'Nakheel PJSC', paymentTerms: '45 Days Net', amount: null, currency: 'AED', propertyId: null, contactId: null, documents: [] },
  { id: 'C-1003', developer: 'Damac Properties', project: 'Damac Hills', status: 'Expiring', contractType: 'pm', startDate: '2024-08-01', expiryDate: '2026-08-20', commission: '6%', legalEntity: 'Damac Real Estate Dev.', paymentTerms: '15 Days Net', amount: null, currency: 'AED', propertyId: null, contactId: null, documents: [] },
  { id: 'C-1004', developer: 'Meraas', project: 'City Walk', status: 'Expired', contractType: 'pm', startDate: '2024-01-01', expiryDate: '2026-01-01', commission: '5%', legalEntity: 'Meraas Holding', paymentTerms: '30 Days Net', amount: null, currency: 'AED', propertyId: null, contactId: null, documents: [] },
];

// Mock modda Gmail thread'leri — module-level, mockThreads'e gönderilen
// mesajlar oturum içinde kalıcı (gerçek modda server/src/modules/gmail).
const mockThreads: ThreadDetailDTO[] = [
  {
    id: 't1',
    subject: 'Re: Dubai Marina Off-plan Projects',
    contact: { contactId: '1', type: 'client', name: 'Oliver Hartwell' },
    messages: [
      {
        id: 'm1', threadId: 't1', from: 'Oliver Hartwell', fromEmail: 'oliver.hartwell@example.com',
        to: ['info@produality.com'], subject: 'Re: Dubai Marina Off-plan Projects',
        date: '2026-06-16T10:45:00Z', snippet: 'Thanks for the PDF. I am interested in the 2BR options...',
        bodyText: "Hello,\n\nThanks for sending over the PDF with the latest off-plan projects in Dubai Marina.\n\nI've reviewed the options and I'm particularly interested in the 2-bedroom apartments in the EMAAR Beachfront development. Could you please send me the specific payment plans for those?\n\nAlso, let me know when we can schedule a quick call to discuss the expected ROI.\n\nBest regards,\nOliver Hartwell",
        bodyHtml: null,
      },
    ],
  },
  {
    id: 't2',
    subject: 'Property Portfolio Update',
    contact: { contactId: '1', type: 'client', name: 'Oliver Hartwell' },
    messages: [
      {
        id: 'm2', threadId: 't2', from: 'ProDuality Advisory', fromEmail: 'info@produality.com',
        to: ['oliver.hartwell@example.com'], subject: 'Property Portfolio Update',
        date: '2026-06-15T09:00:00Z', snippet: 'Please find attached the latest portfolio options tailored to your profile.',
        bodyText: 'Dear Oliver,\n\nPlease find attached the latest portfolio options tailored to your investment profile: 4 units across Dubai Marina and Downtown, all within your stated budget range.\n\nTwo of them include a 60/40 construction-linked payment plan, which matches the structure you preferred in our last call.\n\nHappy to walk you through the comparison whenever suits you.\n\nKind regards,\nProDuality Advisory',
        bodyHtml: null,
      },
    ],
  },
  {
    id: 't3',
    subject: 'Initial Consultation Follow-up',
    contact: { contactId: '1', type: 'client', name: 'Oliver Hartwell' },
    messages: [
      {
        id: 'm3', threadId: 't3', from: 'ProDuality Advisory', fromEmail: 'info@produality.com',
        to: ['oliver.hartwell@example.com'], subject: 'Initial Consultation Follow-up',
        date: '2026-06-04T09:00:00Z', snippet: 'It was great speaking with you today regarding your investment goals...',
        bodyText: 'Dear Oliver,\n\nIt was great speaking with you today regarding your investment goals in the Gulf region.\n\nAs discussed, I will prepare a shortlist focused on 2BR waterfront units with strong rental yield history, and share it before the end of the week.\n\nKind regards,\nProDuality Advisory',
        bodyHtml: null,
      },
    ],
  },
];

const mockAuditLogs: AuditLogDTO[] = [
  { id: 'al1', actor: 'Elif Şahin', action: 'Downloaded Document', resource: 'SPA_Template_Emaar.word', timestamp: '2026-06-16T10:45:00Z', ipAddress: '192.168.1.45', status: 'Success' },
  { id: 'al2', actor: 'System', action: 'Nightly Backup', resource: 'DB_Cluster_Primary', timestamp: '2026-06-16T03:00:00Z', ipAddress: '10.0.0.1', status: 'Success' },
  { id: 'al3', actor: 'Daniel Okafor', action: 'Failed Login', resource: 'Admin Portal', timestamp: '2026-06-15T22:15:30Z', ipAddress: '45.22.11.90', status: 'Failed' },
  { id: 'al4', actor: 'Marketing Team', action: 'Sent Proposal', resource: 'prop2', timestamp: '2026-06-15T14:20:00Z', ipAddress: '192.168.1.112', status: 'Success' },
  { id: 'al5', actor: 'Unknown', action: 'Unauthorized API Access', resource: '/api/kpi/dashboard', timestamp: '2026-06-15T09:12:00Z', ipAddress: '188.134.55.2', status: 'Warning' },
  { id: 'al6', actor: 'Elif Şahin', action: 'Created Lead', resource: 'Mohammed Al Fayed', timestamp: '2026-06-14T11:05:00Z', ipAddress: '192.168.1.45', status: 'Success' },
];

export const mockUsers: UserDTO[] = [
  { id: 'u1', name: 'Onur Nazım Karataş', role: 'Admin', email: 'admin@prei.app', avatar: 'https://ui-avatars.com/api/?name=Onur+Karatas&background=0D8ABC&color=fff' },
  { id: 'u2', name: 'Sarah Ahmed', role: 'Consultant', email: 'sarah@prei.app', avatar: 'https://ui-avatars.com/api/?name=Sarah+Ahmed&background=1D9A6C&color=fff' },
  { id: 'u3', name: 'Michael Chen', role: 'Manager', email: 'michael@prei.app', avatar: 'https://ui-avatars.com/api/?name=Michael+Chen&background=F4A261&color=fff' },
  { id: 'u4', name: 'Elif Şahin', role: 'Consultant', email: 'elif@prei.app', avatar: 'https://ui-avatars.com/api/?name=Elif+Sahin&background=E76F51&color=fff' },
];

// GET/PATCH /api/me — module-level: PATCH mutasyonları oturum boyunca kalıcı.
let mockMe: MeResponse = {
  id: 'u1',
  email: 'admin@prei.app',
  name: 'Onur Nazım Karataş',
  phone: '+90 555 123 4567',
  role: 'Admin',
  tenantId: 't1',
  jobTitle: 'Founder & Broker',
  aboutMe: null,
  theme: 'dark',
  locale: 'tr',
  timezone: 'dubai',
  notificationPrefs: { newLead: true, taskDue: true, weeklyReport: true, smsHotLeads: false },
};

// --- Mock auth (token format: "mock-token-<userId>") ---
const tokenFor = (userId: string) => `mock-token-${userId}`;
const userIdFromToken = (auth: string | null): string | null => {
  if (!auth) return null;
  const m = auth.match(/^Bearer mock-token-(.+)$/);
  return m ? m[1] : null;
};

export let mockTasks: TaskDTO[] = [
  { id: 't1', title: 'Prepare Proposal for Downtown Heights', description: 'Draft the initial proposal for Sarah Ahmed focusing on penthouses.', dueDate: '2026-06-21T14:00:00Z', priority: 'High', status: 'In Progress', assigneeId: 'u2', relatedEntity: { type: 'Lead', name: 'Sarah Ahmed', id: '2' }, type: 'Task' },
  { id: 't2', title: 'Follow up with Oliver Hartwell', description: 'Call Oliver regarding the Beachfront Residences documents.', dueDate: '2026-06-20T10:00:00Z', priority: 'Medium', status: 'Pending', assigneeId: 'u2', relatedEntity: { type: 'Client', name: 'Oliver Hartwell', id: '1' }, type: 'Task' },
  { id: 't3', title: 'Weekly Pipeline Review', description: 'Review all new leads and update statuses.', dueDate: '2026-06-22T09:00:00Z', priority: 'High', status: 'Pending', assigneeId: 'u3', type: 'Meeting' },
  { id: 't4', title: 'Send Contract to Elena Rossi', description: 'Finalize the SPA and send it for digital signature.', dueDate: '2026-06-20T16:00:00Z', priority: 'High', status: 'Pending', assigneeId: 'u4', relatedEntity: { type: 'Lead', name: 'Elena Rossi', id: '4' }, type: 'Task' },
  { id: 't5', title: 'Site Visit: DAMAC Hills', description: 'Accompany Mr. Al Fayed to the villa show home.', dueDate: '2026-06-23T11:00:00Z', priority: 'Medium', status: 'Pending', assigneeId: 'u2', relatedEntity: { type: 'Client', name: 'Mohammed Al Fayed', id: '4' }, type: 'Meeting' },
  { id: 't6', title: 'Update Marketing Materials', description: 'Upload new brochures for Belmont Residences to the vault.', dueDate: '2026-06-19T17:00:00Z', priority: 'Low', status: 'Completed', assigneeId: 'u4', relatedEntity: { type: 'Project', name: 'Belmont Residences', id: 'p4' }, type: 'Task' },
];

// İç notlar (meeting_notes mock'u) — module-level: POST oturum içinde kalıcı.
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const mockNotesByClient: Record<string, ClientNoteDTO[]> = {
  '1': [
    {
      id: 'mn2', author: 'Sarah Ahmed', role: 'Senior Consultant', tag: 'Call', createdAt: day(1),
      text: 'Payment plan call (18 min): insists on 60/40 construction-linked. Asked for a Nişantaşı comparison — coordinate with Istanbul desk before sending numbers.',
    },
    {
      id: 'mn1', author: 'Sarah Ahmed', role: 'Senior Consultant', tag: 'Meeting', createdAt: day(3),
      text: 'Marina Vista 2B viewing debrief: strong buy signal. He compared service charges with Downtown; wants SPA draft before Friday. Wife joins the next call — prepare the school-district one-pager.',
    },
  ],
};

// Google OAuth (Gmail entegrasyonu) mock durumu — gerçek akışta connect()
// tam sayfa yönlendirmesiyle (window.location.href) test edilir, bu da JS
// modülünü sıfırlar; modül değişkeni yerine localStorage kullanılır ki
// durum sayfa yenilemesinden sonra da (gerçek Postgres kalıcılığı gibi) ayakta kalsın.
const GOOGLE_CONNECTED_KEY = 'prei_mock_gmail_connected';
const mockGoogleEmail = 'sarah@prei.app';
const isGoogleConnected = (): boolean => localStorage.getItem(GOOGLE_CONNECTED_KEY) === '1';
const setGoogleConnected = (v: boolean): void => {
  if (v) localStorage.setItem(GOOGLE_CONNECTED_KEY, '1');
  else localStorage.removeItem(GOOGLE_CONNECTED_KEY);
};

// İletişim zaman çizelgesi (communications mock'u) — clients.timeline() bu şekle bakar.
const mockTimelineByClient: Record<string, ClientTimelineEntryDTO[]> = {
  '1': [
    { id: 'tl1', kind: 'whatsapp', title: 'WhatsApp message received', body: '"Golden Visa için minimum yatırım tutarını teyit edebilir misiniz?" Score reached 85, Calendly link sent.', time: day(0.02), score: 85 },
    { id: 'tl2', kind: 'email', title: 'Email sent: Property Portfolio Update', body: 'Latest Dubai Marina off-plan portfolio PDF shared (4 units, Q4 2027 handover).', time: day(0.1) },
    { id: 'tl3', kind: 'call', title: 'Call logged: Payment plan review', body: '18 min. Prefers 60/40 construction-linked plan; asked for Nişantaşı comparison.', time: day(1) },
    { id: 'tl4', kind: 'whatsapp', title: 'WhatsApp message received', body: 'Arrived from "Golden Visa · Dubai Off-Plan (TR)" campaign. Eylül opened conversation.', time: day(6), score: 25 },
  ],
};

// Mock müşteri dizini — module-level: PATCH mutasyonları oturum boyunca kalıcı.
const mockClients: ClientDTO[] = [
      {
        id: '1', clientId: 'CL-10024', name: 'Oliver Hartwell', type: 'VIP', nationality: 'UK',
        email: 'o.hartwell@hartwellestates.co.uk', phone: '+44 7700 900077', totalInvestment: 4500000,
        activeProperties: 3, preferredRegions: ['Dubai Marina', 'Downtown Dubai'],
        investmentProfile: 'Balanced', source: 'Referral', relationshipStatus: 'Active',
        assignedConsultant: 'Sarah Ahmed', lastContactDate: '2026-06-15T10:30:00Z',
        unitTypes: ['2+1', '3+1'], purpose: 'Golden Visa', budgetRange: '€1.5M – €3.0M',
        requirements: 'Sea view, high floor, 60/40 construction-linked payment plan; handover by Q4 2027.',
        welcomeEmailSentAt: '2026-06-01T09:00:00Z', aiScore: 88, profileSource: 'manual',
      },
      {
        id: '2', clientId: 'CL-10025', name: 'Carmen Ortega', type: 'Individual', nationality: 'Spain',
        email: 'carmen.ortega@ortegapatrimonio.es', phone: '+34 612 480 375', totalInvestment: 850000,
        activeProperties: 1, preferredRegions: ['JVC', 'Business Bay'],
        investmentProfile: 'Conservative', source: 'Web Lead', relationshipStatus: 'Active',
        assignedConsultant: 'Michael Chen', lastContactDate: '2026-06-10T14:15:00Z',
        unitTypes: ['1+1'], purpose: 'Investment', budgetRange: '€400K – €700K',
        requirements: 'High rental yield focus; furnished preferred, near metro.',
        welcomeEmailSentAt: null, aiScore: 62, profileSource: 'eylul',
      },
      {
        id: '3', clientId: 'CL-10026', name: 'Meridian Gulf Investments', type: 'Corporate', nationality: 'UAE',
        email: 'investments@meridiangulf.ae', phone: '+971 4 332 2111', totalInvestment: 12500000,
        activeProperties: 8, preferredRegions: ['Palm Jumeirah', 'DIFC'],
        investmentProfile: 'Aggressive', source: 'Event', relationshipStatus: 'Active',
        assignedConsultant: 'Onur Nazım Karataş', lastContactDate: '2026-06-16T09:00:00Z',
        unitTypes: ['Penthouse', 'Villa'], purpose: 'Investment', budgetRange: '€8M – €15M',
        requirements: 'Portfolio acquisition; waterfront trophy assets only, off-market access expected.'
      },
      {
        id: '4', clientId: 'CL-10027', name: 'Mohammed Al Fayed', type: 'VIP', nationality: 'KSA',
        email: 'malfayed@invest.sa', phone: '+966 50 123 4567', totalInvestment: 25000000,
        activeProperties: 12, preferredRegions: ['Downtown Dubai', 'Riyadh'],
        investmentProfile: 'Aggressive', source: 'Direct', relationshipStatus: 'Dormant',
        assignedConsultant: 'Sarah Ahmed', lastContactDate: '2026-04-20T11:00:00Z',
        unitTypes: ['4+1+', 'Penthouse'], purpose: 'End-use', budgetRange: '€5M – €12M',
        requirements: 'Family residence + investment mix; branded residences, private pool.'
      },
      {
        id: '5', clientId: 'CL-10028', name: 'Elena Popova', type: 'Individual', nationality: 'Russia',
        email: 'elena.p@mail.ru', phone: '+7 900 123 4567', totalInvestment: 1200000,
        activeProperties: 2, preferredRegions: ['Bluewaters', 'Dubai Marina'],
        investmentProfile: 'Balanced', source: 'Agency', relationshipStatus: 'Active',
        assignedConsultant: 'Michael Chen', lastContactDate: '2026-06-14T16:45:00Z',
        unitTypes: ['Studio', '1+1'], purpose: 'Relocation', budgetRange: '€600K – €1.2M',
        requirements: 'Move-in ready; walking distance to beach, pet-friendly building.'
      },
    ];

// Bu ayın günlerine yerleşen toplantılar (takvim mock modda da dolu görünsün).
const mockMeetingsNow = new Date();
const mockMeetingDay = (d: number, h: number, m = 0) =>
  new Date(mockMeetingsNow.getFullYear(), mockMeetingsNow.getMonth(), d, h, m).toISOString();
let mockMeetings: MeetingDTO[] = [
  { id: 'm1', title: 'Viewing: Marina Vista', date: mockMeetingDay(12, 10), durationLabel: '1h', client: 'Oliver Hartwell', location: 'Marina Vista Tower B', platform: 'In-person', notes: '3BR deniz manzaralı birimlerle ilgileniyor.', kind: 'viewing' },
  { id: 'm2', title: 'Consultation: T. Weber', date: mockMeetingDay(12, 14), durationLabel: '45m', client: 'Tobias Weber', location: 'Zoom', platform: 'Zoom', notes: 'Off-plan yatırım ilk görüşme.', kind: 'meeting' },
  { id: 'm3', title: 'Contract Signing', date: mockMeetingDay(15, 11, 30), durationLabel: '1h', client: 'Carmen Ortega', location: 'Emaar Sales Center', platform: 'In-person', notes: 'Tüm SPA dokümanları hazır olsun.', kind: 'signing' },
  { id: 'm4', title: 'Zoom: Project Pitch', date: mockMeetingDay(22, 16), durationLabel: '1h', client: 'Tobias Weber', location: 'Zoom', platform: 'Zoom', notes: 'Safa Two projesi sunumu.', kind: 'meeting' },
];

let mockBranding: BrandingSettingsDTO = {
  companyName: 'ProDuality Real Estate',
  websiteUrl: 'https://produality.com',
  primaryColor: '#9B5BB3',
  logoUrl: '',
  offPlanCommissionPct: 50,
  secondaryCommissionPct: 60,
};

let mockCampaigns: AdCampaignDTO[] = [
  { id: 'c1', name: 'Golden Visa · Dubai Off-Plan (TR)', campaignRef: '238401', marketCode: 'AE', channel: 'meta', status: 'active', periodStart: '2026-06-20', periodEnd: '2026-07-19', spend: 2_840, currency: 'EUR', impressions: 184_200, clicks: 1_620 },
  { id: 'c3', name: 'İstanbul Yatırım Fırsatları (TR)', campaignRef: null, marketCode: 'TR', channel: 'meta', status: 'active', periodStart: '2026-06-20', periodEnd: '2026-07-19', spend: 1_620, currency: 'EUR', impressions: 96_400, clicks: 880 },
];

const mockDeveloperNames: Record<string, string> = {
  '1': 'Emaar Properties', '2': 'DAMAC Properties', '3': 'Nakheel', '4': 'Ellington Properties', '5': 'Sobha Realty',
};

let mockDevelopers: Omit<DeveloperDTO, 'projects'>[] = [
  {
    id: '1', name: 'Emaar Properties', tier: 'Tier 1', headquarters: 'Dubai', activeProjects: 45, totalCompletedProjects: 120, partnershipStatus: 'Active', commissionRate: '5%',
    keyContactName: 'Ahmed Al Ali', keyContactEmail: 'ahmed@emaar.ae', keyContactPhone: '+971 50 123 4567', website: 'www.emaar.com',
  },
  {
    id: '2', name: 'DAMAC Properties', tier: 'Tier 1', headquarters: 'Dubai', activeProjects: 32, totalCompletedProjects: 85, partnershipStatus: 'Active', commissionRate: '6%',
    keyContactName: 'Sara Khan', keyContactEmail: 'skhan@damac.ae', keyContactPhone: '+971 52 234 5678', website: 'www.damacproperties.com',
  },
  {
    id: '3', name: 'Nakheel', tier: 'Tier 1', headquarters: 'Dubai', activeProjects: 18, totalCompletedProjects: 95, partnershipStatus: 'Negotiating', commissionRate: '4.5%',
    keyContactName: 'Omar Saeed', keyContactEmail: 'omar.s@nakheel.ae', keyContactPhone: '+971 50 888 9900', website: 'www.nakheel.com',
  },
  {
    id: '4', name: 'Ellington Properties', tier: 'Boutique', headquarters: 'Dubai', activeProjects: 12, totalCompletedProjects: 25, partnershipStatus: 'Active', commissionRate: '7%',
    keyContactName: 'David Miller', keyContactEmail: 'david@ellington.ae', keyContactPhone: '+971 58 555 4444', website: 'www.ellingtonproperties.ae',
  },
  {
    id: '5', name: 'Sobha Realty', tier: 'Tier 2', headquarters: 'Dubai', activeProjects: 22, totalCompletedProjects: 40, partnershipStatus: 'Active', commissionRate: '5.5%',
    keyContactName: 'Ravi Menon', keyContactEmail: 'rmenon@sobha.ae', keyContactPhone: '+971 50 777 6655', website: 'www.sobharealty.com',
  },
];

let mockProjects: ProjectDTO[] = ([
  {
    id: 'p1', developerId: '1', developerName: 'Emaar Properties', name: 'Beachfront Residences', location: 'Dubai Marina', status: 'Off-plan',
    totalUnits: 350, availableUnits: 42, startingPrice: 2500000, currency: 'AED', completionDate: 'Q4 2027',
    projectManagerName: 'Tariq Mansour', projectManagerEmail: 'tariq.m@emaar.ae', projectManagerPhone: '+971 55 987 6543',
    description: 'Ultra-luxury waterfront apartments featuring panoramic views of the Arabian Gulf and Dubai Marina skyline. Exclusive private beach access and premium lifestyle amenities.',
    images: ['/images/exterior.png', '/images/interior.png', '/images/amenities.png'],
    amenities: ['Private Beach Access', 'Infinity Pool', 'State-of-the-art Gym', 'Valet Parking', 'Concierge Service'],
    paymentPlan: [
      { milestone: 'Down Payment', percentage: 20, date: 'On Booking' },
      { milestone: 'During Construction', percentage: 40, date: 'Across 2 Years' },
      { milestone: 'On Handover', percentage: 40, date: 'Q4 2027' }
    ],
    documents: []
  },
  {
    id: 'p2', developerId: '1', developerName: 'Emaar Properties', name: 'Downtown Heights', location: 'Downtown Dubai', status: 'Under Construction',
    totalUnits: 200, availableUnits: 15, startingPrice: 4200000, currency: 'AED', completionDate: 'Q2 2026',
    projectManagerName: 'Leila Hassan', projectManagerEmail: 'leila.h@emaar.ae', projectManagerPhone: '+971 50 456 7890',
    description: 'Premium penthouses and apartments steps away from the Burj Khalifa and Dubai Mall. Unrivaled urban luxury.',
    images: ['/images/interior.png', '/images/exterior.png'],
    amenities: ['Burj Khalifa Views', 'Rooftop Lounge', 'Spa', 'Smart Home Integration'],
    paymentPlan: [
      { milestone: 'Down Payment', percentage: 10, date: 'On Booking' },
      { milestone: 'During Construction', percentage: 50, date: 'Monthly' },
      { milestone: 'On Handover', percentage: 40, date: 'Q2 2026' }
    ],
    documents: []
  },
  {
    id: 'p3', developerId: '2', developerName: 'DAMAC Properties', name: 'DAMAC Hills Villas', location: 'DAMAC Hills', status: 'Under Construction',
    totalUnits: 150, availableUnits: 30, startingPrice: 3800000, currency: 'AED', completionDate: 'Q1 2026',
    projectManagerName: 'Faisal Qureshi', projectManagerEmail: 'faisal.q@damac.ae', projectManagerPhone: '+971 56 111 2233',
    description: 'Exclusive golf course villas with Trump International Golf Club access. Luxury family living in a gated community.',
    images: ['/images/exterior.png', '/images/amenities.png'],
    amenities: ['Golf Course Access', 'Private Pool', 'Gated Community', 'Tennis Courts'],
    paymentPlan: [
      { milestone: 'Down Payment', percentage: 20, date: 'On Booking' },
      { milestone: 'During Construction', percentage: 40, date: 'Construction Linked' },
      { milestone: 'On Handover', percentage: 40, date: 'Q1 2026' }
    ],
    documents: []
  },
  {
    id: 'p4', developerId: '4', developerName: 'Ellington Properties', name: 'Belmont Residences', location: 'JVT', status: 'Off-plan',
    totalUnits: 85, availableUnits: 12, startingPrice: 1200000, currency: 'AED', completionDate: 'Q3 2026',
    projectManagerName: 'Elena Rostova', projectManagerEmail: 'elena.r@ellington.ae', projectManagerPhone: '+971 55 444 3322',
    description: 'Boutique apartments designed with a focus on art and aesthetics. Prime location with excellent ROI potential.',
    images: ['/images/interior.png'],
    amenities: ['Resort-style Pool', 'Library', 'Fitness Studio', 'BBQ Area'],
    paymentPlan: [
      { milestone: 'Down Payment', percentage: 20, date: 'On Booking' },
      { milestone: 'During Construction', percentage: 30, date: 'Construction Linked' },
      { milestone: 'On Handover', percentage: 50, date: 'Q3 2026' }
    ],
    documents: []
  }
] as Omit<ProjectDTO, 'lifecycleStatus'>[]).map((p) => ({ ...p, lifecycleStatus: 'active' as const }));

// Teklif oluşturma/güncelleme mock'u — zengin metadata (daire, ROI, liste/
// indirim) alanlarını backend mapper'ıyla aynı şekilde ProposalDTO'ya çıkarır.
function buildMockProposal(
  id: string,
  input: CreateProposalInput,
  existing: ProposalDTO | undefined,
): ProposalDTO {
  const project = mockProjects.find((p) => p.id === input.propertyId);
  const client = mockClients.find((c) => c.id === input.contactId);
  const meta = (input.metadata ?? {}) as Record<string, unknown>;
  const paymentPlan = Array.isArray(meta.paymentPlan) ? (meta.paymentPlan as ProposalDTO['paymentPlan']) : undefined;
  const selectedPhotos = Array.isArray(meta.selectedPhotos) ? (meta.selectedPhotos as string[]) : [];
  const roiInputs = (meta.roi ?? undefined) as ProposalRoiInputs | undefined;
  const totalValue = input.totalValue ?? existing?.totalValue ?? 0;
  const ccy = input.currency ?? existing?.currency ?? 'EUR';
  const roi = roiInputs && totalValue > 0 ? computeRoi(roiInputs, totalValue, ccy) : undefined;
  return {
    id,
    contactId: input.contactId ?? existing?.contactId ?? null,
    clientEmail: client?.email ?? existing?.clientEmail ?? null,
    propertyId: input.propertyId ?? existing?.propertyId ?? null,
    title: input.title ?? existing?.title ?? '—',
    clientName: client?.name ?? existing?.clientName ?? '—',
    projectName: project?.name ?? (typeof meta.project_name === 'string' ? meta.project_name : existing?.projectName) ?? '—',
    projectLocation: project?.location ?? existing?.projectLocation,
    status: (input.status === 'sent' ? 'Sent' : 'Draft'),
    totalValue,
    listPrice: typeof meta.listPrice === 'number' ? meta.listPrice : existing?.listPrice,
    discountPct: typeof meta.discountPercent === 'number' ? meta.discountPercent : existing?.discountPct,
    currency: input.currency ?? existing?.currency ?? 'EUR',
    paymentPlanOnList: typeof meta.paymentPlanOnList === 'boolean' ? meta.paymentPlanOnList : existing?.paymentPlanOnList,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    viewCount: existing?.viewCount ?? 0,
    paymentPlan: paymentPlan && paymentPlan.length > 0 ? paymentPlan : existing?.paymentPlan,
    unit: (meta.unit as ProposalDTO['unit']) ?? existing?.unit,
    roi: roi ?? existing?.roi,
    roiInputs: roiInputs ?? existing?.roiInputs,
    notes: typeof meta.notes === 'string' ? meta.notes : existing?.notes,
    includeBrochurePdf: meta.includeBrochurePdf as boolean | undefined,
    includeFloorPlans: meta.includeFloorPlans as boolean | undefined,
    includeRoiSheet: meta.includeRoiSheet as boolean | undefined,
    coverImage: selectedPhotos[0] ?? existing?.coverImage,
  };
}

export const handlers = [
  // ---- Auth ----
  http.post('/api/auth/login', async ({ request }) => {
    const { email } = (await request.json()) as { email: string; password: string };
    const user = mockUsers.find((u) => u.email?.toLowerCase() === email?.toLowerCase());
    if (!user) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    // NOTE: password is not validated in the mock — any password is accepted.
    return HttpResponse.json({ token: tokenFor(user.id), user });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const id = userIdFromToken(request.headers.get('Authorization'));
    const user = id ? mockUsers.find((u) => u.id === id) : undefined;
    if (!user) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return HttpResponse.json<UserDTO>(user);
  }),

  // Gerçek akışta: url() bir Google consent linki döner, kullanıcı oraya
  // gider, Google geri /auth/google/callback'e yönlendirir, o da
  // /settings?gmail=connected'e döner. Mock modda gerçek Google yok —
  // url() doğrudan aynı sonuca (?gmail=connected) giden bir link döner ve
  // "connected" durumunu bu adımda true'ya çeker (consent verildi gibi).
  http.get('/api/auth/google/url', () => {
    setGoogleConnected(true);
    return HttpResponse.json<{ url: string }>({ url: '/settings?gmail=connected' });
  }),

  http.get('/api/auth/google/status', () => {
    const connected = isGoogleConnected();
    return HttpResponse.json<GoogleOAuthStatus>({
      connected,
      email: connected ? mockGoogleEmail : null,
    });
  }),

  http.post('/api/auth/google/disconnect', () => {
    setGoogleConnected(false);
    return HttpResponse.json<{ ok: true }>({ ok: true });
  }),

  http.get('/api/me', () => {
    return HttpResponse.json<MeResponse>(mockMe);
  }),

  http.patch('/api/me', async ({ request }) => {
    const patch = (await request.json()) as UpdateMeInput;
    mockMe = {
      ...mockMe,
      ...(patch.fullName !== undefined && { name: patch.fullName }),
      ...(patch.jobTitle !== undefined && { jobTitle: patch.jobTitle }),
      ...(patch.phone !== undefined && { phone: patch.phone }),
      ...(patch.aboutMe !== undefined && { aboutMe: patch.aboutMe }),
      ...(patch.theme !== undefined && { theme: patch.theme }),
      ...(patch.locale !== undefined && { locale: patch.locale }),
      ...(patch.timezone !== undefined && { timezone: patch.timezone }),
      ...(patch.notificationPrefs !== undefined && {
        notificationPrefs: { ...mockMe.notificationPrefs, ...patch.notificationPrefs },
      }),
    };
    return HttpResponse.json<MeResponse>(mockMe);
  }),

  http.get('/api/users', () => {
    return HttpResponse.json<UserDTO[]>(mockUsers);
  }),

  http.get('/api/tasks', ({ request }) => {
    const url = new URL(request.url);
    const assigneeId = url.searchParams.get('assigneeId');
    let filteredTasks = mockTasks;
    if (assigneeId) {
      filteredTasks = mockTasks.filter(t => t.assigneeId === assigneeId);
    }
    return HttpResponse.json<TaskDTO[]>(filteredTasks);
  }),

  http.post('/api/tasks', async ({ request }) => {
    const input = (await request.json()) as CreateTaskInput;
    const newTask: TaskDTO = {
      id: `t${Date.now()}`,
      title: input.title,
      description: input.description ?? '',
      dueDate: input.dueDate ?? new Date().toISOString(),
      priority: input.priority ?? 'Medium',
      status: 'Pending',
      assigneeId: input.assigneeId ?? 'u2',
      type: 'Task',
    };
    mockTasks = [...mockTasks, newTask];
    return HttpResponse.json<TaskDTO>(newTask, { status: 201 });
  }),

  http.put('/api/tasks/:id', async ({ params, request }) => {
    const { id } = params;
    const updates = await request.json() as Partial<TaskDTO>;
    mockTasks = mockTasks.map(t => t.id === id ? { ...t, ...updates } : t);
    const updatedTask = mockTasks.find(t => t.id === id);
    if (!updatedTask) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json<TaskDTO>(updatedTask);
  }),

  http.get('/api/audit', () => {
    return HttpResponse.json<AuditLogDTO[]>(mockAuditLogs);
  }),

  http.get('/api/documents', () => {
    return HttpResponse.json<VaultDocumentDTO[]>(mockVaultDocuments);
  }),

  // Vault yazma uçları — mock modda oturum-içi kalıcı (module-level dizi).
  http.post('/api/documents', async ({ request }) => {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const folder = (form.get('folder') as string | null) ?? 'Root';
    const relatedId = (form.get('related_id') as string | null) ?? undefined;
    if (!file) return HttpResponse.json({ message: 'Dosya boş.' }, { status: 400 });
    const doc: VaultDocumentDTO = {
      id: crypto.randomUUID(),
      name: file.name,
      folder: folder as VaultDocumentDTO['folder'],
      type: file.type === 'application/pdf' ? 'pdf'
        : file.type.startsWith('image/') ? 'image'
        : file.type.includes('sheet') || file.type.includes('excel') ? 'excel'
        : file.type.includes('word') ? 'word' : 'other',
      sizeMB: Math.round((file.size / (1024 * 1024)) * 100) / 100,
      uploadedAt: new Date().toISOString().slice(0, 10),
      uploadedBy: 'Onur Nazım Karataş',
      relatedId,
    };
    mockVaultDocuments.unshift(doc);
    return HttpResponse.json<VaultDocumentDTO>(doc, { status: 201 });
  }),

  http.get('/api/documents/:id/download', ({ params }) => {
    const doc = mockVaultDocuments.find(d => d.id === params.id);
    if (!doc) return new HttpResponse(null, { status: 404 });
    // Mock modda gerçek Storage yok — bilgilendirici placeholder içerik döneriz.
    const blobUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(`Mock dosya: ${doc.name}`)}`;
    return HttpResponse.json({ url: blobUrl, name: doc.name });
  }),

  http.delete('/api/documents/:id', ({ params }) => {
    const idx = mockVaultDocuments.findIndex(d => d.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    mockVaultDocuments.splice(idx, 1);
    return HttpResponse.json({ deleted: true });
  }),

  http.get('/api/proposals', () => {
    return HttpResponse.json<ProposalDTO[]>(mockProposals);
  }),

  http.post('/api/proposals', async ({ request }) => {
    const input = (await request.json()) as CreateProposalInput;
    const dto = buildMockProposal(`prop${Date.now()}`, input, undefined);
    mockProposals = [...mockProposals, dto];
    return HttpResponse.json<ProposalDTO>(dto, { status: 201 });
  }),

  http.get('/api/proposals/:id', ({ params }) => {
    const found = mockProposals.find((p) => p.id === params.id);
    if (!found) return HttpResponse.json({ message: 'not found' }, { status: 404 });
    return HttpResponse.json<ProposalDTO>(found);
  }),

  http.patch('/api/proposals/:id', async ({ request, params }) => {
    const input = (await request.json()) as CreateProposalInput;
    const existing = mockProposals.find((p) => p.id === params.id);
    if (!existing) return HttpResponse.json({ message: 'not found' }, { status: 404 });
    const merged = buildMockProposal(existing.id, input, existing);
    mockProposals = mockProposals.map((p) => (p.id === existing.id ? merged : p));
    return HttpResponse.json<ProposalDTO>(merged);
  }),

  http.post('/api/proposals/:id/send', ({ params }) => {
    const existing = mockProposals.find((p) => p.id === params.id);
    if (!existing) return HttpResponse.json({ message: 'not found' }, { status: 404 });
    const sent: ProposalDTO = { ...existing, status: 'Sent', sentAt: new Date().toISOString() };
    mockProposals = mockProposals.map((p) => (p.id === existing.id ? sent : p));
    return HttpResponse.json<ProposalDTO>(sent);
  }),

  http.get('/api/kpi/dashboard', () => {
    return HttpResponse.json<KPIDTO[]>([
      { id: '1', title: 'New Leads', value: '142', trend: 'up', percentage: 12 },
      { id: '2', title: 'Pipeline Value', value: '$4.2M', trend: 'up', percentage: 8 },
      { id: '3', title: 'Pending Proposals', value: '18', trend: 'neutral', percentage: 0 },
      { id: '4', title: 'Conversion Rate', value: '24%', trend: 'up', percentage: 3 },
    ]);
  }),

  http.get('/api/activities/global', () => {
    return HttpResponse.json<ActivityDTO[]>([
      {
        id: '1',
        type: 'LEAD_CREATED',
        actor: 'Onur Nazım Karataş',
        timestamp: new Date().toISOString(),
        details: 'Added new lead from Dubai office.'
      },
      {
        id: '2',
        type: 'MEETING_SCHEDULED',
        actor: 'Sarah Ahmed',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: 'Meeting scheduled with Oliver Hartwell for tomorrow.'
      }
    ]);
  }),

  http.get('/api/leads', () => {
    return HttpResponse.json<LeadDTO[]>(mockLeads);
  }),

  http.get('/api/leads/:id', ({ params }) => {
    const lead = mockLeads.find((l) => l.id === params.id);
    if (!lead) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json<LeadDTO>(lead);
  }),

  http.get('/api/leads/:id/communications', ({ params }) => {
    return HttpResponse.json<LeadCommunicationDTO[]>(mockCommunicationsByLead[params.id as string] ?? []);
  }),

  http.get('/api/leads/:id/scores', ({ params }) => {
    return HttpResponse.json<LeadScoreDTO[]>(mockScoresByLead[params.id as string] ?? []);
  }),

  // Kalıcı silme (super_admin) — mock modda oturum-içi kalıcı (module-level dizi).
  http.delete('/api/leads/:id', ({ params }) => {
    const i = mockLeads.findIndex((l) => l.id === params.id);
    if (i === -1) return new HttpResponse(null, { status: 404 });
    mockLeads.splice(i, 1);
    return HttpResponse.json({ deleted: true });
  }),

  http.delete('/api/contacts/:id', ({ params }) => {
    // Client id = contact id; mock müşteri listesinden ve lead'lerinden düşür.
    const ci = mockClients.findIndex((c) => c.id === params.id);
    if (ci === -1) return new HttpResponse(null, { status: 404 });
    mockClients.splice(ci, 1);
    for (let li = mockLeads.length - 1; li >= 0; li--) {
      if (mockLeads[li].contactId === params.id) mockLeads.splice(li, 1);
    }
    return HttpResponse.json({ deleted: true });
  }),

  // Duplicate ön-kontrolü (kayıttan önce e-posta/telefon eşleşmesi).
  http.get('/api/contacts/lookup', ({ request }) => {
    const url = new URL(request.url);
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '');
    if (!email && !phone) return HttpResponse.json({ match: null });
    const hit = mockClients.find(
      (c) => (email && c.email?.toLowerCase() === email) ||
             (phone && (c.phone || '').replace(/\D/g, '') === phone),
    );
    if (!hit) return HttpResponse.json({ match: null });
    return HttpResponse.json({
      match: {
        id: hit.id, fullName: hit.name, email: hit.email, phone: hit.phone,
        matchedBy: email && hit.email?.toLowerCase() === email ? 'e-posta' : 'telefon',
      },
    });
  }),

  // FAZ 1 create akışı — mock demoda hata vermesin diye plausible yanıt döner
  // (kalıcı değil; gerçek yazım VITE_USE_REAL_API=true backend'inde).
  http.post('/api/contacts', async ({ request }) => {
    const b = (await request.json()) as { first_name?: string; last_name?: string; email?: string; phone?: string };
    const first = b.first_name ?? 'Yeni';
    const last = b.last_name ?? null;
    const now = new Date().toISOString();
    return HttpResponse.json<ContactDTO>({
      id: crypto.randomUUID(), firstName: first, lastName: last,
      fullName: [first, last].filter(Boolean).join(' '), email: b.email ?? null,
      phone: b.phone ?? null, whatsapp: null, preferredLang: 'tr',
      marketingConsent: false, notes: null, version: 1, createdAt: now, updatedAt: now,
    }, { status: 201 });
  }),

  http.post('/api/leads', async ({ request }) => {
    // Gövde snake_case create input'u (CreateLeadInput) ile gelir.
    const b = (await request.json()) as {
      contact_id?: string; status?: LeadDTO['status']; interest_type?: LeadDTO['interestType'];
      priority?: LeadDTO['priority']; budget_max?: number; currency?: string;
      target_market_code?: string; notes?: string;
    };
    const now = new Date().toISOString();
    return HttpResponse.json<LeadDTO>({
      id: crypto.randomUUID(), contactId: b.contact_id ?? crypto.randomUUID(),
      contactName: 'Yeni Aday', company: null, status: b.status ?? 'new', priority: b.priority ?? 'medium',
      interestType: b.interest_type ?? 'buy', budgetMin: null, budgetMax: b.budget_max ?? null,
      currency: b.currency ?? 'EUR', targetMarketCode: b.target_market_code ?? null,
      score: null, ownerId: null, notes: b.notes ?? null, version: 1, createdAt: now, updatedAt: now,
    }, { status: 201 });
  }),

  http.get('/api/contracts', () => {
    const docsFor = (contractId: string): ContractDTO['documents'] =>
      mockVaultDocuments
        .filter((d) => d.relatedId === contractId)
        .map((d) => ({ id: d.id, name: d.name, size: `${d.sizeMB} MB` }));
    return HttpResponse.json<ContractDTO[]>(
      mockContracts.map((c) => ({ ...c, documents: docsFor(c.id) })),
    );
  }),

  http.post('/api/contracts', async ({ request }) => {
    const b = (await request.json()) as ContractWriteInput;
    const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
    const created: ContractDTO = {
      id: `C-${1000 + mockContracts.length + 1}`,
      developer: '—', project: '—',
      status: cap(b.status ?? 'draft') as ContractDTO['status'],
      contractType: b.contractType,
      startDate: b.startDate ?? null, expiryDate: b.endDate ?? null,
      commission: b.commission ?? '', legalEntity: b.legalEntity ?? '',
      paymentTerms: b.paymentTerms ?? '', amount: b.amount ?? null,
      currency: b.currency ?? 'EUR',
      propertyId: b.propertyId ?? null, contactId: b.contactId ?? null,
      documents: [],
    };
    mockContracts = [created, ...mockContracts];
    return HttpResponse.json<ContractDTO>(created, { status: 201 });
  }),

  http.patch('/api/contracts/:id', async ({ params, request }) => {
    const b = (await request.json()) as ContractWriteInput;
    const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
    const idx = mockContracts.findIndex((c) => c.id === params.id);
    if (idx < 0) return HttpResponse.json({ message: 'not found' }, { status: 404 });
    const cur = mockContracts[idx];
    const updated: ContractDTO = {
      ...cur,
      contractType: b.contractType ?? cur.contractType,
      status: (b.status ? cap(b.status) : cur.status) as ContractDTO['status'],
      startDate: b.startDate ?? cur.startDate, expiryDate: b.endDate ?? cur.expiryDate,
      amount: b.amount ?? cur.amount, currency: b.currency ?? cur.currency,
      commission: b.commission ?? cur.commission, legalEntity: b.legalEntity ?? cur.legalEntity,
      paymentTerms: b.paymentTerms ?? cur.paymentTerms,
      propertyId: b.propertyId ?? cur.propertyId, contactId: b.contactId ?? cur.contactId,
    };
    mockContracts[idx] = updated;
    return HttpResponse.json<ContractDTO>(updated);
  }),

  http.get('/api/dashboard/summary', () => {
    return HttpResponse.json<DashboardSummaryDTO>({
      activeLeads: 28,
      pipelineValueEur: 4_720_000,
      closedWonEur: 12_400_000,
      proposalsActive: 5,
      meetingsThisWeek: 6,
      marketSplit: [
        { code: 'AE', name: 'Dubai (UAE)', valueEur: 1_860_000 },
        { code: 'TR', name: 'Türkiye', valueEur: 1_540_000 },
        { code: 'ES', name: 'Spain', valueEur: 780_000 },
        { code: 'GB', name: 'United Kingdom', valueEur: 540_000 },
      ],
      trends: {
        weeks: ['W14', 'W15', 'W16', 'W17', 'W18', 'W19', 'W20', 'W21', 'W22', 'W23', 'W24', 'W25'],
        pipelineEur: [3_120_000, 3_310_000, 3_240_000, 3_580_000, 3_460_000, 3_890_000, 4_070_000, 3_980_000, 4_310_000, 4_490_000, 4_570_000, 4_720_000],
        activeLeads: [19, 21, 20, 22, 24, 23, 25, 24, 26, 27, 26, 28],
        meetings: [8, 7, 9, 6, 7, 8, 7, 9, 8, 7, 7, 6],
        closedWonEur: [7_200_000, 7_800_000, 8_100_000, 8_900_000, 9_400_000, 9_800_000, 10_300_000, 10_900_000, 11_200_000, 11_800_000, 12_100_000, 12_400_000],
      },
      leadSources: [
        { name: 'WhatsApp', value: 14 }, { name: 'Instagram', value: 9 },
        { name: 'Referral', value: 6 }, { name: 'Website', value: 4 }, { name: 'Direct', value: 3 },
      ],
    });
  }),

  http.get('/api/financials/summary', () => {
    return HttpResponse.json<FinancialsSummaryDTO>({
      kpis: {
        totalRevenueEur: 7_247_192.51, totalRevenueDeltaPct: null,
        totalSales: 6, totalSalesDeltaPct: null,
        conversionRatePct: 54.5, conversionRateDeltaPct: null,
        avgDealSizeEur: 1_207_865.42, avgDealSizeDeltaPct: null,
        commissionEarnedEur: 217_088.5, commissionEarnedDeltaPct: null,
      },
      targets: {
        monthlyLeads: { actual: 11, target: 25 },
        monthlySales: { actual: 2, target: 3 },
        monthlyRevenueEur: { actual: 3_254_545.45, target: 2_000_000 },
        yearlyRevenueEur: { actual: 7_247_192.51, target: 20_000_000 },
      },
      monthlyRevenue: [
        { month: '2026-02', valueEur: 1_050_000 },
        { month: '2026-03', valueEur: 475_000 },
        { month: '2026-04', valueEur: 1_117_647.06 },
        { month: '2026-05', valueEur: 1_350_000 },
        { month: '2026-07', valueEur: 3_254_545.45 },
      ],
      salesByMarket: [
        { code: 'ES', name: 'Spain', valueEur: 4_550_000 },
        { code: 'AE', name: 'Dubai (UAE)', valueEur: 1_525_000 },
        { code: 'GB', name: 'United Kingdom', valueEur: 1_117_647.06 },
        { code: 'TR', name: 'Türkiye', valueEur: 54_545.45 },
      ],
      salesByProject: [
        { name: 'Marbella Sky Villas', valueEur: 4_550_000 },
        { name: 'Thames Riverside', valueEur: 1_117_647.06 },
        { name: 'Downtown Heights', valueEur: 1_050_000 },
        { name: 'Safa Two', valueEur: 475_000 },
        { name: 'Bosphorus Terraces', valueEur: 54_545.45 },
      ],
      saleTypeSplit: [
        { code: 'resale', name: 'Resale', valueEur: 5_667_647.06 },
        { code: 'off_plan', name: 'Off-plan', valueEur: 1_579_545.45 },
      ],
      purposeSplit: [
        { code: 'golden_visa', name: 'Golden Visa', valueEur: 3_675_000 },
        { code: 'investment', name: 'Investment', valueEur: 2_222_192.51 },
        { code: 'holiday_home', name: 'Holiday Home', valueEur: 1_350_000 },
      ],
    });
  }),

  http.get('/api/marketing/summary', () => {
    return HttpResponse.json<MarketingSummaryDTO>({
      hasSpendData: true,
      kpis: {
        adSpendEur: 9_400, adSpendDeltaPct: 12.6,
        avgCplEur: 98.4, avgCplDeltaPct: -8.2,
        convQualifiedPct: 22.2, convQualifiedDeltaPct: 3.4,
        roas: 4.1, roasDeltaPct: 6.8,
        spendSpark: [620, 680, 650, 710, 740, 720, 790, 830, 810, 880, 910, 940],
        cplSpark: [128, 121, 124, 116, 112, 115, 108, 104, 107, 101, 99, 98.4],
        qualifiedSpark: [16, 17, 16.5, 18, 17.8, 19, 19.5, 20.2, 20.8, 21.4, 21.9, 22.2],
        roasSpark: [2.9, 3.1, 3.0, 3.3, 3.4, 3.3, 3.6, 3.7, 3.8, 3.9, 4.0, 4.1],
      },
      funnel: { impressions: 412_400, ctwaClicks: 3_840, conversations: 962, qualified: 214, meetings: 58, closedWon: 11 },
      weeklySpendCpl: [
        { label: 'W14', spendEur: 1_420, cpl: 128 }, { label: 'W15', spendEur: 1_560, cpl: 121 },
        { label: 'W16', spendEur: 1_480, cpl: 124 }, { label: 'W17', spendEur: 1_720, cpl: 116 },
        { label: 'W18', spendEur: 1_690, cpl: 112 }, { label: 'W19', spendEur: 1_840, cpl: 115 },
        { label: 'W20', spendEur: 1_910, cpl: 108 }, { label: 'W21', spendEur: 2_050, cpl: 104 },
        { label: 'W22', spendEur: 1_980, cpl: 107 }, { label: 'W23', spendEur: 2_140, cpl: 101 },
        { label: 'W24', spendEur: 2_260, cpl: 99 }, { label: 'W25', spendEur: 2_310, cpl: 98 },
      ],
      spendByMarket: [
        { code: 'AE', name: 'Dubai (UAE)', valueEur: 4_120 },
        { code: 'TR', name: 'Türkiye', valueEur: 2_680 },
        { code: 'ES', name: 'Spain', valueEur: 1_540 },
        { code: 'GB', name: 'United Kingdom', valueEur: 1_060 },
      ],
      campaigns: [
        { id: 'c1', name: 'Golden Visa · Dubai Off-Plan (TR)', market: 'AE', status: 'active', spendEur: 2_840, leads: 24, qualified: 11, cpl: 118.3, closed: 2, roas: 5.6, attributed: true },
        { id: 'c2', name: 'Downtown Rental Yield (EN)', market: 'AE', status: 'active', spendEur: 1_280, leads: 14, qualified: 5, cpl: 91.4, closed: 1, roas: 3.9, attributed: true },
        { id: 'c3', name: 'İstanbul Yatırım Fırsatları (TR)', market: 'TR', status: 'active', spendEur: 1_620, leads: null, qualified: null, cpl: null, closed: null, roas: null, attributed: false },
      ],
      conversations: [
        { id: 'cv1', name: 'Khalid Al Mansoori', market: 'AE', channel: 'whatsapp', snippet: 'Golden Visa için minimum yatırım tutarını teyit edebilir misiniz?', score: 85, lastActivityAt: new Date(Date.now() - 12 * 60_000).toISOString() },
        { id: 'cv2', name: 'Ayşe Demirok', market: 'TR', channel: 'telegram', snippet: 'Kadıköy projesinde 3+1 için ödeme planı nasıl işliyor?', score: 55, lastActivityAt: new Date(Date.now() - 3 * 3_600_000).toISOString() },
      ],
    });
  }),

  http.get('/api/marketing/campaigns', () => HttpResponse.json<AdCampaignDTO[]>(mockCampaigns)),

  http.post('/api/marketing/campaigns', async ({ request }) => {
    const b = (await request.json()) as CreateAdSpendInput;
    const row: AdCampaignDTO = {
      id: crypto.randomUUID(), name: b.name, campaignRef: b.campaignRef ?? null,
      marketCode: b.marketCode ?? null, channel: b.channel ?? 'meta', status: (b.status as 'active' | 'paused') ?? 'active',
      periodStart: b.periodStart, periodEnd: b.periodEnd, spend: b.spend, currency: b.currency ?? 'EUR',
      impressions: b.impressions ?? 0, clicks: b.clicks ?? 0,
    };
    mockCampaigns = [row, ...mockCampaigns];
    return HttpResponse.json<AdCampaignDTO>(row, { status: 201 });
  }),

  http.post('/api/marketing/campaigns/import', async ({ request }) => {
    const { rows } = (await request.json()) as { rows: CreateAdSpendInput[] };
    return HttpResponse.json({ imported: rows.length });
  }),

  http.delete('/api/marketing/campaigns/:id', ({ params }) => {
    mockCampaigns = mockCampaigns.filter((c) => c.id !== params.id);
    return HttpResponse.json({ deleted: true });
  }),

  // --- Proje Girişi (intake) — demo modda boş/stub ---
  http.get('/api/intake/queue', () => HttpResponse.json([])),
  http.get('/api/intake/queue/count', () => HttpResponse.json({ count: 0 })),
  http.get('/api/intake/invites', () => HttpResponse.json([])),
  http.post('/api/intake/invites', async ({ request }) => {
    const b = (await request.json()) as { label?: string; developerId?: string };
    return HttpResponse.json({
      id: crypto.randomUUID(), developerId: b.developerId ?? null, developerName: null,
      label: b.label ?? null, url: `${location.origin}/submit/demotoken1234567890abcd`,
      expiresAt: null, maxUses: null, usedCount: 0, status: 'active', createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),
  http.delete('/api/intake/invites/:id', () => HttpResponse.json({ revoked: true })),
  http.post('/api/intake/queue/:id/approve', async ({ request }) => {
    const b = (await request.json().catch(() => ({}))) as { mode?: 'new' | 'update' };
    return HttpResponse.json({ approved: true, propertyId: crypto.randomUUID(), updated: b.mode === 'update' });
  }),
  http.post('/api/intake/queue/:id/reject', () => HttpResponse.json({ rejected: true })),
  http.get('/api/public/intake/:token', () => HttpResponse.json({ valid: true, developerName: 'Demo Developer', label: 'Demo' })),
  http.post('/api/public/intake/:token/submit', () => HttpResponse.json({ ok: true, submissionId: crypto.randomUUID() }, { status: 201 })),

  http.get('/api/admin/branding', () => {
    return HttpResponse.json<BrandingSettingsDTO>(mockBranding);
  }),

  http.patch('/api/admin/branding', async ({ request }) => {
    const patch = (await request.json()) as UpdateBrandingInput;
    mockBranding = { ...mockBranding, ...patch };
    return HttpResponse.json<BrandingSettingsDTO>(mockBranding);
  }),

  http.post('/api/admin/branding/logo', async ({ request }) => {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return new HttpResponse(null, { status: 400 });
    mockBranding = { ...mockBranding, logoUrl: `/media/mock-${file.name}` };
    return HttpResponse.json<BrandingSettingsDTO>(mockBranding);
  }),

  http.get('/api/admin/team', () => {
    return HttpResponse.json<TeamMemberDTO[]>(mockTeam);
  }),

  http.get('/api/admin/roles', () => {
    return HttpResponse.json<RoleOptionDTO[]>([
      { key: 'super_admin', name: 'Super Admin' },
      { key: 'manager', name: 'Manager' },
      { key: 'finance_manager', name: 'Finance Manager' },
      { key: 'marketing_manager', name: 'Marketing Manager' },
      { key: 'consultant', name: 'Consultant' },
      { key: 'service_agent', name: 'Service Agent' },
    ]);
  }),

  http.patch('/api/admin/team/:id', async ({ params, request }) => {
    const idx = mockTeam.findIndex((m) => m.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const patch = (await request.json()) as UpdateTeamMemberInput;
    if (patch.roleKey !== undefined) mockTeam[idx] = { ...mockTeam[idx], role: patch.roleKey };
    if (patch.isActive !== undefined) mockTeam[idx] = { ...mockTeam[idx], isActive: patch.isActive };
    return HttpResponse.json<TeamMemberDTO>(mockTeam[idx]);
  }),

  http.post('/api/admin/team', async ({ request }) => {
    const input = (await request.json()) as CreateTeamMemberInput;
    const email = input.email.trim().toLowerCase();
    if (mockTeam.some((m) => m.name.toLowerCase() === input.fullName.trim().toLowerCase())) {
      return HttpResponse.json({ message: 'Bu e-posta ile aktif bir kullanıcı zaten var.' }, { status: 409 });
    }
    const member: TeamMemberDTO = {
      id: crypto.randomUUID(),
      name: input.fullName.trim(),
      role: input.roleKey,
      isActive: true,
      lastActiveAt: null,
      clientsRegistered: 0,
    };
    mockTeam.push(member);
    return HttpResponse.json<CreateTeamMemberResult>(
      { member, tempPassword: `Pr!mock${email.slice(0, 4)}Demo9` },
      { status: 201 },
    );
  }),

  http.get('/api/admin/team/:id', ({ params }) => {
    return HttpResponse.json<UserDetailDTO>({
      id: String(params.id), name: 'Onur N. Karataş', role: 'super_admin', isActive: true,
      kpis: { salesVolumeEur: 7_247_192.51, commissionEur: 217_088.5, activeDeals: 0, conversionRatePct: 66.7 },
      pipeline: [
        { key: 'hotLeads', count: 2 }, { key: 'activeLeads', count: 3 },
        { key: 'negotiating', count: 1 }, { key: 'frozen', count: 1 }, { key: 'lost', count: 1 },
      ],
      pipelineClients: [
        { id: 'pc1', bucket: 'hotLeads', name: 'Edward Langley', interest: null, date: new Date().toISOString(), reason: 'London buy-to-let.' },
        { id: 'pc2', bucket: 'negotiating', name: 'Elena Rossi', interest: null, date: new Date().toISOString(), reason: 'Marbella lux; 3 ay.' },
      ],
      transactions: [
        { id: 'tx1', property: 'Bosphorus Terraces', client: 'Ahmet Yılmaz', amount: 2_100_000, currency: 'TRY', status: 'won' },
        { id: 'tx2', property: 'Marbella Sky Villas', client: 'Elena Rossi', amount: 3_200_000, currency: 'EUR', status: 'won' },
      ],
      timeline: [
        { id: 'tl1', occurredAt: new Date().toISOString(), label: 'Yeni kişi kaydetti', entityType: 'contact' },
        { id: 'tl2', occurredAt: new Date().toISOString(), label: 'Görev güncelledi', entityType: 'task' },
      ],
    });
  }),

  http.get('/api/meetings', () => {
    return HttpResponse.json<MeetingDTO[]>(mockMeetings);
  }),

  http.post('/api/meetings', async ({ request }) => {
    const input = (await request.json()) as CreateMeetingInput;
    const newMeeting: MeetingDTO = {
      id: `m${Date.now()}`,
      title: input.title,
      date: input.date,
      durationLabel: input.durationLabel ?? '',
      client: input.client ?? '',
      location: input.location ?? '',
      platform: input.platform ?? 'In-person',
      notes: input.notes ?? '',
      kind: input.kind ?? 'meeting',
    };
    mockMeetings = [...mockMeetings, newMeeting];
    return HttpResponse.json<MeetingDTO>(newMeeting, { status: 201 });
  }),

  // Mock müşteri listesi module-level: PATCH oturum içinde kalıcıdır.
  http.get('/api/clients', () => {
    return HttpResponse.json<ClientDTO[]>(mockClients);
  }),

  http.patch('/api/clients/:id', async ({ params, request }) => {
    const idx = mockClients.findIndex(c => c.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const patch = (await request.json()) as Partial<ClientDTO>;
    mockClients[idx] = { ...mockClients[idx], ...patch };
    return HttpResponse.json<ClientDTO>(mockClients[idx]);
  }),

  // AI Analiz raporları — mock demo: yalnız ilk müşteride örnek rapor.
  http.get('/api/clients/:id/analyses', ({ params }) => {
    if (params.id !== '1') return HttpResponse.json([]);
    return HttpResponse.json([{
      id: 'an1',
      subject: 'Görüşme Analizi: Oliver Hartwell, skor 88',
      report: 'Özet:\nOliver Hartwell, Golden Visa hedefiyle Dubai Marina bölgesinde 2+1/3+1 arayışında. Yüksek bütçe ve net zaman planı ile öncelikli fırsat.\n\nProfil:\n• Amaç: Golden Visa\n• Bölge: Dubai Marina, Downtown Dubai\n• Bütçe: €1.5M – €3.0M\n\nSinyaller:\n• Görüşme talebi kendisinden geldi\n• 60/40 ödeme planı tercihi net\n\nÖnerilen strateji:\n• Q4 2027 teslim projeleri öne çıkarın\n• SPA taslağını görüşme öncesi hazırlayın',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    }]);
  }),

  http.get('/api/clients/:id/notes', ({ params }) => {
    return HttpResponse.json<ClientNoteDTO[]>(mockNotesByClient[String(params.id)] ?? []);
  }),

  http.post('/api/clients/:id/notes', async ({ params, request }) => {
    const body = (await request.json()) as { text: string; tag: ClientNoteDTO['tag'] };
    const note: ClientNoteDTO = {
      id: `mn${Date.now()}`,
      author: 'Onur Nazım Karataş',
      role: 'Admin',
      tag: body.tag,
      createdAt: new Date().toISOString(),
      text: body.text,
    };
    const key = String(params.id);
    mockNotesByClient[key] = [note, ...(mockNotesByClient[key] ?? [])];
    return HttpResponse.json<ClientNoteDTO>(note, { status: 201 });
  }),

  http.get('/api/clients/:id/timeline', ({ params }) => {
    return HttpResponse.json<ClientTimelineEntryDTO[]>(mockTimelineByClient[String(params.id)] ?? []);
  }),


  http.get('/api/developers', () => {
    return HttpResponse.json<DeveloperDTO[]>(
      mockDevelopers.map((d) => ({ ...d, projects: mockProjects.filter((p) => p.developerId === d.id) })),
    );
  }),

  http.post('/api/developers', async ({ request }) => {
    const input = (await request.json()) as CreateDeveloperInput;
    const newDev: Omit<DeveloperDTO, 'projects'> = {
      id: `dev${Date.now()}`,
      name: input.name,
      tier: input.tier ?? 'Boutique',
      headquarters: input.headquarters ?? '',
      activeProjects: 0,
      totalCompletedProjects: 0,
      partnershipStatus: input.partnershipStatus ?? 'Active',
      commissionRate: input.commissionRate ?? '',
      keyContactName: input.keyContactName ?? '',
      keyContactEmail: input.keyContactEmail ?? '',
      keyContactPhone: input.keyContactPhone ?? '',
      website: input.website ?? '',
    };
    mockDevelopers = [...mockDevelopers, newDev];
    return HttpResponse.json<DeveloperDTO>({ ...newDev, projects: [] }, { status: 201 });
  }),

  http.patch('/api/developers/:id', async ({ params, request }) => {
    const idx = mockDevelopers.findIndex((d) => d.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const patch = (await request.json()) as Partial<UpdateDeveloperInput>;
    mockDevelopers[idx] = { ...mockDevelopers[idx], ...patch };
    const updated = mockDevelopers[idx];
    return HttpResponse.json<DeveloperDTO>({
      ...updated,
      projects: mockProjects.filter((p) => p.developerId === updated.id),
    });
  }),

  http.get('/api/projects', () => {
    const docType = (t: VaultDocumentDTO['type']): 'PDF' | 'Image' | 'Spreadsheet' =>
      t === 'excel' ? 'Spreadsheet' : t === 'image' ? 'Image' : 'PDF';
    const withDocs = mockProjects.map((p) => ({
      ...p,
      documents: mockVaultDocuments
        .filter((d) => d.relatedId === p.id)
        .map((d) => ({ id: d.id, title: d.name, type: docType(d.type), size: `${d.sizeMB} MB` })),
    }));
    return HttpResponse.json<ProjectDTO[]>(withDocs);
  }),

  http.post('/api/projects/:id/images', async ({ params, request }) => {
    const idx = mockProjects.findIndex((p) => p.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const form = await request.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return new HttpResponse(null, { status: 400 });
    const urls = files.map((f) => `/media/mock-projects/${f.name}`);
    mockProjects[idx] = { ...mockProjects[idx], images: [...mockProjects[idx].images, ...urls] };
    return HttpResponse.json<ProjectDTO>(mockProjects[idx]);
  }),

  http.patch('/api/projects/:id/lifecycle', async ({ params, request }) => {
    const idx = mockProjects.findIndex((p) => p.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const b = (await request.json()) as { status: ProjectDTO['lifecycleStatus'] };
    mockProjects[idx] = { ...mockProjects[idx], lifecycleStatus: b.status };
    return HttpResponse.json<ProjectDTO>(mockProjects[idx]);
  }),

  http.post('/api/projects', async ({ request }) => {
    const input = (await request.json()) as CreateProjectInput;
    const newProject: ProjectDTO = {
      id: `p${Date.now()}`,
      developerId: input.developerId ?? '',
      developerName: input.developerId ? (mockDeveloperNames[input.developerId] ?? '—') : '—',
      name: input.title,
      location: [input.district, input.city].filter(Boolean).join(', ') || '—',
      status: input.status ?? 'Off-plan',
      lifecycleStatus: 'active',
      totalUnits: input.totalUnits ?? 0,
      availableUnits: input.availableUnits ?? 0,
      startingPrice: input.price ?? 0,
      currency: input.currency ?? 'EUR',
      completionDate: input.completionDate ?? '',
      projectManagerName: '',
      projectManagerPhone: '',
      projectManagerEmail: '',
      description: input.description ?? '',
      images: [],
      amenities: input.amenities ?? [],
      paymentPlan: input.paymentPlan ?? [],
      documents: [],
    };
    mockProjects = [...mockProjects, newProject];
    return HttpResponse.json<ProjectDTO>(newProject, { status: 201 });
  }),

  http.get('/api/gmail/threads', () => {
    const summaries: ThreadSummaryDTO[] = mockThreads.map((thread) => {
      const last = thread.messages[thread.messages.length - 1];
      return {
        id: thread.id,
        subject: thread.subject,
        from: last.from,
        fromEmail: last.fromEmail,
        snippet: last.snippet,
        date: last.date,
        unread: false,
        contact: thread.contact,
      };
    });
    return HttpResponse.json<ThreadSummaryDTO[]>(summaries);
  }),

  http.get('/api/gmail/threads/:id', ({ params }) => {
    const thread = mockThreads.find((th) => th.id === params.id);
    if (!thread) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json<ThreadDetailDTO>(thread);
  }),

  http.post('/api/gmail/send', async ({ request }) => {
    const body = (await request.json()) as { to: string; subject: string; body: string; threadId?: string };
    const thread = body.threadId ? mockThreads.find((th) => th.id === body.threadId) : undefined;
    const id = crypto.randomUUID();
    const threadId = thread?.id ?? crypto.randomUUID();
    if (thread) {
      thread.messages.push({
        id, threadId, from: 'ProDuality Advisory', fromEmail: 'info@produality.com',
        to: [body.to], subject: body.subject, date: new Date().toISOString(),
        snippet: body.body.slice(0, 120), bodyText: body.body, bodyHtml: null,
      });
    }
    return HttpResponse.json({ id, threadId });
  }),
];
