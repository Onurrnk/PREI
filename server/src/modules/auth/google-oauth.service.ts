// =====================================================================
// PREI | Google OAuth service
// Wraps Google's OAuth2 client: builds the consent URL, exchanges the
// authorization code for tokens, persists them per user, and returns an
// authorized client (auto-refreshing) for the Gmail module to use.
// =====================================================================
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';
import type { AppConfig } from '../../config/configuration';
import { TokenStore } from './token.store';

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

  /** Build the Google consent screen URL. `state` carries the PREI userId. */
  getAuthUrl(userId: string): string {
    const g = this.config.get('google', { infer: true });
    const client = this.createClient();
    return client.generateAuthUrl({
      access_type: 'offline', // request a refresh token
      prompt: 'consent', // ensure refresh token is returned on re-consent
      scope: g.scopes,
      state: userId,
      include_granted_scopes: true,
    });
  }

  /** Exchange the auth code for tokens and persist them for the user. */
  async handleCallback(code: string, userId: string): Promise<{ email: string | null }> {
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
