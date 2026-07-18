// =====================================================================
// buildMeetingTask — Calendly randevusundan görev başlığı + süre türetimi.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { buildMeetingTask } from './dto/meeting-event.dto';

describe('buildMeetingTask', () => {
  it('event adı varsa başlığa davetliyle birlikte koyar', () => {
    const r = buildMeetingTask({
      invitee_name: 'Ahmet Yılmaz', event_name: '30 Minute Meeting',
      start_time: '2026-07-20T10:00:00Z', end_time: '2026-07-20T10:30:00Z',
    });
    expect(r.title).toBe('30 Minute Meeting — Ahmet Yılmaz');
    expect(r.durationMinutes).toBe(30);
  });

  it('event adı yoksa Türkçe varsayılan başlık kullanır', () => {
    const r = buildMeetingTask({
      invitee_name: 'Sarah Ahmed', start_time: '2026-07-20T10:00:00Z',
    });
    expect(r.title).toBe('Yatırım Görüşmesi — Sarah Ahmed');
  });

  it('end_time yoksa süre 30 dk varsayılır', () => {
    const r = buildMeetingTask({ invitee_name: 'X', start_time: '2026-07-20T10:00:00Z' });
    expect(r.durationMinutes).toBe(30);
  });

  it('45 dakikalık randevunun süresini doğru hesaplar', () => {
    const r = buildMeetingTask({
      invitee_name: 'X', start_time: '2026-07-20T10:00:00Z', end_time: '2026-07-20T10:45:00Z',
    });
    expect(r.durationMinutes).toBe(45);
  });

  it('bozuk/ters end_time gelirse 30 dk varsayılana düşer', () => {
    expect(buildMeetingTask({
      invitee_name: 'X', start_time: '2026-07-20T10:00:00Z', end_time: 'bozuk',
    }).durationMinutes).toBe(30);
    expect(buildMeetingTask({
      invitee_name: 'X', start_time: '2026-07-20T10:00:00Z', end_time: '2026-07-20T09:00:00Z',
    }).durationMinutes).toBe(30);
  });
});
