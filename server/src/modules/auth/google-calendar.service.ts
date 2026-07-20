// =====================================================================
// PREI | Google Calendar service
// PREI'de oluşturulan randevuyu (tasks task_type='meeting') bağlı Google
// hesabının takvimine etkinlik olarak yazar. Davetli e-postası verilirse
// attendee eklenir + sendUpdates:'all' ile davet gider → randevu HEM PREI
// takviminde HEM Google Takvim'de (ve davetlinin takviminde) görünür.
//
// Kimlik: GoogleOAuthService.getAuthorizedClient (Gmail ile AYNI OAuth token;
// calendar.events kapsamı reconnect'te verilir). service_role kullanılmaz.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface CalendarEventInput {
  summary: string;
  description?: string | null;
  location?: string | null;
  startIso: string;          // ISO 8601
  durationMinutes: number;   // >0
  attendeeEmail?: string | null;
  timeZone?: string;         // default Europe/Istanbul
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string | null;
}

/** '1h', '30m', '1h 30m', '90' (dk) → dakika. Boş/çözülemezse 60. */
export function parseDurationMinutes(label?: string | null): number {
  if (!label) return 60;
  const s = label.trim().toLowerCase();
  if (/^\d+$/.test(s)) return Math.max(1, parseInt(s, 10));
  let mins = 0;
  const h = /(\d+)\s*h/.exec(s);
  const m = /(\d+)\s*m/.exec(s);
  if (h) mins += parseInt(h[1], 10) * 60;
  if (m) mins += parseInt(m[1], 10);
  return mins > 0 ? mins : 60;
}

@Injectable()
export class GoogleCalendarService {
  constructor(private readonly oauth: GoogleOAuthService) {}

  async createEvent(userId: string, input: CalendarEventInput): Promise<CalendarEventResult> {
    const auth = await this.oauth.getAuthorizedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const tz = input.timeZone ?? 'Europe/Istanbul';
    const start = new Date(input.startIso);
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);

    const res = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: input.attendeeEmail ? 'all' : 'none',
      requestBody: {
        summary: input.summary,
        description: input.description ?? undefined,
        location: input.location ?? undefined,
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz },
        attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
      },
    });
    return { eventId: res.data.id ?? '', htmlLink: res.data.htmlLink ?? null };
  }

  /** PREI'de güncellenen randevuyu Google etkinliğine yansıtır (varsa). */
  async updateEvent(userId: string, eventId: string, input: CalendarEventInput): Promise<void> {
    const auth = await this.oauth.getAuthorizedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const tz = input.timeZone ?? 'Europe/Istanbul';
    const start = new Date(input.startIso);
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);
    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      sendUpdates: input.attendeeEmail ? 'all' : 'none',
      requestBody: {
        summary: input.summary,
        description: input.description ?? undefined,
        location: input.location ?? undefined,
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz },
      },
    });
  }

  /** PREI'de silinen randevunun Google etkinliğini kaldırır (varsa). */
  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const auth = await this.oauth.getAuthorizedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'all' });
  }
}
