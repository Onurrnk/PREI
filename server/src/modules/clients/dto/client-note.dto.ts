// =====================================================================
// PREI | ClientNote — iç not sözleşmesi (meeting_notes, source='text').
// Danışman görüşme debrief'leri; team & admin görür, müşteriye asla gitmez.
// =====================================================================
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { NoteRow } from '../clients.repository';

export class CreateClientNoteDto {
  @IsString() @MinLength(1) @MaxLength(4000)
  text!: string;

  @IsIn(['Meeting', 'Call', 'General'])
  tag!: string;
}

export interface ClientNoteResponse {
  id: string;
  author: string;
  role: string;
  tag: string;
  createdAt: string;
  text: string;
}

/** roles.key → görünen rol ('super_admin' → 'Admin', 'sales_consultant' → 'Consultant') */
function displayRole(key: string | null): string {
  if (!key) return 'Team';
  if (key === 'super_admin') return 'Admin';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace('Sales Consultant', 'Consultant');
}

export function toClientNoteResponse(row: NoteRow): ClientNoteResponse {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    author: row.author ?? 'Team',
    role: displayRole(row.author_role),
    tag: typeof m.tag === 'string' && m.tag ? m.tag : 'General',
    createdAt: row.created_at,
    text: row.raw_content ?? '',
  };
}
