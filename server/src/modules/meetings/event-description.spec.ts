// =====================================================================
// buildEventDescription / buildEventSummary — Google Takvim etkinliğinin
// MARKALI metni (ProDuality marka sesi).
// =====================================================================
import { describe, it, expect } from 'vitest';
import { buildEventDescription, buildEventSummary } from './meetings.service';

describe('buildEventSummary', () => {
  it('başlığa ProDuality markası ekler', () => {
    expect(buildEventSummary({ title: 'Yatırım Görüşmesi — Duygu' })).toBe('ProDuality · Yatırım Görüşmesi — Duygu');
  });
  it('başlıkta zaten ProDuality varsa tekrar eklemez', () => {
    expect(buildEventSummary({ title: 'ProDuality Tanışma' })).toBe('ProDuality Tanışma');
  });
});

describe('buildEventDescription — markalı şablon', () => {
  const desc = buildEventDescription({
    kind: 'viewing', client: 'Kudret Kalyoncuoğlu', clientEmail: 'k@x.com',
    platform: 'In-person', location: 'Marina Vista Tower B', notes: 'Deniz manzaralı daireler öncelikli.',
  });

  it('marka başlığını içerir', () => {
    expect(desc).toContain('ProDuality');
    expect(desc).toContain('Bağımsız Uluslararası Gayrimenkul Danışmanlığı');
  });
  it('danışana ismiyle hitap eder', () => {
    expect(desc).toContain('Sayın Kudret Kalyoncuoğlu,');
  });
  it('türe göre sıcak açılış cümlesi kurar', () => {
    expect(desc).toContain('Mülk gezimiz için randevunuz oluşturuldu');
  });
  it('randevu detaylarını ve adresi listeler', () => {
    expect(desc).toContain('Görüşme türü: Mülk Gezisi');
    expect(desc).toContain('Biçim: Yüz yüze');
    expect(desc).toContain('Adres: Marina Vista Tower B');
  });
  it('notu ve marka imzasını içerir', () => {
    expect(desc).toContain('Not: Deniz manzaralı daireler öncelikli.');
    expect(desc).toContain('Onur Nazım Karataş');
    expect(desc).toContain('info@produality.com');
  });

  it('danışan adı yoksa nötr selamlama kullanır', () => {
    const d = buildEventDescription({ kind: 'meeting', platform: 'Phone', phone: '+90 555 111 22 33' });
    expect(d).toContain('Merhaba,');
    expect(d).toContain('Aranacak numara: +90 555 111 22 33');
    expect(d).not.toContain('Sayın');
  });
});
