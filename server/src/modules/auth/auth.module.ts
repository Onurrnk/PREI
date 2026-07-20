import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleOAuthController } from './google-oauth.controller';
import { TokenStore, InMemoryTokenStore, DatabaseTokenStore } from './token.store';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AppConfig } from '../../config/configuration';

@Module({
  controllers: [GoogleOAuthController],
  providers: [
    GoogleOAuthService,
    GoogleCalendarService,
    JwtAuthGuard,
    DatabaseTokenStore,
    InMemoryTokenStore,
    {
      provide: TokenStore,
      // Encrypted DB-backed store when a key is configured (prod always
      // has one); falls back to in-memory only for bare local dev.
      useFactory: (config: ConfigService<AppConfig, true>, dbStore: DatabaseTokenStore, memStore: InMemoryTokenStore) =>
        config.get('tokenEncryptionKey', { infer: true }) ? dbStore : memStore,
      inject: [ConfigService, DatabaseTokenStore, InMemoryTokenStore],
    },
  ],
  exports: [GoogleOAuthService, GoogleCalendarService],
})
export class AuthModule {}
