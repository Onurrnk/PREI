import { http, HttpResponse } from 'msw';
import type {
  ActivityDTO,
  KPIDTO,
  LeadDTO,
  ClientDTO,
  ContactDTO,
  ContractDTO,
  DashboardSummaryDTO,
  MeetingDTO,
  ProjectDTO,
  DeveloperDTO,
  ProposalDTO,
  VaultDocumentDTO,
  AuditLogDTO,
  UserDTO,
  TaskDTO,
} from '../core/types';

// Re-export domain types for backward compatibility. The canonical source
// of truth now lives in src/core/types. New code should import from there.
export type * from '../core/types';

const mockProposals: ProposalDTO[] = [
  { id: 'prop1', title: 'Beachfront Residences - 3BR Pitch', clientName: 'Oliver Hartwell', projectName: 'Beachfront Residences', status: 'Sent', totalValue: 2800000, createdAt: '2026-06-15', viewCount: 0 },
  { id: 'prop2', title: 'Downtown Heights - Penthouse Offer', clientName: 'Sarah Ahmed', projectName: 'Downtown Heights', status: 'Viewed', totalValue: 4200000, createdAt: '2026-06-14', lastViewed: '2026-06-16T10:30:00Z', viewCount: 3 },
  { id: 'prop3', title: 'DAMAC Hills - Villa 45', clientName: 'Mohammed Al Fayed', projectName: 'DAMAC Hills Villas', status: 'Accepted', totalValue: 3800000, createdAt: '2026-06-10', lastViewed: '2026-06-12T14:15:00Z', viewCount: 5 },
  { id: 'prop4', title: 'Belmont Investment Portfolio', clientName: 'Carmen Ortega', projectName: 'Belmont Residences', status: 'Draft', totalValue: 1200000, createdAt: '2026-06-16', viewCount: 0 }
];

const mockVaultDocuments: VaultDocumentDTO[] = [
  { id: 'doc1', name: 'Oliver_Hartwell_Passport.pdf', folder: 'Client KYC', type: 'pdf', sizeMB: 2.4, uploadedAt: '2026-06-15', uploadedBy: 'Elif Şahin' },
  { id: 'doc2', name: 'Beachfront_Brochure_V2.pdf', folder: 'Marketing', type: 'pdf', sizeMB: 15.6, uploadedAt: '2026-06-10', uploadedBy: 'Marketing Team' },
  { id: 'doc3', name: 'SPA_Template_Emaar.word', folder: 'Contracts', type: 'word', sizeMB: 1.1, uploadedAt: '2026-06-01', uploadedBy: 'Legal Dept' },
  { id: 'doc4', name: 'Downtown_Heights_Floorplans.pdf', folder: 'Marketing', type: 'pdf', sizeMB: 8.2, uploadedAt: '2026-05-20', uploadedBy: 'Elif Şahin' },
  { id: 'doc5', name: 'MOU_Sarah_Ahmed_Signed.pdf', folder: 'Contracts', type: 'pdf', sizeMB: 4.5, uploadedAt: '2026-06-14', uploadedBy: 'Elif Şahin' },
  { id: 'doc6', name: 'ROI_Calculator_2026.excel', folder: 'Root', type: 'excel', sizeMB: 0.5, uploadedAt: '2026-01-10', uploadedBy: 'Finance' },
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

  http.get('/api/proposals', () => {
    return HttpResponse.json<ProposalDTO[]>(mockProposals);
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
    // Şekil, gerçek API sözleşmesi (LeadResponse) ile birebir — mock↔API kayması
    // derleme anında yakalanır (OV-8). Çok pazarlı gerçekçi set.
    const mk = (o: Partial<LeadDTO> & Pick<LeadDTO, 'id' | 'contactName' | 'status'>): LeadDTO => ({
      contactId: o.id, company: null, priority: 'medium', interestType: 'buy',
      budgetMin: null, budgetMax: null, currency: 'EUR', targetMarketCode: null,
      score: null, ownerId: null, notes: null, version: 1,
      createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-15T00:00:00Z', ...o,
    });
    return HttpResponse.json<LeadDTO[]>([
      mk({ id: '1', contactName: 'Stefan Brandt', company: 'Nordwind Capital', status: 'new', budgetMax: 1500000, currency: 'EUR', targetMarketCode: 'ES', interestType: 'invest', score: 30 }),
      mk({ id: '2', contactName: 'Sarah Ahmed', company: 'Emirates Corp', status: 'contacted', budgetMax: 3200000, currency: 'AED', targetMarketCode: 'AE', interestType: 'buy', score: 48 }),
      mk({ id: '3', contactName: 'Edward Langley', company: 'InvestUK', status: 'qualified', budgetMax: 850000, currency: 'GBP', targetMarketCode: 'GB', interestType: 'buy', score: 62 }),
      mk({ id: '4', contactName: 'Elena Rossi', company: 'Rossi Group', status: 'nurturing', budgetMax: 4500000, currency: 'EUR', targetMarketCode: 'ES', interestType: 'invest', score: 74 }),
      mk({ id: '5', contactName: 'Ahmet Yılmaz', company: 'Yılmaz Holding', status: 'converted', budgetMax: 2100000, currency: 'TRY', targetMarketCode: 'TR', interestType: 'buy', score: 88 }),
    ]);
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
    const doc = (id: string, name: string, size: string) => ({ id, name, size });
    return HttpResponse.json<ContractDTO[]>([
      { id: 'C-1001', developer: 'Emaar Properties', project: 'Downtown Views II', status: 'Active', contractType: 'pm', startDate: '2025-01-01', expiryDate: '2026-12-31', commission: '5%', legalEntity: 'Emaar Development PJSC', paymentTerms: '30 Days Net', amount: null, currency: 'AED', documents: [doc('d1', 'Agency Agreement_Emaar_2025.pdf', '2.4 MB'), doc('d2', 'Marketing Guidelines.pdf', '1.1 MB')] },
      { id: 'C-1002', developer: 'Nakheel', project: 'Palm Beach Towers', status: 'Active', contractType: 'pm', startDate: '2024-06-15', expiryDate: '2025-06-14', commission: '4%', legalEntity: 'Nakheel PJSC', paymentTerms: '45 Days Net', amount: null, currency: 'AED', documents: [doc('d4', 'Nakheel_Broker_Agreement.pdf', '3.1 MB')] },
      { id: 'C-1003', developer: 'Damac Properties', project: 'Damac Hills', status: 'Expiring', contractType: 'pm', startDate: '2023-08-01', expiryDate: '2024-07-31', commission: '6%', legalEntity: 'Damac Real Estate Dev.', paymentTerms: '15 Days Net', amount: null, currency: 'AED', documents: [doc('d6', 'Damac_Agency_Contract.pdf', '1.9 MB')] },
      { id: 'C-1004', developer: 'Meraas', project: 'City Walk', status: 'Expired', contractType: 'pm', startDate: '2022-01-01', expiryDate: '2023-01-01', commission: '5%', legalEntity: 'Meraas Holding', paymentTerms: '30 Days Net', amount: null, currency: 'AED', documents: [doc('d8', 'Old_Agreement_Meraas.pdf', '2.0 MB')] },
    ]);
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
    });
  }),

  http.get('/api/meetings', () => {
    // Bu ayın günlerine yerleşen toplantılar (takvim mock modda da dolu görünsün).
    const now = new Date();
    const day = (d: number, h: number, m = 0) => new Date(now.getFullYear(), now.getMonth(), d, h, m).toISOString();
    return HttpResponse.json<MeetingDTO[]>([
      { id: 'm1', title: 'Viewing: Marina Vista', date: day(12, 10), durationLabel: '1h', client: 'John Doe', location: 'Marina Vista Tower B', platform: 'In-person', notes: '3BR deniz manzaralı birimlerle ilgileniyor.', kind: 'viewing' },
      { id: 'm2', title: 'Consultation: M. Smith', date: day(12, 14), durationLabel: '45m', client: 'Michael Smith', location: 'Zoom', platform: 'Zoom', notes: 'Off-plan yatırım ilk görüşme.', kind: 'meeting' },
      { id: 'm3', title: 'Contract Signing', date: day(15, 11, 30), durationLabel: '1h', client: 'Elena Rodriguez', location: 'Emaar Sales Center', platform: 'In-person', notes: 'Tüm SPA dokümanları hazır olsun.', kind: 'signing' },
      { id: 'm4', title: 'Zoom: Project Pitch', date: day(22, 16), durationLabel: '1h', client: 'Michael Smith', location: 'Zoom', platform: 'Zoom', notes: 'Safa Two projesi sunumu.', kind: 'meeting' },
    ]);
  }),

  http.get('/api/clients', () => {
    return HttpResponse.json<ClientDTO[]>([
      {
        id: '1', clientId: 'CL-10024', name: 'Oliver Hartwell', type: 'VIP', nationality: 'UK',
        email: 'o.hartwell@hartwellestates.co.uk', phone: '+44 7700 900077', totalInvestment: 4500000,
        activeProperties: 3, preferredRegions: ['Dubai Marina', 'Downtown Dubai'],
        investmentProfile: 'Balanced', source: 'Referral', relationshipStatus: 'Active',
        assignedConsultant: 'Sarah Ahmed', lastContactDate: '2026-06-15T10:30:00Z'
      },
      {
        id: '2', clientId: 'CL-10025', name: 'Carmen Ortega', type: 'Individual', nationality: 'Spain',
        email: 'carmen.ortega@ortegapatrimonio.es', phone: '+34 612 480 375', totalInvestment: 850000,
        activeProperties: 1, preferredRegions: ['JVC', 'Business Bay'],
        investmentProfile: 'Conservative', source: 'Web Lead', relationshipStatus: 'Active',
        assignedConsultant: 'Michael Chen', lastContactDate: '2026-06-10T14:15:00Z'
      },
      {
        id: '3', clientId: 'CL-10026', name: 'Meridian Gulf Investments', type: 'Corporate', nationality: 'UAE',
        email: 'investments@meridiangulf.ae', phone: '+971 4 332 2111', totalInvestment: 12500000,
        activeProperties: 8, preferredRegions: ['Palm Jumeirah', 'DIFC'],
        investmentProfile: 'Aggressive', source: 'Event', relationshipStatus: 'Active',
        assignedConsultant: 'Onur Nazım Karataş', lastContactDate: '2026-06-16T09:00:00Z'
      },
      {
        id: '4', clientId: 'CL-10027', name: 'Mohammed Al Fayed', type: 'VIP', nationality: 'KSA',
        email: 'malfayed@invest.sa', phone: '+966 50 123 4567', totalInvestment: 25000000,
        activeProperties: 12, preferredRegions: ['Downtown Dubai', 'Riyadh'],
        investmentProfile: 'Aggressive', source: 'Direct', relationshipStatus: 'Dormant',
        assignedConsultant: 'Sarah Ahmed', lastContactDate: '2026-04-20T11:00:00Z'
      },
      {
        id: '5', clientId: 'CL-10028', name: 'Elena Popova', type: 'Individual', nationality: 'Russia',
        email: 'elena.p@mail.ru', phone: '+7 900 123 4567', totalInvestment: 1200000,
        activeProperties: 2, preferredRegions: ['Bluewaters', 'Dubai Marina'],
        investmentProfile: 'Balanced', source: 'Agency', relationshipStatus: 'Active',
        assignedConsultant: 'Michael Chen', lastContactDate: '2026-06-14T16:45:00Z'
      },
    ]);
  }),

  http.get('/api/developers', () => {
    return HttpResponse.json<DeveloperDTO[]>([
      {
        id: '1', name: 'Emaar Properties', tier: 'Tier 1', headquarters: 'Dubai', activeProjects: 45, totalCompletedProjects: 120, partnershipStatus: 'Active', commissionRate: '5%',
        keyContactName: 'Ahmed Al Ali', keyContactEmail: 'ahmed@emaar.ae', keyContactPhone: '+971 50 123 4567', website: 'www.emaar.com',
        projects: [
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
            documents: [
              { id: 'd1', title: 'Project Brochure', type: 'PDF', size: '12 MB' },
              { id: 'd2', title: 'Floor Plans (2BR & 3BR)', type: 'PDF', size: '8.5 MB' },
              { id: 'd3', title: 'Current Availability List', type: 'Spreadsheet', size: '1.2 MB' }
            ]
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
            documents: [
              { id: 'd4', title: 'Executive Presentation', type: 'PDF', size: '15 MB' }
            ]
          }
        ]
      },
      {
        id: '2', name: 'DAMAC Properties', tier: 'Tier 1', headquarters: 'Dubai', activeProjects: 32, totalCompletedProjects: 85, partnershipStatus: 'Active', commissionRate: '6%',
        keyContactName: 'Sara Khan', keyContactEmail: 'skhan@damac.ae', keyContactPhone: '+971 52 234 5678', website: 'www.damacproperties.com',
        projects: [
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
            documents: [
              { id: 'd5', title: 'Villa Layouts', type: 'PDF', size: '10 MB' }
            ]
          }
        ]
      },
      {
        id: '3', name: 'Nakheel', tier: 'Tier 1', headquarters: 'Dubai', activeProjects: 18, totalCompletedProjects: 95, partnershipStatus: 'Negotiating', commissionRate: '4.5%',
        keyContactName: 'Omar Saeed', keyContactEmail: 'omar.s@nakheel.ae', keyContactPhone: '+971 50 888 9900', website: 'www.nakheel.com',
        projects: []
      },
      {
        id: '4', name: 'Ellington Properties', tier: 'Boutique', headquarters: 'Dubai', activeProjects: 12, totalCompletedProjects: 25, partnershipStatus: 'Active', commissionRate: '7%',
        keyContactName: 'David Miller', keyContactEmail: 'david@ellington.ae', keyContactPhone: '+971 58 555 4444', website: 'www.ellingtonproperties.ae',
        projects: [
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
            documents: [
              { id: 'd6', title: 'Investment Case Study', type: 'PDF', size: '5 MB' },
              { id: 'd7', title: 'Factsheet', type: 'PDF', size: '2 MB' }
            ]
          }
        ]
      },
      {
        id: '5', name: 'Sobha Realty', tier: 'Tier 2', headquarters: 'Dubai', activeProjects: 22, totalCompletedProjects: 40, partnershipStatus: 'Active', commissionRate: '5.5%',
        keyContactName: 'Ravi Menon', keyContactEmail: 'rmenon@sobha.ae', keyContactPhone: '+971 50 777 6655', website: 'www.sobharealty.com',
        projects: []
      },
    ]);
  }),

  http.get('/api/projects', () => {
    const allProjects: ProjectDTO[] = [
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
        documents: [
          { id: 'd1', title: 'Project Brochure', type: 'PDF', size: '12 MB' },
          { id: 'd2', title: 'Floor Plans (2BR & 3BR)', type: 'PDF', size: '8.5 MB' },
          { id: 'd3', title: 'Current Availability List', type: 'Spreadsheet', size: '1.2 MB' }
        ]
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
        documents: [
          { id: 'd4', title: 'Executive Presentation', type: 'PDF', size: '15 MB' }
        ]
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
        documents: [
          { id: 'd5', title: 'Villa Layouts', type: 'PDF', size: '10 MB' }
        ]
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
        documents: [
          { id: 'd6', title: 'Investment Case Study', type: 'PDF', size: '5 MB' },
          { id: 'd7', title: 'Factsheet', type: 'PDF', size: '2 MB' }
        ]
      }
    ];
    return HttpResponse.json<ProjectDTO[]>(allProjects);
  }),
];
