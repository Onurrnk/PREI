// =====================================================================
// PREI | VaultDocumentResponse — API sözleşmesi (frontend VaultDocumentDTO
// ile elle senkron, OV-8). Alan adları dondurulmuş UI ile birebir.
// =====================================================================
import type { VaultDocRow } from '../documents.repository';

export type VaultDocType = 'pdf' | 'image' | 'excel' | 'word' | 'other';

export interface VaultDocumentResponse {
  id: string;
  name: string;
  folder: string;
  type: VaultDocType;
  sizeMB: number;
  uploadedAt: string; // YYYY-MM-DD
  uploadedBy: string;
  relatedId?: string;
}

function typeFromMime(mime: string): VaultDocType {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return 'excel';
  if (mime.includes('word') || mime === 'application/msword') return 'word';
  return 'other';
}

export function toVaultDocumentResponse(row: VaultDocRow): VaultDocumentResponse {
  const bytes = Number(row.size_bytes);
  return {
    id: row.id,
    name: row.name,
    folder: row.folder,
    type: typeFromMime(row.mime_type),
    sizeMB: Math.round((bytes / (1024 * 1024)) * 100) / 100,
    // pg timestamptz Date objesi döner (leads'teki ::text dökümünün aksine)
    uploadedAt: new Date(row.created_at).toISOString().slice(0, 10),
    uploadedBy: row.uploaded_by_name ?? '—',
    relatedId: row.related_id ?? undefined,
  };
}
