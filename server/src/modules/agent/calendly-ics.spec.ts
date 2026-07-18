// =====================================================================
// parseCalendlyIcs — Calendly .ics ekinden randevu çıkarımı.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { parseCalendlyIcs } from './calendly-ics';

const SAMPLE = [
  'BEGIN:VCALENDAR',
  'METHOD:REQUEST',
  'BEGIN:VEVENT',
  'UID:calendly-evt-abc123',
  'DTSTART:20260725T100000Z',
  'DTEND:20260725T103000Z',
  'SUMMARY:30 Minute Meeting between Onur Karataş and Ahmet Yılmaz',
  'ATTENDEE;CN="Onur Karataş";ROLE=REQ-PARTICIPANT:mailto:info@produality.com',
  'ATTENDEE;CN="Ahmet Yılmaz";ROLE=REQ-PARTICIPANT:mailto:ahmet@example.com',
  'DESCRIPTION:Event Name: 30 Minute Meeting\\nJoin Zoom Meeting:\\nhttps://us0',
  ' 6web.zoom.us/j/85512345678?pwd=abc',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parseCalendlyIcs', () => {
  it('davetliyi, saatleri, Zoom linkini ve UID yi çıkarır', () => {
    const r = parseCalendlyIcs(SAMPLE, ['info@produality.com']);
    expect(r.uid).toBe('calendly-evt-abc123');
    expect(r.start).toBe('2026-07-25T10:00:00.000Z');
    expect(r.end).toBe('2026-07-25T10:30:00.000Z');
    expect(r.inviteeName).toBe('Ahmet Yılmaz');
    expect(r.inviteeEmail).toBe('ahmet@example.com');
    // Katlanmış (folded) satır birleşti mi?
    expect(r.joinUrl).toBe('https://us06web.zoom.us/j/85512345678?pwd=abc');
    expect(r.cancelled).toBe(false);
    expect(r.summary).toContain('30 Minute Meeting');
  });

  it('host e-postası büyük/küçük harf duyarsız elenir', () => {
    const r = parseCalendlyIcs(SAMPLE, ['INFO@PRODUALITY.COM']);
    expect(r.inviteeEmail).toBe('ahmet@example.com');
  });

  it('iptal (METHOD:CANCEL) işaretlenir', () => {
    const r = parseCalendlyIcs(SAMPLE.replace('METHOD:REQUEST', 'METHOD:CANCEL'), ['info@produality.com']);
    expect(r.cancelled).toBe(true);
  });

  it('bozuk tarih null döner, akış kırılmaz', () => {
    const r = parseCalendlyIcs(SAMPLE.replace('20260725T100000Z', 'garbage'), ['info@produality.com']);
    expect(r.start).toBeNull();
    expect(r.end).toBe('2026-07-25T10:30:00.000Z');
  });
});
