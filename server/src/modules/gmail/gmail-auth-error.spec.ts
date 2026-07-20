// =====================================================================
// invalid_grant tespiti + GmailReauthRequiredException kontratı.
// Amaç: ölü refresh token'ın (Google invalid_grant) unhandled 500 → Sentry
// yerine handled 424 'gmail_reauth_required'a dönüşmesini garanti etmek.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { isGmailAuthError, GmailReauthRequiredException } from './gmail.service';

describe('isGmailAuthError', () => {
  it('googleapis token-endpoint invalid_grant yanıtını yakalar', () => {
    expect(isGmailAuthError({ response: { data: { error: 'invalid_grant' } } })).toBe(true);
  });

  it('invalid_client / unauthorized_client OAuth hatalarını yakalar', () => {
    expect(isGmailAuthError({ response: { data: { error: 'invalid_client' } } })).toBe(true);
    expect(isGmailAuthError({ response: { data: { error: 'unauthorized_client' } } })).toBe(true);
  });

  it('mesaj metnindeki invalid_grant ifadesini yakalar', () => {
    expect(isGmailAuthError(new Error('invalid_grant: Token has been expired or revoked.'))).toBe(true);
    expect(isGmailAuthError({ message: 'No refresh token is set.' })).toBe(true);
  });

  it('geçici/ilgisiz hataları auth-hatası saymaz (bunlar 5xx kalmalı)', () => {
    expect(isGmailAuthError(new Error('getaddrinfo ENOTFOUND'))).toBe(false);
    expect(isGmailAuthError({ response: { data: { error: 'rateLimitExceeded' } } })).toBe(false);
    expect(isGmailAuthError({ message: 'Internal error' })).toBe(false);
    expect(isGmailAuthError(null)).toBe(false);
    expect(isGmailAuthError(undefined)).toBe(false);
  });
});

describe('GmailReauthRequiredException', () => {
  it('401 DEĞİL 424 (FAILED_DEPENDENCY) döner — kullanıcıyı PREI oturumundan atmaz', () => {
    const ex = new GmailReauthRequiredException();
    expect(ex.getStatus()).toBe(HttpStatus.FAILED_DEPENDENCY);
    expect(ex.getStatus()).not.toBe(HttpStatus.UNAUTHORIZED);
  });

  it('frontend/n8n için makine-okur kod taşır', () => {
    const body = new GmailReauthRequiredException().getResponse() as { code: string; message: string };
    expect(body.code).toBe('gmail_reauth_required');
    expect(body.message).toContain('Gmail');
  });
});
