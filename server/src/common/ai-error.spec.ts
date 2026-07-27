import { describe, it, expect } from 'vitest';
import { friendlyAiError } from './ai-error';

describe('friendlyAiError', () => {
  // Kullanıcının bildirdiği gerçek hata — ham JSON ekrana dökülmemeli.
  it('kredi bakiyesi hatasını çevirir', () => {
    const raw = '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}';
    const msg = friendlyAiError(new Error(raw));
    expect(msg).toContain('bakiye');
    expect(msg).not.toContain('{');            // ham JSON sızmasın
    expect(msg).not.toContain('credit balance');
  });

  it('OpenAI insufficient_quota kredi mesajı verir', () => {
    expect(friendlyAiError(new Error('429 insufficient_quota'))).toContain('bakiye');
  });

  it('hız sınırı / kota', () => {
    expect(friendlyAiError(new Error('rate limit exceeded'))).toContain('yoğun');
    expect(friendlyAiError(new Error('Overloaded'))).toContain('yoğun');
  });

  it('geçersiz anahtar', () => {
    expect(friendlyAiError(new Error('invalid x-api-key'))).toContain('anahtar');
    expect(friendlyAiError(new Error('401 Unauthorized'))).toContain('anahtar');
  });

  it('ağ hatası', () => {
    expect(friendlyAiError(new Error('fetch failed'))).toContain('ağ');
    expect(friendlyAiError(new Error('ETIMEDOUT timeout'))).toContain('ağ');
  });

  // Tanınmayan hata ham metni sızdırmaz.
  it('tanınmayan hata ham metni göstermez', () => {
    const msg = friendlyAiError(new Error('some weird internal 500 blah {json}'));
    expect(msg).not.toContain('{json}');
    expect(msg).not.toContain('weird');
    expect(msg).toContain('yanıt veremedi');
  });

  it('Error olmayan girdiyi de yutar', () => {
    expect(typeof friendlyAiError('düz metin')).toBe('string');
    expect(typeof friendlyAiError(null)).toBe('string');
  });
});
