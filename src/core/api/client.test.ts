import { describe, it, expect } from 'vitest';
import { tokenStore, ApiError } from './client';

describe('tokenStore', () => {
  it('set → get aynı token’ı döndürür', () => {
    tokenStore.set('tok-123');
    expect(tokenStore.get()).toBe('tok-123');
  });

  it('clear sonrası get null döner (logout yolu)', () => {
    tokenStore.set('tok-123');
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });

  it('hiç set edilmemişse null döner (ilk açılış yolu)', () => {
    expect(tokenStore.get()).toBeNull();
  });
});

describe('ApiError', () => {
  it('status, message ve body taşır; Error örneğidir', () => {
    const err = new ApiError(404, 'Not found', { detail: 'x' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.body).toEqual({ detail: 'x' });
  });

  it('status 0 = ağ hatası konvansiyonu', () => {
    const err = new ApiError(0, 'Network error — could not reach the server.');
    expect(err.status).toBe(0);
  });
});
