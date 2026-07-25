// =====================================================================
// toVaultDocumentResponse — documents_vault satırı → dış sözleşme.
// MIME→tür eşleme, boyut MB yuvarlama, tarih dilimleme, fallback.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { toVaultDocumentResponse } from './dto/document-response.dto';
import type { VaultDocRow } from './documents.repository';

const row = (over: Partial<VaultDocRow> = {}): VaultDocRow => ({
  id: 'doc1', name: 'Brosur.pdf', folder: 'Contracts', mime_type: 'application/pdf',
  size_bytes: '2516582', storage_path: 't/x.pdf', related_type: 'contract', related_id: 'c1',
  organization_id: null, organization_name: null, project_id: null, project_name: null,
  created_at: '2026-06-15T10:30:00.000Z', uploaded_by_name: 'Onur',
  ...over,
});

describe('toVaultDocumentResponse', () => {
  it('temel alanlar + MB yuvarlama + tarih dilimi + relatedId', () => {
    const r = toVaultDocumentResponse(row());
    expect(r.id).toBe('doc1');
    expect(r.type).toBe('pdf');
    expect(r.sizeMB).toBe(2.4); // 2516582 / 1048576 ≈ 2.4
    expect(r.uploadedAt).toBe('2026-06-15');
    expect(r.uploadedBy).toBe('Onur');
    expect(r.relatedId).toBe('c1');
  });

  it('MIME türlerini doğru eşler', () => {
    expect(toVaultDocumentResponse(row({ mime_type: 'image/png' })).type).toBe('image');
    expect(toVaultDocumentResponse(row({ mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).type).toBe('excel');
    expect(toVaultDocumentResponse(row({ mime_type: 'text/csv' })).type).toBe('excel');
    expect(toVaultDocumentResponse(row({ mime_type: 'application/msword' })).type).toBe('word');
    expect(toVaultDocumentResponse(row({ mime_type: 'application/octet-stream' })).type).toBe('other');
  });

  it('yükleyen adı yoksa — kullanır, related_id null ise undefined', () => {
    const r = toVaultDocumentResponse(row({ uploaded_by_name: null, related_id: null }));
    expect(r.uploadedBy).toBe('—');
    expect(r.relatedId).toBeUndefined();
  });

  // 003e: firma/proje bağı dış sözleşmeye taşınıyor — kasa ağacı buna dayanıyor.
  it('firma ve proje bilgisini taşır', () => {
    const r = toVaultDocumentResponse(row({
      organization_id: 'org1', organization_name: 'Revak Yapı',
      project_id: 'prj1', project_name: 'Mercury Çengelköy',
    }));
    expect(r.organizationId).toBe('org1');
    expect(r.organizationName).toBe('Revak Yapı');
    expect(r.projectId).toBe('prj1');
    expect(r.projectName).toBe('Mercury Çengelköy');
  });

  it('firma/proje yoksa alanları hiç göndermez (null yerine undefined)', () => {
    const r = toVaultDocumentResponse(row());
    expect(r.organizationId).toBeUndefined();
    expect(r.projectName).toBeUndefined();
  });
});
