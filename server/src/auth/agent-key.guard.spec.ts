// =====================================================================
// AgentKeyGuard — n8n/Eylül ingest auth (X-Agent-Key, timing-safe).
// App-katmanı güvenlik regresyon kapısı: guard yanlışlıkla gevşetilirse
// (boş/yanlış anahtar kabul, fail-open) bu testler kırılır.
// =====================================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AgentKeyGuard } from './agent-key.guard';
import { CTX_KEY } from '../common/request-context';

const KEY = 'super-secret-key'; // 16 karakter

function makeExec(opts: { key?: string; hasCtx?: boolean }) {
  const ctxObj = { correlationId: 'x', tenantId: null, userId: null, role: null, authenticated: false };
  const req: Record<string, unknown> = {
    [CTX_KEY]: opts.hasCtx === false ? undefined : ctxObj,
    header: (n: string) => (n.toLowerCase() === 'x-agent-key' ? opts.key : undefined),
  };
  const exec = { switchToHttp: () => ({ getRequest: () => req }) } as never;
  return { exec, ctxObj };
}

const guardWith = (rows: Array<{ user_id: string; tenant_id: string }>) =>
  new AgentKeyGuard({ raw: vi.fn(async () => rows) } as never);

describe('AgentKeyGuard', () => {
  const OLD = process.env.AGENT_API_KEY;
  beforeEach(() => { process.env.AGENT_API_KEY = KEY; });
  afterEach(() => { process.env.AGENT_API_KEY = OLD; });

  it('doğru anahtar + principal → izin verir ve service_agent bağlamı kurar', async () => {
    const g = guardWith([{ user_id: 'u1', tenant_id: 't1' }]);
    const { exec, ctxObj } = makeExec({ key: KEY });
    await expect(g.canActivate(exec)).resolves.toBe(true);
    expect(ctxObj.role).toBe('service_agent');
    expect(ctxObj.userId).toBe('u1');
    expect(ctxObj.tenantId).toBe('t1');
    expect(ctxObj.authenticated).toBe(true);
  });

  it('yanlış anahtar (aynı uzunluk) → reddeder', async () => {
    const g = guardWith([{ user_id: 'u1', tenant_id: 't1' }]);
    const { exec } = makeExec({ key: 'WRONG-secret-key' }); // 16 karakter, farklı içerik
    await expect(g.canActivate(exec)).rejects.toThrow(UnauthorizedException);
  });

  it('boş/eksik anahtar → reddeder', async () => {
    const g = guardWith([{ user_id: 'u1', tenant_id: 't1' }]);
    await expect(g.canActivate(makeExec({ key: undefined }).exec)).rejects.toThrow(UnauthorizedException);
  });

  it('uzunluk farkı → reddeder (timing-safe karşılaştırma)', async () => {
    const g = guardWith([{ user_id: 'u1', tenant_id: 't1' }]);
    await expect(g.canActivate(makeExec({ key: 'kisa' }).exec)).rejects.toThrow(UnauthorizedException);
  });

  it('doğru anahtar ama principal bulunamazsa → reddeder', async () => {
    const g = guardWith([]);
    await expect(g.canActivate(makeExec({ key: KEY }).exec)).rejects.toThrow('Agent principal bulunamadı');
  });

  it('AGENT_API_KEY tanımsızsa → reddeder (fail-closed, boş anahtar kabul edilmez)', async () => {
    delete process.env.AGENT_API_KEY;
    const g = guardWith([{ user_id: 'u1', tenant_id: 't1' }]);
    await expect(g.canActivate(makeExec({ key: '' }).exec)).rejects.toThrow(UnauthorizedException);
  });

  it('istek bağlamı yoksa → reddeder', async () => {
    const g = guardWith([{ user_id: 'u1', tenant_id: 't1' }]);
    await expect(g.canActivate(makeExec({ key: KEY, hasCtx: false }).exec)).rejects.toThrow('İstek bağlamı yok');
  });
});
