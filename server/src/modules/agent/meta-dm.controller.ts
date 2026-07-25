// =====================================================================
// PREI | MetaDmController — Instagram/Messenger DM köprüsü + persona ucu.
//
// /api/agent/meta-webhook  PUBLIC'tir (Meta çağırır, kimlik doğrulaması
// yapamaz). Güvenlik X-Hub-Signature-256 imzasıyla sağlanır: App Secret
// yoksa veya imza tutmazsa istek REDDEDİLİR. Doğrulanan mesaj PREI'ye
// kaydedilir ve Eylül'ün beynine (n8n) iletilir; cevap Graph API ile gider.
//
// /api/agent/persona AgentKeyGuard'lıdır — n8n Eylül'ün metnini buradan
// çeker (tek kaynak; Telegram ve DM aynı sesle konuşur).
// =====================================================================
import {
  Body, Controller, ForbiddenException, Get, Headers, HttpCode, Logger,
  Post, Query, RawBodyRequest, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import type { AppConfig } from '../../config/configuration';
import { MetaDmService } from './meta-dm.service';
import { EylulBrainService } from './eylul-brain.service';
import { EYLUL_PERSONA, EYLUL_RULES, type PersonaResponse } from './eylul-persona';
import { normalizeMetaWebhook, verifyChallenge, verifyMetaSignature, type RawWebhookBody } from './meta-dm.util';
import { randomUUID } from 'crypto';

@Controller('agent')
export class MetaDmController {
  private readonly logger = new Logger(MetaDmController.name);

  constructor(
    private readonly dm: MetaDmService,
    private readonly brain: EylulBrainService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Meta webhook el sıkışması — doğrulama token'ı eşleşirse challenge döner. */
  @Get('meta-webhook')
  verify(@Query() query: Record<string, string>): string {
    const { verifyToken } = this.config.get('metaDm', { infer: true });
    const challenge = verifyChallenge(query, verifyToken);
    if (challenge === null) {
      this.logger.warn('Meta webhook doğrulaması reddedildi (token uyuşmadı).');
      throw new ForbiddenException();
    }
    return challenge;
  }

  /**
   * Gelen DM. Meta 20 sn içinde 200 bekler ve aksi halde tekrar dener →
   * kaydı yapıp HEMEN 200 döneriz; cevap üretimi arka planda ilerler.
   */
  @Post('meta-webhook')
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: RawWebhookBody,
  ): Promise<{ ok: true }> {
    const { appSecret } = this.config.get('metaDm', { infer: true });
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}), 'utf8');

    if (!verifyMetaSignature(raw, signature, appSecret)) {
      this.logger.warn('Meta webhook imzası geçersiz — istek reddedildi.');
      throw new ForbiddenException();
    }

    const messages = normalizeMetaWebhook(body);
    if (messages.length === 0) return { ok: true };

    const ctx = await this.dm.serviceContext(randomUUID());
    for (const msg of messages) {
      // Hata bir mesajı düşürsün, tüm isteği değil (Meta tekrar denemesin).
      try {
        const name = await this.dm.fetchSenderName(msg.senderId);
        const res = await this.dm.ingest(ctx, msg, name ?? undefined);
        if (res.deduped) continue; // Meta aynı mesajı tekrar yolladı
        this.logger.log(`DM alındı (${msg.channel}): lead=${res.leadId}`);

        const reply = await this.brain.respond(ctx, {
          leadId: res.leadId,
          contactId: res.contactId,
          message: msg.text,
          channel: msg.channel,
        });
        if (!reply) {
          this.logger.warn(`Cevap üretilemedi (${msg.channel}) — mesaj kayıtlı, Onur Bey görebilir.`);
          continue;
        }
        const sent = await this.dm.reply(ctx, {
          channel: msg.channel,
          recipientId: msg.senderId,
          text: reply,
          leadId: res.leadId,
          contactId: res.contactId,
        });
        if (!sent.sent) this.logger.warn(`DM cevabı gönderilemedi: ${sent.message}`);
      } catch (e) {
        this.logger.error(`DM işlenemedi (${msg.channel}): ${(e as Error).message}`);
      }
    }
    return { ok: true };
  }

  /** Eylül'ün persona + kuralları — n8n akışları buradan çeker (tek kaynak). */
  @Get('persona')
  @UseGuards(AgentKeyGuard)
  persona(@Ctx() _ctx: RequestContext): PersonaResponse {
    return {
      persona: EYLUL_PERSONA,
      rules: EYLUL_RULES,
      version: `${EYLUL_PERSONA.length}-${EYLUL_RULES.length}`,
    };
  }
}
