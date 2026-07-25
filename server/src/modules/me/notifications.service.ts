// =====================================================================
// PREI | NotificationsService — Topbar bildirim zilini gerçek `events`
// akışından besler. Anlamlı olay türleri (yeni aday, randevu, teklif takibi,
// belge, kişi, müşteri notu) süzülür; okundu durumu users.metadata
// .notificationsSeenAt zaman damgasından türetilir (bu tarihten yeni = okunmadı).
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

// event_type → bildirim kategorisi (frontend ikon/renk + i18n metni için)
const NOTIF_KIND: Record<string, string> = {
  'lead.created': 'lead',
  'lead.web_form': 'lead',
  'contact.created': 'contact',
  'meeting.created': 'meeting',
  'proposal.follow_up_sent': 'proposal',
  'document.uploaded': 'document',
  'client.note_created': 'note',
  'marketing.manager_run': 'marketing',
};
const NOTIF_TYPES = Object.keys(NOTIF_KIND);

export interface NotificationItem {
  id: string;
  type: string;            // event_type (frontend i18n anahtarı)
  kind: string;            // lead | contact | meeting | proposal | document | note
  label: string | null;    // ilgili kişi/başlık (varsa)
  occurredAt: string;
  unread: boolean;
}

interface EventRow {
  id: string; event_type: string; occurred_at: string; label: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async feed(ctx: RequestContext, userId: string, limit = 20): Promise<{ items: NotificationItem[]; unreadCount: number }> {
    return this.db.withContext(ctx, async (c) => {
      const seenRes = await c.query<{ seen: string | null }>(
        `SELECT metadata->>'notificationsSeenAt' AS seen FROM users WHERE id = $1`,
        [userId],
      );
      const seenAt = seenRes.rows[0]?.seen ? new Date(seenRes.rows[0].seen).getTime() : 0;

      const { rows } = await c.query<EventRow>(
        `SELECT e.id, e.event_type, e.occurred_at,
                COALESCE(
                  (SELECT NULLIF(trim(ct.first_name || ' ' || coalesce(ct.last_name, '')), '')
                     FROM contacts ct WHERE ct.id = e.aggregate_id),
                  (SELECT NULLIF(trim(c2.first_name || ' ' || coalesce(c2.last_name, '')), '')
                     FROM leads l JOIN contacts c2 ON c2.id = l.contact_id WHERE l.id = e.aggregate_id),
                  (SELECT tk.title FROM tasks tk WHERE tk.id = e.aggregate_id),
                  e.payload->'after'->>'first_name'
                ) AS label
           FROM events e
          WHERE e.event_type = ANY($1)
          ORDER BY e.occurred_at DESC
          LIMIT $2`,
        [NOTIF_TYPES, limit],
      );

      const items: NotificationItem[] = rows.map((r) => ({
        id: r.id,
        type: r.event_type,
        kind: NOTIF_KIND[r.event_type] ?? 'lead',
        label: r.label ?? null,
        occurredAt: r.occurred_at,
        unread: new Date(r.occurred_at).getTime() > seenAt,
      }));
      return { items, unreadCount: items.filter((i) => i.unread).length };
    });
  }

  async markSeen(ctx: RequestContext, userId: string): Promise<{ ok: true }> {
    await this.db.withContext(ctx, (c) =>
      c.query(
        `UPDATE users SET metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('notificationsSeenAt', now()::text), updated_at = now()
          WHERE id = $1`,
        [userId],
      ),
    );
    return { ok: true };
  }
}
