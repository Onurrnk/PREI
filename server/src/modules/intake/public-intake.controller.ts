// =====================================================================
// PREI | PublicIntakeController — /api/public/intake/:token
// Geliştiriciye özel tokenli, KİMLİK DOĞRULAMASIZ gönderim ucu.
// SubmissionTokenGuard token'ı doğrular + bağlamı service_agent yapar.
// Sıkı rate-limit (@Throttle). Dosyalar multipart (brochure + images).
// =====================================================================
import {
  Body, Controller, Get, Param, Post, Req, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { IntakeService } from './intake.service';
import { SubmitProjectDto } from './dto/intake.dto';
import { SubmissionTokenGuard, type WithInvite } from './submission-token.guard';

interface MulterFile { originalname: string; mimetype: string; size: number; buffer: Buffer }

@Controller('public/intake')
@UseGuards(SubmissionTokenGuard)
export class PublicIntakeController {
  constructor(private readonly intake: IntakeService) {}

  /** Form başlığı için: davet geçerli mi + hangi geliştirici. */
  @Get(':token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  info(@Req() req: Request & WithInvite) {
    const inv = req.preiInvite!;
    return { valid: true, developerName: inv.developerName, label: inv.label };
  }

  @Post(':token/submit')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'brochure', maxCount: 1 },
        { name: 'images', maxCount: 8 },          // eski istemci uyumu (genel)
        { name: 'imagesInterior', maxCount: 8 },  // iç mekan
        { name: 'imagesExterior', maxCount: 8 },  // dış mekan
        { name: 'imagesSocial', maxCount: 8 },    // sosyal alanlar
      ],
      { limits: { fileSize: 15 * 1024 * 1024 } },
    ),
  )
  submit(
    @Ctx() ctx: RequestContext,
    @Req() req: Request & WithInvite,
    @Body() dto: SubmitProjectDto,
    @UploadedFiles() files: {
      brochure?: MulterFile[]; images?: MulterFile[];
      imagesInterior?: MulterFile[]; imagesExterior?: MulterFile[]; imagesSocial?: MulterFile[];
    },
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress ?? null;
    return this.intake.submit(ctx, req.preiInvite!, dto, files, ip);
  }
}
