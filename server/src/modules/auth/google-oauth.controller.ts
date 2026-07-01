// =====================================================================
// PREI | Google OAuth controller (thin)
// NOTE: `userId` here is a placeholder. In production it MUST be derived
// from the authenticated PREI session (JWT), never trusted from the
// client. Wire this to your auth guard and replace the `userId` query
// param with the principal from the request. Tracked as DEBT-GMAIL-002.
// =====================================================================
import { Controller, Get, Post, Query, Res, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { AppConfig } from '../../config/configuration';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('auth/google')
export class GoogleOAuthController {
  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Frontend calls this, then opens the returned URL to start consent. */
  @Get('url')
  getUrl(@Query('userId') userId: string): { url: string } {
    if (!userId) throw new BadRequestException('userId is required');
    return { url: this.oauth.getAuthUrl(userId) };
  }

  /** Google redirects here after consent. We persist tokens, then bounce
   *  the user back to the frontend. */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontend = this.config.get('frontendUrl', { infer: true });
    if (!code || !state) {
      res.redirect(`${frontend}/settings?gmail=error`);
      return;
    }
    try {
      await this.oauth.handleCallback(code, state);
      res.redirect(`${frontend}/settings?gmail=connected`);
    } catch {
      res.redirect(`${frontend}/settings?gmail=error`);
    }
  }

  @Get('status')
  status(@Query('userId') userId: string): Promise<{ connected: boolean; email: string | null }> {
    if (!userId) throw new BadRequestException('userId is required');
    return this.oauth.getConnection(userId);
  }

  @Post('disconnect')
  async disconnect(@Query('userId') userId: string): Promise<{ ok: true }> {
    if (!userId) throw new BadRequestException('userId is required');
    await this.oauth.disconnect(userId);
    return { ok: true };
  }
}
