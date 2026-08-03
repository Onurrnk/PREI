// =====================================================================
// IntakeService.createEmailDraft — Faz 3 e-posta intake taslağı.
// Repo mock'lu: insertSubmission'a invite/geliştirici YOK, source=email_intake,
// mükerrer kontrolü + not; dosya/otomatik-aktifleşme yok.
// =====================================================================
import { describe, it, expect, vi } from 'vitest';
import { IntakeService } from './intake.service';
import type { RequestContext } from '../../common/request-context';

const ctx: RequestContext = {
  correlationId: 'c1', tenantId: 't1', userId: 'agent1',
  role: 'service_agent' as RequestContext['role'], authenticated: true,
};

function svcWith(dupMatch: unknown, opts: { gmailUser?: string | null; existingInvite?: unknown } = {}) {
  const insertSubmission = vi.fn(async () => undefined);
  const findDuplicateProject = vi.fn(async () => dupMatch);
  const findOrCreateDeveloper = vi.fn(async () => ({ id: 'dev1', created: true }));
  const ensureOrgContact = vi.fn(async () => true);
  const activeInviteForDeveloper = vi.fn(async () => opts.existingInvite ?? null);
  const createInvite = vi.fn(async () => ({ id: 'inv1', token: 'TOK' }));
  const attachInviteToSubmission = vi.fn(async () => undefined);
  const repo = {
    insertSubmission, findDuplicateProject, findOrCreateDeveloper, ensureOrgContact,
    activeInviteForDeveloper, createInvite, attachInviteToSubmission,
  } as never;

  const sendEmail = vi.fn(async () => ({ id: 'm1', threadId: 't1' }));
  const gmail = { sendEmail } as never;
  // Gmail baglamis kullanici sorgusu: varsayilan olarak var.
  const gmailUser = opts.gmailUser === undefined ? 'u1' : opts.gmailUser;
  const db = { raw: vi.fn(async () => (gmailUser ? [{ id: gmailUser }] : [])) } as never;
  const config = { get: () => 'https://prei.produality.com' } as never;

  const svc = new IntakeService(repo, {} as never, config, gmail, db);
  return {
    svc, insertSubmission, findDuplicateProject, findOrCreateDeveloper, ensureOrgContact,
    createInvite, attachInviteToSubmission, sendEmail, activeInviteForDeveloper,
  };
}

/** autoInviteDeveloper bilerek beklenmeden calisir (void); mikro-gorevleri bosalt. */
const flush = () => new Promise((r) => setTimeout(r, 0));

const dto = {
  title: 'Marina Bay Towers', city: 'Dubai', marketCode: 'AE',
  priceMin: 500000, priceMax: 900000, currency: 'AED', commissionPct: 5,
  unitTypes: '1+1, 2+1', description: 'E-posta ile gelen proje açıklaması.',
  developerName: 'Marina Dev', sourceEmail: 'sales@marina.ae', sourceSubject: 'Yeni proje',
};

describe('IntakeService.createEmailDraft', () => {
  it('taslak üretir: invite/geliştirici yok, source=email_intake, submissionId döner', async () => {
    const { svc, insertSubmission } = svcWith(null);
    const res = await svc.createEmailDraft(ctx, dto as never);
    expect(res.ok).toBe(true);
    expect(res.submissionId).toBeTruthy();

    const arg = (insertSubmission.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(arg.inviteId).toBeNull();
    expect(arg.developerId).toBeNull();
    expect(arg.imageUrls).toEqual([]);
    expect(arg.brochurePath).toBeNull();
    const payload = arg.payload as Record<string, unknown>;
    expect(payload.source).toBe('email_intake');
    expect(payload.sourceEmail).toBe('sales@marina.ae');
    expect(arg.reviewNote).toContain('E-posta ile gelen taslak');
  });

  it('mükerrer eşleşmede review_note mükerrer uyarısı + e-posta notu içerir', async () => {
    const { svc, insertSubmission } = svcWith({
      refType: 'property', refId: 'p1', refTitle: 'Marina Bay Towers', matchedBy: 'aynı şehir',
    });
    await svc.createEmailDraft(ctx, dto as never);
    const arg = (insertSubmission.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(arg.reviewNote).toContain('Olası mükerrer proje');
    expect(arg.reviewNote).toContain('E-posta ile gelen taslak');
    expect((arg.payload as Record<string, unknown>).duplicate).toBeTruthy();
  });
});

// ---------------------------------------------------------------------
// Otomatik geliştirici daveti: mail geldiğinde firma kaydı + form linki.
// Amaç Onur'un hiçbir şey yapmaması — bu yüzden zincirin tamamı kilitli.
// ---------------------------------------------------------------------
describe('createEmailDraft → otomatik geliştirici daveti', () => {
  it('firmayı açar, yetkiliyi ekler, davet üretir ve maili gönderir', async () => {
    const t = svcWith(null);
    await t.svc.createEmailDraft(ctx, dto as never);
    await flush();

    expect(t.findOrCreateDeveloper).toHaveBeenCalledWith(ctx, {
      name: 'Marina Dev', email: 'sales@marina.ae',
    });
    expect(t.ensureOrgContact).toHaveBeenCalledWith(ctx, 'dev1', {
      fullName: 'sales@marina.ae', email: 'sales@marina.ae',
    });
    expect(t.createInvite).toHaveBeenCalled();

    const mail = (t.sendEmail.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(mail.to).toBe('sales@marina.ae');
    expect(mail.subject).toContain('Marina Bay Towers');
    expect(mail.ctaUrl).toBe('https://prei.produality.com/submit/TOK');
    expect(String(mail.body)).toContain('yapay zekâ');

    const attach = (t.attachInviteToSubmission.mock.calls[0] as unknown[])[2] as Record<string, unknown>;
    expect(attach.developerId).toBe('dev1');
    expect(attach.inviteId).toBe('inv1');
    expect(String(attach.note)).toContain('Davet linki');
  });

  it('firmanın geçerli daveti varsa YENİ link üretmez', async () => {
    const t = svcWith(null, { existingInvite: { id: 'old1', token: 'ESKI' } });
    await t.svc.createEmailDraft(ctx, dto as never);
    await flush();

    expect(t.createInvite).not.toHaveBeenCalled();
    const mail = (t.sendEmail.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(mail.ctaUrl).toBe('https://prei.produality.com/submit/ESKI');
  });

  it('gönderen adı varsa maile isimle hitap eder', async () => {
    const t = svcWith(null);
    await t.svc.createEmailDraft(ctx, {
      ...dto, sourceEmail: '"Ahmet Yılmaz" <ahmet@marina.ae>',
    } as never);
    await flush();
    const mail = (t.sendEmail.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(mail.greeting).toBe('Sayın Ahmet Yılmaz,');
    expect(t.ensureOrgContact).toHaveBeenCalledWith(ctx, 'dev1', {
      fullName: 'Ahmet Yılmaz', email: 'ahmet@marina.ae',
    });
  });

  it('İngilizce mailde İngilizce şablon gider', async () => {
    const t = svcWith(null);
    await t.svc.createEmailDraft(ctx, {
      ...dto, sourceSubject: 'New development', description: 'We would like to present our project.',
      title: 'Palm Residences',
    } as never);
    await flush();
    const mail = (t.sendEmail.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(mail.greeting).toBe('Hello,');
    expect(String(mail.body)).toContain('AI automation');
  });

  // Serbest posta adresinden firma uydurmak yanlis kayit uretir.
  it('firma adı çıkarılamıyorsa davet göndermez ama taslak yine oluşur', async () => {
    const t = svcWith(null);
    const res = await t.svc.createEmailDraft(ctx, {
      ...dto, developerName: null, sourceEmail: 'biri@gmail.com',
    } as never);
    await flush();
    expect(res.ok).toBe(true);
    expect(t.sendEmail).not.toHaveBeenCalled();
    expect(t.findOrCreateDeveloper).not.toHaveBeenCalled();
  });

  it('Gmail bağlı kullanıcı yoksa sessizce atlar, taslağı bozmaz', async () => {
    const t = svcWith(null, { gmailUser: null });
    const res = await t.svc.createEmailDraft(ctx, dto as never);
    await flush();
    expect(res.ok).toBe(true);
    expect(t.sendEmail).not.toHaveBeenCalled();
  });

  // Mail gonderimi patlasa bile kuyruk kaydi durmali.
  it('mail gönderimi hata verse bile taslak kaybolmaz', async () => {
    const t = svcWith(null);
    t.sendEmail.mockRejectedValueOnce(new Error('gmail down'));
    const res = await t.svc.createEmailDraft(ctx, dto as never);
    await flush();
    expect(res.ok).toBe(true);
    expect(t.insertSubmission).toHaveBeenCalled();
  });
});
