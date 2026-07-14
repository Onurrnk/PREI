// =====================================================================
// PREI | OAuth token storage
// Stores Google OAuth tokens PER PREI USER so each consultant connects
// their own Gmail mailbox.
//
// DatabaseTokenStore persists into users.metadata->'googleOAuth' (same
// jsonb column already used for avatar/job_title/theme etc. — no new
// migration) with the access/refresh tokens AES-256-GCM encrypted at rest
// under TOKEN_ENCRYPTION_KEY (DEBT-GMAIL-001 closed: tokens no longer live
// only in process memory, so they survive backend restarts/redeploys).
// InMemoryTokenStore remains for local dev when no encryption key is set.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import type { AppConfig } from '../../config/configuration';

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null; // epoch ms
  scope?: string | null;
  email?: string | null; // the connected Gmail address
}

export abstract class TokenStore {
  abstract get(userId: string): Promise<StoredTokens | null>;
  abstract set(userId: string, tokens: StoredTokens): Promise<void>;
  abstract delete(userId: string): Promise<void>;
}

@Injectable()
export class InMemoryTokenStore extends TokenStore {
  private readonly store = new Map<string, StoredTokens>();

  async get(userId: string): Promise<StoredTokens | null> {
    return this.store.get(userId) ?? null;
  }

  async set(userId: string, tokens: StoredTokens): Promise<void> {
    const existing = this.store.get(userId);
    // Preserve the refresh token if Google omits it on a later exchange.
    this.store.set(userId, {
      ...tokens,
      refreshToken: tokens.refreshToken ?? existing?.refreshToken ?? null,
    });
  }

  async delete(userId: string): Promise<void> {
    this.store.delete(userId);
  }
}

interface EncryptedBlob {
  iv: string; // base64
  tag: string; // base64
  data: string; // base64
}

interface StoredGoogleOAuth {
  accessToken: EncryptedBlob;
  refreshToken: EncryptedBlob | null;
  expiryDate: number | null;
  scope: string | null;
  email: string | null;
}

@Injectable()
export class DatabaseTokenStore extends TokenStore {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    super();
  }

  private key(): Buffer {
    const hex = this.config.get('tokenEncryptionKey', { infer: true });
    return Buffer.from(hex, 'hex');
  }

  private encrypt(plain: string): EncryptedBlob {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  }

  private decrypt(blob: EncryptedBlob): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(blob.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]);
    return plain.toString('utf8');
  }

  /** Minimal RequestContext for RLS: only tenant/user identity matter for
   *  the `users` table's tenant-isolation policy, so role is a placeholder. */
  private async ctxFor(userId: string): Promise<RequestContext> {
    const rows = await this.db.raw<{ tenant_id: string }>(
      `SELECT tenant_id FROM users WHERE id = $1`,
      [userId],
    );
    return {
      correlationId: 'google-oauth-token-store',
      tenantId: rows[0]?.tenant_id ?? null,
      userId,
      role: 'consultant',
      authenticated: true,
    };
  }

  async get(userId: string): Promise<StoredTokens | null> {
    // SELECT-only — the narrow prei_bootstrap role (users/user_roles/roles)
    // covers this without needing a resolved tenant context.
    const rows = await this.db.raw<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM users WHERE id = $1`,
      [userId],
    );
    const stored = rows[0]?.metadata?.googleOAuth as StoredGoogleOAuth | undefined;
    if (!stored) return null;
    return {
      accessToken: this.decrypt(stored.accessToken),
      refreshToken: stored.refreshToken ? this.decrypt(stored.refreshToken) : null,
      expiryDate: stored.expiryDate,
      scope: stored.scope,
      email: stored.email,
    };
  }

  async set(userId: string, tokens: StoredTokens): Promise<void> {
    const existing = await this.get(userId);
    const refreshToken = tokens.refreshToken ?? existing?.refreshToken ?? null;
    const patch: { googleOAuth: StoredGoogleOAuth } = {
      googleOAuth: {
        accessToken: this.encrypt(tokens.accessToken),
        refreshToken: refreshToken ? this.encrypt(refreshToken) : null,
        expiryDate: tokens.expiryDate ?? null,
        scope: tokens.scope ?? null,
        email: tokens.email ?? null,
      },
    };
    const ctx = await this.ctxFor(userId);
    await this.db.withContext(ctx, (client) =>
      client.query(
        `UPDATE users SET metadata = metadata || $2::jsonb, updated_at = now() WHERE id = $1`,
        [userId, JSON.stringify(patch)],
      ),
    );
  }

  async delete(userId: string): Promise<void> {
    const ctx = await this.ctxFor(userId);
    await this.db.withContext(ctx, (client) =>
      client.query(
        `UPDATE users SET metadata = metadata - 'googleOAuth', updated_at = now() WHERE id = $1`,
        [userId],
      ),
    );
  }
}
