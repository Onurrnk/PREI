import { describe, it, expect } from 'vitest';
import {
  PROVIDERS, providerById, availableProviders, buildAuthUrl,
} from './provider-registry';

describe('sağlayıcı kayıt defteri', () => {
  it('her sağlayıcının kimliği benzersiz', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her sağlayıcı iki dilde açıklama taşır', () => {
    for (const p of PROVIDERS) {
      expect(p.description.tr.length, p.id).toBeGreaterThan(10);
      expect(p.description.en.length, p.id).toBeGreaterThan(10);
    }
  });

  // Dürüstlük kuralı: hazır olmayan sağlayıcı NEDENİNİ söylemek zorunda.
  // Aksi hâlde kullanıcı "bağlan"a basıp neden olmadığını anlamıyor.
  it('hazır olmayan her sağlayıcı gerekçe taşır', () => {
    for (const p of PROVIDERS.filter((x) => !x.available)) {
      expect(p.blockedReason?.tr, p.id).toBeTruthy();
      expect(p.blockedReason?.en, p.id).toBeTruthy();
    }
  });

  it('kişisel/şirket kapsamı doğru ayrılmış', () => {
    expect(providerById('google')?.scope).toBe('user');       // kişisel kutu
    expect(providerById('meta_ads')?.scope).toBe('tenant');   // şirket varlığı
    expect(providerById('instagram')?.scope).toBe('tenant');
  });

  it('bilinmeyen kimlikte null döner', () => {
    expect(providerById('yok')).toBeNull();
    expect(providerById(null)).toBeNull();
  });

  it('bugün yalnız Google bağlanabilir', () => {
    expect(availableProviders().map((p) => p.id)).toEqual(['google']);
  });
});

describe('buildAuthUrl', () => {
  const google = providerById('google')!;

  it('gerekli parametreleri kurar', () => {
    const url = new URL(buildAuthUrl({
      provider: google, clientId: 'abc.apps', redirectUri: 'https://api.x/cb', state: 'imzali',
    }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('abc.apps');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.x/cb');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('imzali');
    expect(url.searchParams.get('scope')).toContain('gmail.modify');
  });

  it('sağlayıcıya özel parametreleri ekler (Google offline)', () => {
    const url = new URL(buildAuthUrl({
      provider: google, clientId: 'a', redirectUri: 'b', state: 'c',
    }));
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  // Yapılandırılmamış client id ile sessizce bozuk URL üretmek, kullanıcıyı
  // anlamsız bir Google hata sayfasına götürür. Erken ve açık patla.
  it('client id yoksa açık hata verir', () => {
    expect(() => buildAuthUrl({
      provider: google, clientId: '', redirectUri: 'b', state: 'c',
    })).toThrow(/client id/i);
  });
});
