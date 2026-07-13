// =====================================================================
// PREI | LeadCommunicationResponse — communications tablosundan salt-okuma.
// =====================================================================
import type { CommunicationRow } from '../leads.repository';

export interface LeadCommunicationResponse {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string | null;
  sentAt: string | null;
  handledBy: string | null;
}

export function toCommunicationResponse(row: CommunicationRow): LeadCommunicationResponse {
  return {
    id: row.id,
    channel: row.channel,
    direction: row.direction,
    subject: row.subject ?? null,
    body: row.body ?? null,
    sentAt: row.sent_at ?? null,
    handledBy: row.handled_by_name ?? null,
  };
}
