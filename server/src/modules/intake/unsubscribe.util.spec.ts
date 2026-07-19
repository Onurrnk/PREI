// =====================================================================
// unsubscribe.util — HMAC imzalı abonelikten-çık token/URL.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { signUnsubscribe, verifyUnsubscribe, unsubscribeUrl } from './unsubscribe.util';

const KEY = 'test-secret-key';
const CID = '11111111-1111-1111-1111-111111111111';

describe('unsubscribe.util', () => {
  it('imza sabit uzunlukta (32) ve deterministik', () => {
    const a = signUnsubscribe(CID, KEY);
    const b = signUnsubscribe(CID, KEY);
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it('doğru token → geçerli; kurcalanmış → geçersiz', () => {
    const token = signUnsubscribe(CID, KEY);
    expect(verifyUnsubscribe(CID, token, KEY)).toBe(true);
    expect(verifyUnsubscribe(CID, token.slice(0, -1) + '0', KEY)).toBe(false);
    expect(verifyUnsubscribe('22222222-2222-2222-2222-222222222222', token, KEY)).toBe(false);
  });

  it('farklı secret → doğrulama başarısız', () => {
    const token = signUnsubscribe(CID, KEY);
    expect(verifyUnsubscribe(CID, token, 'baska-secret')).toBe(false);
  });

  it('boş secret veya boş token → daima false (güvenli varsayılan)', () => {
    expect(verifyUnsubscribe(CID, signUnsubscribe(CID, KEY), '')).toBe(false);
    expect(verifyUnsubscribe(CID, '', KEY)).toBe(false);
  });

  it('unsubscribeUrl doğru contact + imza içerir', () => {
    process.env.UNSUBSCRIBE_SECRET = KEY;
    const url = unsubscribeUrl(CID, 'https://api.produality.com');
    expect(url).toContain(`c=${CID}`);
    expect(url).toContain(`t=${signUnsubscribe(CID, KEY)}`);
    delete process.env.UNSUBSCRIBE_SECRET;
  });
});
