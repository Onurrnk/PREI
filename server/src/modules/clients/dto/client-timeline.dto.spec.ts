import { describe, it, expect } from 'vitest';
import { toClientTimelineEntry } from './client-timeline.dto';
import type { TimelineCommunicationRow } from '../clients.repository';

const row = (overrides: Partial<TimelineCommunicationRow>): TimelineCommunicationRow => ({
  id: 'c1',
  channel: 'whatsapp',
  direction: 'inbound',
  subject: null,
  body: 'Merhaba',
  time: '2026-07-10T10:00:00Z',
  score: null,
  ...overrides,
});

describe('toClientTimelineEntry', () => {
  it('email gönderildi: subject varsa başlığa eklenir', () => {
    const entry = toClientTimelineEntry(
      row({ channel: 'email', direction: 'outbound', subject: 'Portfolio Update', body: 'PDF ekte.' }),
    );
    expect(entry.kind).toBe('email');
    expect(entry.title).toBe('Email sent: Portfolio Update');
    expect(entry.score).toBeUndefined();
  });

  it('phone → kind "call", subject yoksa jenerik başlık', () => {
    const entry = toClientTimelineEntry(row({ channel: 'phone', direction: 'outbound', subject: null }));
    expect(entry.kind).toBe('call');
    expect(entry.title).toBe('Call logged');
  });

  it('whatsapp inbound + skor varsa entry.score dolar', () => {
    const entry = toClientTimelineEntry(row({ channel: 'whatsapp', direction: 'inbound', score: 85 }));
    expect(entry.kind).toBe('whatsapp');
    expect(entry.title).toBe('WhatsApp message received');
    expect(entry.score).toBe(85);
  });

  it('telegram outbound, skor yok → score alanı tanımsız kalır', () => {
    const entry = toClientTimelineEntry(row({ channel: 'telegram', direction: 'outbound', score: null }));
    expect(entry.kind).toBe('telegram');
    expect(entry.title).toBe('Telegram message sent');
    expect(entry.score).toBeUndefined();
  });

  it('bilinmeyen kanal → sms fallback kind', () => {
    const entry = toClientTimelineEntry(row({ channel: 'fax' as never }));
    expect(entry.kind).toBe('sms');
  });
});
