// =====================================================================
// PREI | ClientNote — iç not / görüşme kaydı sözleşmesi (meeting_notes).
// Danışman görüşme debrief'leri; team & admin görür, müşteriye asla gitmez.
// v2 (Onur talebi): yapılandırılmış görüşme alanları — ne zaman (occurredAt),
// hangi kanaldan (channel: telefon/yüz yüze/video/WhatsApp/mail), nerede
// (location), ne amaçla (purpose). Geriye dönük takip için metadata'da saklanır.
// =====================================================================
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { NoteRow } from '../clients.repository';

export const NOTE_CHANNELS = ['phone', 'meeting', 'video', 'whatsapp', 'email', 'other'] as const;

export class CreateClientNoteDto {
  @IsString() @MinLength(1) @MaxLength(4000)
  text!: string;

  @IsIn(['Meeting', 'Call', 'General'])
  tag!: string;

  /** Görüşme kanalı — telefon / yüz yüze / video / WhatsApp / e-posta. */
  @IsOptional() @IsIn(NOTE_CHANNELS as unknown as string[])
  channel?: string;

  /** Görüşmenin yapıldığı tarih+saat (ISO). Boşsa kayıt anı kabul edilir. */
  @IsOptional() @IsISO8601()
  occurredAt?: string;

  /** Nerede (ofis, Zoom, telefonla, müşterinin ofisi…). */
  @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  /** Ne amaçla (tanışma, portföy sunumu, fiyat pazarlığı…). */
  @IsOptional() @IsString() @MaxLength(200)
  purpose?: string;
}

export interface ClientNoteResponse {
  id: string;
  author: string;
  role: string;
  tag: string;
  createdAt: string;
  text: string;
  channel: string | null;
  occurredAt: string | null;
  location: string | null;
  purpose: string | null;
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
  const s = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    id: row.id,
    author: row.author ?? 'Team',
    role: displayRole(row.author_role),
    tag: typeof m.tag === 'string' && m.tag ? m.tag : 'General',
    createdAt: row.created_at,
    text: row.raw_content ?? '',
    channel: s(m.channel),
    occurredAt: s(m.occurred_at),
    location: s(m.location),
    purpose: s(m.purpose),
  };
}
