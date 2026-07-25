// =====================================================================
// Denetim yardımcıları — diff özeti, rota çözümü, eylem ağırlığı.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { summarizeDiff, entityRoute, actionSeverity, ACTION_LABELS } from './audit.util';

describe('summarizeDiff', () => {
  it('güncellemede YALNIZ değişen alanları döndürür', () => {
    const out = summarizeDiff({
      before: { status: 'new', score: 30, notes: 'aynı', updated_at: 'T1' },
      after: { status: 'contacted', score: 55, notes: 'aynı', updated_at: 'T2' },
    });
    expect(out.map((d) => d.field)).toEqual(['score', 'status']);
    expect(out.find((d) => d.field === 'status')).toEqual({
      field: 'status', before: 'new', after: 'contacted',
    });
  });

  it('teknik gürültü alanlarını eler', () => {
    const out = summarizeDiff({
      before: { version: 1, updated_at: 'a', updated_by: 'x', tenant_id: 't', name: 'Ali' },
      after: { version: 2, updated_at: 'b', updated_by: 'y', tenant_id: 't', name: 'Veli' },
    });
    expect(out.map((d) => d.field)).toEqual(['name']);
  });

  it('oluşturmada (before yok) dolu alanları listeler', () => {
    const out = summarizeDiff({
      after: { first_name: 'Kudret', last_name: 'Kalyoncu', phone: null, notes: '', metadata: {} },
    });
    expect(out.map((d) => d.field)).toEqual(['first_name', 'last_name']);
    expect(out[0].before).toBeNull();
  });

  it('silmede (after yok) neyin gittiğini gösterir', () => {
    const out = summarizeDiff({ before: { first_name: 'Test', email: 'a@b.c' } });
    expect(out.map((d) => d.field)).toEqual(['email', 'first_name']);
    expect(out[0].after).toBeNull();
  });

  it('uzun metni kırpar (arayüzü boğmasın)', () => {
    const long = 'x'.repeat(400);
    const out = summarizeDiff({ before: { notes: 'kısa' }, after: { notes: long } });
    expect(out[0].after!.length).toBeLessThan(130);
    expect(out[0].after!.endsWith('…')).toBe(true);
  });

  it('alan sayısını sınırlar', () => {
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) { before[`f${i}`] = i; after[`f${i}`] = i + 1; }
    expect(summarizeDiff({ before, after }).length).toBe(12);
    expect(summarizeDiff({ before, after }, 3).length).toBe(3);
  });

  it('iç içe nesne değişikliğini JSON olarak gösterir', () => {
    const out = summarizeDiff({
      before: { metadata: { a: 1 } }, after: { metadata: { a: 2 } },
    });
    expect(out[0].field).toBe('metadata');
    expect(out[0].after).toContain('"a":2');
  });

  it('bozuk / boş girdide çökmez', () => {
    expect(summarizeDiff(null)).toEqual([]);
    expect(summarizeDiff(undefined)).toEqual([]);
    expect(summarizeDiff({})).toEqual([]);
    expect(summarizeDiff({ before: null, after: null })).toEqual([]);
  });

  it('değişiklik yoksa boş döner', () => {
    expect(summarizeDiff({ before: { a: 1 }, after: { a: 1 } })).toEqual([]);
  });
});

describe('entityRoute', () => {
  it('müşteri/aday/proje kayıtlarını kendi sayfasına bağlar', () => {
    expect(entityRoute('contact', 'abc')).toBe('/clients/abc');
    expect(entityRoute('client', 'abc')).toBe('/clients/abc');
    expect(entityRoute('lead', 'abc')).toBe('/leads/abc');
    expect(entityRoute('project', 'abc')).toBe('/projects/abc');
    expect(entityRoute('proposal', 'abc')).toBe('/proposals/abc');
  });

  it('kendi sayfası olmayan tipe bağlantı üretmez', () => {
    expect(entityRoute('user', 'abc')).toBeNull();
    expect(entityRoute('tenant', 'abc')).toBeNull();
    expect(entityRoute('bilinmeyen', 'abc')).toBeNull();
  });

  it('liste sayfası olan tipleri listeye bağlar', () => {
    expect(entityRoute('document', 'abc')).toBe('/documents');
    expect(entityRoute('task', 'abc')).toBe('/tasks');
  });
});

describe('actionSeverity', () => {
  it('silme ve reddi kritik sayar', () => {
    expect(actionSeverity('contact.deleted')).toBe('critical');
    expect(actionSeverity('project_submission.rejected')).toBe('critical');
  });
  it('oluşturma/onay/gönderimi dikkat çekici sayar', () => {
    expect(actionSeverity('contact.created')).toBe('notable');
    expect(actionSeverity('project_submission.approved')).toBe('notable');
    expect(actionSeverity('lead.analysis_sent')).toBe('notable');
    expect(actionSeverity('document.uploaded')).toBe('notable');
  });
  it('güncellemeyi normal sayar', () => {
    expect(actionSeverity('lead.updated')).toBe('normal');
  });
});

describe('ACTION_LABELS', () => {
  it('gerçek verideki eylemleri Türkçeleştirir', () => {
    // Canlı audit_log/events'te fiilen görülen eylemler
    for (const a of ['contact.created', 'contact.deleted', 'lead.updated',
                     'document.uploaded', 'knowledge.added', 'task.updated',
                     'project_submission.approved', 'lead.whatsapp_message',
                     'lead.agent_reply', 'lead.scored']) {
      expect(ACTION_LABELS[a], `eksik etiket: ${a}`).toBeTruthy();
    }
  });
});
