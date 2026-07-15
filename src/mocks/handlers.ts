import { http, HttpResponse } from 'msw';
import type {
  ClientNoteDTO,
  ClientTimelineEntryDTO,
  ActivityDTO,
  KPIDTO,
  LeadCommunicationDTO,
  LeadDTO,
  LeadScoreDTO,
  ClientDTO,
  ContactDTO,
  ContractDTO,
  DashboardSummaryDTO,
  FinancialsSummaryDTO,
  MeetingDTO,
  TeamMemberDTO,
  UserDetailDTO,
  ProjectDTO,
  DeveloperDTO,
  ProposalDTO,
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
  { id: 'doc6', name: 'ROI_Calculator_2026.xlsx', folder: 'Root', type: 'excel', sizeMB: 0.5, uploadedAt: '2026-01-10', uploadedBy: 'Finance' },
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
        requirements: 'Sea view, high floor, 60/40 construction-linked payment plan; handover by Q4 2027.'
      },
      {
        id: '2', clientId: 'CL-10025', name: 'Carmen Ortega', type: 'Individual', nationality: 'Spain',
        email: 'carmen.ortega@ortegapatrimonio.es', phone: '+34 612 480 375', totalInvestment: 850000,
        activeProperties: 1, preferredRegions: ['JVC', 'Business Bay'],
        investmentProfile: 'Conservative', source: 'Web Lead', relationshipStatus: 'Active',
        assignedConsultant: 'Michael Chen', lastContactDate: '2026-06-10T14:15:00Z',
        unitTypes: ['1+1'], purpose: 'Investment', budgetRange: '€400K – €700K',
        requirements: 'High rental yield focus; furnished preferred, near metro.'
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

  // Vault yazma uçları — mock modda oturum-içi kalıcı (module-level dizi).
  http.post('/api/documents', async ({ request }) => {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const folder = (form.get('folder') as string | null) ?? 'Root';
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
      { id: 'C-1002', developer: 'Nakheel', project: 'Palm Beach Towers', status: 'Active', contractType: 'pm', startDate: '2025-06-15', expiryDate: '2027-06-14', commission: '4%', legalEntity: 'Nakheel PJSC', paymentTerms: '45 Days Net', amount: null, currency: 'AED', documents: [doc('d4', 'Nakheel_Broker_Agreement.pdf', '3.1 MB')] },
      { id: 'C-1003', developer: 'Damac Properties', project: 'Damac Hills', status: 'Expiring', contractType: 'pm', startDate: '2024-08-01', expiryDate: '2026-08-20', commission: '6%', legalEntity: 'Damac Real Estate Dev.', paymentTerms: '15 Days Net', amount: null, currency: 'AED', documents: [doc('d6', 'Damac_Agency_Contract.pdf', '1.9 MB')] },
      { id: 'C-1004', developer: 'Meraas', project: 'City Walk', status: 'Expired', contractType: 'pm', startDate: '2024-01-01', expiryDate: '2026-01-01', commission: '5%', legalEntity: 'Meraas Holding', paymentTerms: '30 Days Net', amount: null, currency: 'AED', documents: [doc('d8', 'Old_Agreement_Meraas.pdf', '2.0 MB')] },
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

  http.get('/api/admin/team', () => {
    return HttpResponse.json<TeamMemberDTO[]>([
      { id: 'u1', name: 'Onur N. Karataş', role: 'super_admin', isActive: true, lastActiveAt: new Date().toISOString(), clientsRegistered: 9 },
      { id: 'u2', name: 'Selin Yıldız', role: 'consultant', isActive: true, lastActiveAt: null, clientsRegistered: 0 },
      { id: 'u3', name: 'Marco Bianchi', role: 'consultant', isActive: true, lastActiveAt: null, clientsRegistered: 0 },
    ]);
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
    // Bu ayın günlerine yerleşen toplantılar (takvim mock modda da dolu görünsün).
    const now = new Date();
    const day = (d: number, h: number, m = 0) => new Date(now.getFullYear(), now.getMonth(), d, h, m).toISOString();
    return HttpResponse.json<MeetingDTO[]>([
      { id: 'm1', title: 'Viewing: Marina Vista', date: day(12, 10), durationLabel: '1h', client: 'Oliver Hartwell', location: 'Marina Vista Tower B', platform: 'In-person', notes: '3BR deniz manzaralı birimlerle ilgileniyor.', kind: 'viewing' },
      { id: 'm2', title: 'Consultation: T. Weber', date: day(12, 14), durationLabel: '45m', client: 'Tobias Weber', location: 'Zoom', platform: 'Zoom', notes: 'Off-plan yatırım ilk görüşme.', kind: 'meeting' },
      { id: 'm3', title: 'Contract Signing', date: day(15, 11, 30), durationLabel: '1h', client: 'Carmen Ortega', location: 'Emaar Sales Center', platform: 'In-person', notes: 'Tüm SPA dokümanları hazır olsun.', kind: 'signing' },
      { id: 'm4', title: 'Zoom: Project Pitch', date: day(22, 16), durationLabel: '1h', client: 'Tobias Weber', location: 'Zoom', platform: 'Zoom', notes: 'Safa Two projesi sunumu.', kind: 'meeting' },
    ]);
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
