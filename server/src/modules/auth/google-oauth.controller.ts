// =====================================================================
// PREI | Google OAuth controller (thin)
// url/status/disconnect require a valid PREI session (JwtAuthGuard) and
// always act on the authenticated caller's own ctx.userId — never a
// client-supplied id (DEBT-GMAIL-002, fully closed). `callback` is the one
// route Google itself hits with no session; it trusts the HMAC-signed
// `state` produced by `url` instead (see GoogleOAuthService.verifyState).
// =====================================================================
import { Controller, Get, Post, Query, Res, BadRequestException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { AppConfig } from '../../config/configuration';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('auth/google')
export class GoogleOAuthController {
  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Frontend calls this, then opens the returned URL to start consent. */
  @Get('url')
  @UseGuards(JwtAuthGuard)
  getUrl(@Ctx() ctx: RequestContext): { url: string } {
    return { url: this.oauth.getAuthUrl(ctx.userId!) };
  }

  /** Google redirects here after consent. We persist tokens, then bounce
   *  the user back to the frontend. No PREI session exists on this request —
   *  the signed `state` (minted by `url` above) is the only trust anchor. */
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
  @UseGuards(JwtAuthGuard)
  status(@Ctx() ctx: RequestContext): Promise<{ connected: boolean; email: string | null }> {
    return this.oauth.getConnection(ctx.userId!);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Ctx() ctx: RequestContext): Promise<{ ok: true }> {
    await this.oauth.disconnect(ctx.userId!);
    return { ok: true };
  }
}
