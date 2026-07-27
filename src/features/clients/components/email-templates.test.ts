import { describe, it, expect } from 'vitest';
import { EMAIL_TEMPLATES, templatesFor, templateById } from './email-templates';

describe('email-templates', () => {
  it('iki dilde eşit sayıda şablon var (TR=EN)', () => {
    expect(templatesFor('tr')).toHaveLength(8);
    expect(templatesFor('en')).toHaveLength(8);
    expect(EMAIL_TEMPLATES).toHaveLength(16);
  });

  it('kimlikler benzersiz', () => {
    const ids = EMAIL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her şablonun adı, açıklaması, konusu ve gövdesi dolu', () => {
    for (const t of EMAIL_TEMPLATES) {
      expect(t.name.length, t.id).toBeGreaterThan(2);
      expect(t.description.length, t.id).toBeGreaterThan(10);
      expect(t.subject.length, t.id).toBeGreaterThan(5);
      expect(t.body.length, t.id).toBeGreaterThan(100);
    }
  });

  // Kompozör {client} yerine alıcı adını koyar — her gövde kişiselleştirilmeli.
  it('her gövde {client} yer tutucusu içerir', () => {
    for (const t of EMAIL_TEMPLATES) {
      expect(t.body.includes('{client}'), t.id).toBe(true);
    }
  });

  it('bilinmeyen yer tutucu yok (yalnız {client})', () => {
    for (const t of EMAIL_TEMPLATES) {
      const others = (t.subject + t.body).match(/\{(?!client\})[a-zA-Z]+\}/g);
      expect(others, `${t.id}: ${others?.join(',')}`).toBeNull();
    }
  });

  it('dil alanı içerikle tutarlı (TR şablonda Türkçe hitap, EN şablonda Hello)', () => {
    for (const t of templatesFor('tr')) expect(t.body.startsWith('Merhaba'), t.id).toBe(true);
    for (const t of templatesFor('en')) expect(t.body.startsWith('Hello'), t.id).toBe(true);
  });

  // Marka sesi: klişe açılışlar yasak.
  it('sıkıcı klişeler yok', () => {
    const banned = [/hope this email finds you well/i, /işbu/i, /sayın yetkili/i];
    for (const t of EMAIL_TEMPLATES) {
      for (const rx of banned) expect(rx.test(t.body), `${t.id} → ${rx}`).toBe(false);
    }
  });

  it('templateById bilineni bulur, bilinmeyene null döner', () => {
    expect(templateById('tr-tanisma')?.name).toBe('Tanışma / İlk Temas');
    expect(templateById('yok-boyle-sablon')).toBeNull();
  });
});
