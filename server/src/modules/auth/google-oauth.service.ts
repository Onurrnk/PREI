// =====================================================================
// PREI | Google OAuth service
// Wraps Google's OAuth2 client: builds the consent URL, exchanges the
// authorization code for tokens, persists them per user, and returns an
// authorized client (auto-refreshing) for the Gmail module to use.
//
// `state` carries the PREI userId across the redirect to Google and back.
// Since Google's callback has no session/JWT, state is HMAC-signed with a
// short TTL (DEBT-GMAIL-002 fully closed: previously state was the raw
// userId, so anyone who completed their OWN consent flow could hand-craft
// a callback request with state=<victim-userId> and link their Gmail
// account to someone else's PREI account).
// =====================================================================
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { google, Auth } from 'googleapis';
import type { AppConfig } from '../../config/configuration';
import { TokenStore } from './token.store';

const STATE_TTL_MS = 10 * 60 * 1000; // consent flow should complete within 10 minutes

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly tokens: TokenStore,
  ) {}

  private createClient(): Auth.OAuth2Client {
    const g = this.config.get('google', { infer: true });
    return new google.auth.OAuth2(g.clientId, g.clientSecret, g.redirectUri);
  }

  /** Server-only secret for signing state — jwtSecret if configured, else clientSecret. */
  private stateSecret(): string {
    const supabase = this.config.get('supabase', { infer: true });
    const google = this.config.get('google', { infer: true });
    return supabase.jwtSecret || google.clientSecret;
  }

  private signState(userId: string): string {
    const payload = `${userId}.${Date.now() + STATE_TTL_MS}`;
    const sig = createHmac('sha256', this.stateSecret()).update(payload).digest('base64url');
    return `${Buffer.from(payload).toString('base64url')}.${sig}`;
  }

  /** Verify + decode a signed state; throws if tampered, malformed, or expired. */
  private verifyState(state: string): string {
    const [payloadB64, sig] = state.split('.');
    if (!payloadB64 || !sig) throw new UnauthorizedException('Invalid OAuth state.');
    const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const expectedSig = createHmac('sha256', this.stateSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid OAuth state.');
    }
    const [userId, expiryStr] = payload.split('.');
    if (!userId || Date.now() > Number(expiryStr)) {
      throw new UnauthorizedException('OAuth state expired — please retry.');
    }
    return userId;
  }

  /** Build the Google consent screen URL for the authenticated caller. */
  getAuthUrl(userId: string): string {
    const g = this.config.get('google', { infer: true });
    const client = this.createClient();
    return client.generateAuthUrl({
      access_type: 'offline', // request a refresh token
      prompt: 'consent', // ensure refresh token is returned on re-consent
      scope: g.scopes,
      state: this.signState(userId),
      include_granted_scopes: true,
    });
  }

  /** Exchange the auth code for tokens and persist them for the signed-state user. */
  async handleCallback(code: string, state: string): Promise<{ email: string | null }> {
    const userId = this.verifyState(state);
    const client = this.createClient();
    const { tokens } = await client.getToken(code);

    let email: string | null = null;
    if (tokens.id_token) {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.get('google', { infer: true }).clientId,
      });
      email = ticket.getPayload()?.email ?? null;
    }

    await this.tokens.set(userId, {
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ?? null,
      scope: tokens.scope ?? null,
      email,
    });

    return { email };
  }

  /** Return an OAuth2 client primed with the user's stored tokens. */
  async getAuthorizedClient(userId: string): Promise<Auth.OAuth2Client> {
    const stored = await this.tokens.get(userId);
    if (!stored) {
      throw new UnauthorizedException('Gmail not connected for this user.');
    }
    const client = this.createClient();
    client.setCredentials({
      access_token: stored.accessToken,
      refresh_token: stored.refreshToken ?? undefined,
      expiry_date: stored.expiryDate ?? undefined,
      scope: stored.scope ?? undefined,
    });

    // Persist refreshed tokens automatically.
    client.on('tokens', (t) => {
      void this.tokens.set(userId, {
        accessToken: t.access_token ?? stored.accessToken,
        refreshToken: t.refresh_token ?? stored.refreshToken ?? null,
        expiryDate: t.expiry_date ?? stored.expiryDate ?? null,
        scope: t.scope ?? stored.scope ?? null,
        email: stored.email ?? null,
      });
    });

    return client;
  }

  async getConnection(userId: string): Promise<{ connected: boolean; email: string | null }> {
    const stored = await this.tokens.get(userId);
    return { connected: !!stored, email: stored?.email ?? null };
  }

  async disconnect(userId: string): Promise<void> {
    await this.tokens.delete(userId);
  }
}
