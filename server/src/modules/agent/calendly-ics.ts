// =====================================================================
// Calendly bildirim mailindeki .ics ekini parse eder (free-tier senkron:
// webhook yok → Gmail'e düşen davet ekinden randevuyu çıkarırız).
// Saf fonksiyon — testlenebilir; Gmail/DB bilmez.
// =====================================================================

export interface ParsedCalendlyIcs {
  uid: string | null;
  start: string | null;   // ISO 8601 (UTC)
  end: string | null;
  summary: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  joinUrl: string | null;
  cancelled: boolean;
}

/** ICS satır katlamasını açar (RFC 5545: devam satırları boşlukla başlar). */
function unfold(ics: string): string[] {
  const out: string[] = [];
  for (const raw of ics.split(/\r?\n/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += raw.slice(1);
    } else {
      out.push(raw);
    }
  }
  return out;
}

/** 20260725T100000Z / 20260725T100000 → ISO. Z'siz değerler UTC varsayılır
 *  (Calendly ekleri pratikte UTC gönderir; yanılma payı dakika değil saat
 *  dilimi olurdu ve Meetings ekranında bariz görünürdü). */
function icsDateToIso(v: string): string | null {
  const m = v.trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
}

const escapeUnwrap = (s: string): string =>
  s.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

/**
 * hostEmails: bizim taraf (info@produality.com, bağlı Gmail hesabı vb.) —
 * davetli, ATTENDEE listesinde bunlardan OLMAYAN ilk kişidir.
 */
export function parseCalendlyIcs(ics: string, hostEmails: string[]): ParsedCalendlyIcs {
  const lines = unfold(ics);
  const hosts = hostEmails.map((e) => e.toLowerCase());

  let uid: string | null = null;
  let start: string | null = null;
  let end: string | null = null;
  let summary: string | null = null;
  let description = '';
  let location = '';
  let cancelled = false;
  const attendees: Array<{ name: string | null; email: string }> = [];

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('METHOD:CANCEL')) cancelled = true;
    if (upper.startsWith('STATUS:CANCELLED')) cancelled = true;
    if (upper.startsWith('UID')) uid = line.slice(line.indexOf(':') + 1).trim() || null;
    if (upper.startsWith('SUMMARY')) summary = escapeUnwrap(line.slice(line.indexOf(':') + 1).trim()) || null;
    if (upper.startsWith('DESCRIPTION')) description = escapeUnwrap(line.slice(line.indexOf(':') + 1));
    if (upper.startsWith('LOCATION')) location = escapeUnwrap(line.slice(line.indexOf(':') + 1));
    if (upper.startsWith('DTSTART')) start = icsDateToIso(line.slice(line.indexOf(':') + 1));
    if (upper.startsWith('DTEND')) end = icsDateToIso(line.slice(line.indexOf(':') + 1));
    if (upper.startsWith('ATTENDEE')) {
      const emailMatch = line.match(/mailto:([^;,\s]+)/i);
      if (emailMatch) {
        const cnMatch = line.match(/CN=("([^"]*)"|[^;:]+)/i);
        const cn = cnMatch ? (cnMatch[2] ?? cnMatch[1]).trim() : null;
        attendees.push({ name: cn && !cn.includes('@') ? cn : null, email: emailMatch[1].trim() });
      }
    }
  }

  const invitee = attendees.find((a) => !hosts.includes(a.email.toLowerCase())) ?? null;

  // Zoom/Meet linki: önce LOCATION, sonra DESCRIPTION içinde ara.
  const joinMatch = `${location}\n${description}`.match(
    /https:\/\/[^\s"'<>]*(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com)[^\s"'<>]*/i,
  );

  return {
    uid,
    start,
    end,
    summary,
    inviteeName: invitee?.name ?? null,
    inviteeEmail: invitee?.email ?? null,
    joinUrl: joinMatch ? joinMatch[0] : null,
    cancelled,
  };
}
