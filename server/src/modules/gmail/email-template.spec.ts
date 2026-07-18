// =====================================================================
// email-template — markalı müşteri e-postası (HTML + düz metin).
// Selamlama, CTA, buton-sonrası paragraflar, sosyal ikonlar, XSS escaping.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { buildClientEmailHtml, buildClientEmailText, type ClientEmailParams } from './email-template';

const base: ClientEmailParams = {
  recipientName: 'Ahmet',
  consultantName: 'Onur Nazım Karataş',
  consultantEmail: 'onur@produality.com',
  bodyParagraphs: ['Birinci paragraf.', 'İkinci paragraf.'],
};

describe('buildClientEmailHtml', () => {
  it('greeting verilmezse Türkçe varsayılanı kullanır', () => {
    const html = buildClientEmailHtml(base);
    expect(html).toContain('Sayın Ahmet,');
  });

  it('özel greeting verilince onu kullanır', () => {
    const html = buildClientEmailHtml({ ...base, greeting: 'Merhaba Ahmet,' });
    expect(html).toContain('Merhaba Ahmet,');
    expect(html).not.toContain('Sayın Ahmet,');
  });

  it('alıcı adındaki HTML\'i escape eder (XSS)', () => {
    const html = buildClientEmailHtml({ ...base, recipientName: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('ctaLabel + ctaUrl birlikte verilince buton çizer', () => {
    const html = buildClientEmailHtml({ ...base, ctaLabel: 'Görüşme Planlayın', ctaUrl: 'https://calendly.com/x' });
    expect(html).toContain('Görüşme Planlayın');
    expect(html).toContain('https://calendly.com/x');
  });

  it('cta eksikse buton çizmez', () => {
    const html = buildClientEmailHtml({ ...base, ctaLabel: 'X' }); // url yok
    expect(html).not.toContain('padding:12px 24px'); // buton stili
  });

  it('paragraphsAfterCta buton sonrası render edilir', () => {
    const html = buildClientEmailHtml({
      ...base, ctaLabel: 'X', ctaUrl: 'https://x.co',
      paragraphsAfterCta: ['Kapanış cümlesi.', 'Saygılarımla,'],
    });
    expect(html).toContain('Kapanış cümlesi.');
    expect(html).toContain('Saygılarımla,');
  });

  it('3 sosyal ikonu içerir, WhatsApp içermez', () => {
    const html = buildClientEmailHtml(base);
    expect(html).toContain('social/instagram.png');
    expect(html).toContain('social/linkedin.png');
    expect(html).toContain('social/facebook.png');
    expect(html).not.toContain('whatsapp.png');
  });

  it('footer ülke listesi TR+BAE+UK (İspanya yok)', () => {
    const html = buildClientEmailHtml(base);
    expect(html).toContain('BAE');
    expect(html).toContain('İngiltere');
    expect(html).not.toContain('İspanya');
  });

  it('danışman telefonu verilince imzada görünür', () => {
    const html = buildClientEmailHtml({ ...base, consultantPhone: '+90 507 857 69 05' });
    expect(html).toContain('+90 507 857 69 05');
  });
});

describe('buildClientEmailText', () => {
  it('greeting, gövde, cta ve imzayı düz metin olarak içerir', () => {
    const text = buildClientEmailText({
      ...base, greeting: 'Merhaba Ahmet,',
      ctaLabel: 'Görüşme Planlayın', ctaUrl: 'https://calendly.com/x',
      paragraphsAfterCta: ['Saygılarımla,'],
    });
    expect(text).toContain('Merhaba Ahmet,');
    expect(text).toContain('Birinci paragraf.');
    expect(text).toContain('Görüşme Planlayın: https://calendly.com/x');
    expect(text).toContain('Saygılarımla,');
    expect(text).toContain('Onur Nazım Karataş');
  });
});
