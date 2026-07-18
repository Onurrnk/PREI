// =====================================================================
// welcome-email-copy — web'den gelen yeni yatırımcıya ilk temas metni.
// TR/EN, contact vs roi_report, Calendly CTA, kurucu kapanışı.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { buildWelcomeCopy } from './welcome-email-copy';

const CALENDLY = 'https://calendly.com/produality-info/30min';

describe('buildWelcomeCopy — TR', () => {
  it('contact: Sayın hitabı, Calendly CTA, emlak-ajansı-değil vurgusu', () => {
    const c = buildWelcomeCopy('tr', 'Ahmet Yılmaz', 'contact');
    expect(c.greeting).toBe('Sayın Ahmet Yılmaz,');
    expect(c.ctaUrl).toBe(CALENDLY);
    expect(c.ctaLabel).toBe('Size Uygun Zamanı Seçin');
    expect(c.paragraphs.join(' ')).toContain('emlak ajansı değil');
    expect(c.paragraphsAfterCta.at(-1)).toBe('Saygılarımla,');
  });

  it('contact: ROI rapor cümlesi İÇERMEZ', () => {
    const c = buildWelcomeCopy('tr', 'Ahmet', 'contact');
    expect(c.paragraphs.join(' ')).not.toContain('ROI raporu');
  });

  it('roi_report: ROI rapor cümlesi İÇERİR', () => {
    const c = buildWelcomeCopy('tr', 'Ahmet', 'roi_report');
    expect(c.paragraphs.join(' ')).toContain('ROI raporu');
  });
});

describe('buildWelcomeCopy — EN', () => {
  it('contact: Dear hitabı, İngilizce CTA, Sincerely kapanışı', () => {
    const c = buildWelcomeCopy('en', 'Ahmet Yılmaz', 'contact');
    expect(c.greeting).toBe('Dear Ahmet Yılmaz,');
    expect(c.ctaLabel).toBe('Choose a Time That Suits You');
    expect(c.ctaUrl).toBe(CALENDLY);
    expect(c.paragraphsAfterCta.at(-1)).toBe('Sincerely,');
  });

  it('roi_report: İngilizce ROI rapor cümlesi İÇERİR', () => {
    const c = buildWelcomeCopy('en', 'John', 'roi_report');
    expect(c.paragraphs.join(' ')).toContain('ROI report');
  });
});
