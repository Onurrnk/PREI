// =====================================================================
// Meta DM yardımcıları — imza doğrulama + webhook normalleştirme.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyMetaSignature, verifyChallenge, normalizeMetaWebhook } from './meta-dm.util';

const SECRET = 'test_app_secret';
const sign = (body: string) => 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');

describe('verifyMetaSignature', () => {
  const body = JSON.stringify({ object: 'instagram', entry: [] });

  it('doğru imzayı kabul eder', () => {
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });
  it('gövde değişmişse reddeder', () => {
    expect(verifyMetaSignature(body + ' ', sign(body), SECRET)).toBe(false);
  });
  it('yanlış secret ile üretilmiş imzayı reddeder', () => {
    const bad = 'sha256=' + createHmac('sha256', 'baska').update(body).digest('hex');
    expect(verifyMetaSignature(body, bad, SECRET)).toBe(false);
  });
  it('imza yoksa / bozuksa / secret boşsa reddeder', () => {
    expect(verifyMetaSignature(body, undefined, SECRET)).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=xyz', SECRET)).toBe(false);
    expect(verifyMetaSignature(body, 'md5=abc', SECRET)).toBe(false);
    expect(verifyMetaSignature(body, sign(body), '')).toBe(false);
  });
});

describe('verifyChallenge', () => {
  it('mod + token doğruysa challenge döner', () => {
    expect(verifyChallenge(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': '12345' }, 'tok',
    )).toBe('12345');
  });
  it('token yanlışsa null', () => {
    expect(verifyChallenge(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'kotu', 'hub.challenge': '1' }, 'tok',
    )).toBeNull();
  });
  it('beklenen token tanımsızsa null (yanlış yapılandırmada açık kalmasın)', () => {
    expect(verifyChallenge(
      { 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': '1' }, '',
    )).toBeNull();
  });
});

describe('normalizeMetaWebhook', () => {
  const igBody = {
    object: 'instagram',
    entry: [{
      id: 'PAGE1', time: 1700000000,
      messaging: [{
        sender: { id: 'IGSID_123' }, recipient: { id: 'PAGE1' }, timestamp: 1700000001,
        message: { mid: 'mid_1', text: '  Merhaba, Dubai için bilgi alabilir miyim?  ' },
      }],
    }],
  };

  it('Instagram metin mesajını çıkarır ve kırpar', () => {
    const [m] = normalizeMetaWebhook(igBody);
    expect(m.channel).toBe('instagram');
    expect(m.senderId).toBe('IGSID_123');
    expect(m.text).toBe('Merhaba, Dubai için bilgi alabilir miyim?');
    expect(m.messageId).toBe('mid_1');
  });

  it('Messenger (object=page) → facebook kanalı', () => {
    const [m] = normalizeMetaWebhook({ ...igBody, object: 'page' });
    expect(m.channel).toBe('facebook');
  });

  it('ECHO mesajını atlar (kendi cevabımıza cevap yazmasın)', () => {
    const echo = {
      object: 'instagram',
      entry: [{ id: 'P', messaging: [{
        sender: { id: 'PAGE1' }, recipient: { id: 'IGSID_123' },
        message: { mid: 'm2', text: 'Merhabalar, ben Eylül', is_echo: true },
      }] }],
    };
    expect(normalizeMetaWebhook(echo)).toHaveLength(0);
  });

  it('silinmiş, metinsiz (yalnız medya) ve göndereni olmayan mesajları atlar', () => {
    const body = {
      object: 'instagram',
      entry: [{ id: 'P', messaging: [
        { sender: { id: 'A' }, message: { mid: 'a', text: 'x', is_deleted: true } },
        { sender: { id: 'B' }, message: { mid: 'b', attachments: [{}] } },
        { message: { mid: 'c', text: 'kimsiz' } },
      ] }],
    };
    expect(normalizeMetaWebhook(body)).toHaveLength(0);
  });

  it('bilinmeyen object / bozuk gövde → boş liste (çökmez)', () => {
    expect(normalizeMetaWebhook({ object: 'whatsapp_business_account', entry: [] })).toEqual([]);
    expect(normalizeMetaWebhook({})).toEqual([]);
    expect(normalizeMetaWebhook({ object: 'instagram' })).toEqual([]);
  });

  it('tek olayda birden çok mesajı sırayla döndürür', () => {
    const body = {
      object: 'instagram',
      entry: [{ id: 'P', messaging: [
        { sender: { id: 'A' }, message: { mid: '1', text: 'ilk' } },
        { sender: { id: 'A' }, message: { mid: '2', text: 'ikinci' } },
      ] }],
    };
    expect(normalizeMetaWebhook(body).map((m) => m.text)).toEqual(['ilk', 'ikinci']);
  });
});
