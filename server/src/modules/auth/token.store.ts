// =====================================================================
// PREI | OAuth token storage
// Stores Google OAuth tokens PER PREI USER so each consultant connects
// their own Gmail mailbox.
//
// SECURITY: in production tokens MUST be encrypted at rest (e.g. AES-GCM
// with a KMS-managed key) and stored in Postgres/Supabase — NOT in memory.
// This in-memory implementation is for local development only; swap
// `InMemoryTokenStore` for a `SupabaseTokenStore` implementing the same
// interface. Tracked as DEBT-GMAIL-001.
// =====================================================================
import { Injectable } from '@nestjs/common';

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
