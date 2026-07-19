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

function svcWith(dupMatch: unknown) {
  const insertSubmission = vi.fn(async () => undefined);
  const findDuplicateProject = vi.fn(async () => dupMatch);
  const repo = { insertSubmission, findDuplicateProject } as never;
  const svc = new IntakeService(repo, {} as never, {} as never);
  return { svc, insertSubmission, findDuplicateProject };
}

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
