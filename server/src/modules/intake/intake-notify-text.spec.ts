// =====================================================================
// buildSubmissionNotifyText — admin Telegram yeni-gönderi bildirimi metni.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { buildSubmissionNotifyText } from './intake.service';

describe('buildSubmissionNotifyText', () => {
  it('başlık + geliştirici + konum + kuyruk linki içerir', () => {
    const t = buildSubmissionNotifyText({
      title: 'Emaar Beachfront', developerName: 'Emaar', location: 'Dubai · AE', isDuplicate: false,
    });
    expect(t).toContain('Emaar Beachfront');
    expect(t).toContain('Geliştirici: Emaar');
    expect(t).toContain('Konum: Dubai · AE');
    expect(t).toContain('https://prei.produality.com/projects/intake');
    expect(t).not.toContain('mükerrer');
  });

  it('geliştirici/konum yoksa güvenli fallback, konum satırı atlanır', () => {
    const t = buildSubmissionNotifyText({
      title: 'Proje X', developerName: null, location: null, isDuplicate: false,
    });
    expect(t).toContain('Geliştirici: —');
    expect(t).not.toContain('Konum:');
  });

  it('mükerrer ise uyarı satırı eklenir', () => {
    const t = buildSubmissionNotifyText({
      title: 'Proje X', developerName: 'D', location: null, isDuplicate: true,
    });
    expect(t).toContain('⚠️ Olası mükerrer/güncelleme');
  });
});
