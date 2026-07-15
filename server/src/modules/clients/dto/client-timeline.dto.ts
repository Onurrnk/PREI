// =====================================================================
// PREI | ClientTimeline — iletişim zaman çizelgesi (communications → sunum).
// Skor: WhatsApp/Telegram mesajları için, mesaj anına en yakın (öncesindeki)
// lead_scores kaydı — Eylül'ün qualification skorunu taşır.
// =====================================================================
import type { TimelineCommunicationRow } from '../clients.repository';

export type ClientTimelineKind = 'email' | 'call' | 'whatsapp' | 'telegram' | 'sms';

export interface ClientTimelineEntryResponse {
  id: string;
  kind: ClientTimelineKind;
  title: string;
  body: string;
  time: string;
  score?: number;
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  sms: 'SMS',
};

const CHANNEL_KIND: Record<string, ClientTimelineKind> = {
  whatsapp: 'whatsapp',
  telegram: 'telegram',
  sms: 'sms',
  email: 'email',
  phone: 'call',
};

function communicationTitle(row: TimelineCommunicationRow): string {
  const subject = row.subject?.trim() || null;
  const outbound = row.direction === 'outbound';

  if (row.channel === 'email') {
    const verb = outbound ? 'Email sent' : 'Email received';
    return subject ? `${verb}: ${subject}` : verb;
  }
  if (row.channel === 'phone') {
    return subject ? `Call logged: ${subject}` : 'Call logged';
  }

  const label = CHANNEL_LABEL[row.channel] ?? row.channel;
  if (subject) return `${label} · ${subject}`;
  return outbound ? `${label} message sent` : `${label} message received`;
}

export function toClientTimelineEntry(row: TimelineCommunicationRow): ClientTimelineEntryResponse {
  const entry: ClientTimelineEntryResponse = {
    id: row.id,
    kind: CHANNEL_KIND[row.channel] ?? 'sms',
    title: communicationTitle(row),
    body: row.body ?? '',
    time: row.time,
  };
  if (row.score !== null && row.score !== undefined) entry.score = row.score;
  return entry;
}
