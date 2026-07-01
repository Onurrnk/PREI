import { Module } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleOAuthController } from './google-oauth.controller';
import { TokenStore, InMemoryTokenStore } from './token.store';

@Module({
  controllers: [GoogleOAuthController],
  providers: [
    GoogleOAuthService,
    // Swap InMemoryTokenStore for a Supabase/Postgres-backed store in prod.
    { provide: TokenStore, useClass: InMemoryTokenStore },
  ],
  exports: [GoogleOAuthService],
})
export class AuthModule {}
