// =====================================================================
// PREI | /api/me — doğrulanmış kullanıcının profili + rolü + kendi
// profil/tercih ayarlarını okuma-yazma (Settings > Profile & Preferences).
// job_title/theme/locale/timezone/notification_prefs + avatar users.metadata
// jsonb'e yazılır. Profil fotoğrafı POST /me/avatar ile 'media' bucket'ına
// yüklenir, kalıcı public URL metadata.avatar'a kaydedilir.
// Bildirim zili GET /me/notifications (gerçek events akışı) ile beslenir.
// JwtAuthGuard ctx'i doldurur; userId/role JWT'den gelir (DEBT-GMAIL-002).
// =====================================================================
import {
  BadRequestException, Body, Controller, Get, Patch, Post,
  UnauthorizedException, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { DatabaseService } from '../../database/database.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { StorageService, MEDIA_BUCKET } from '../documents/storage.service';
import { NotificationsService } from './notifications.service';

interface MeRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  metadata: Record<string, unknown>;
}

// Multipart yükleme — buffer + tip (documents ile aynı desen).
interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private toMe(row: MeRow, ctx: RequestContext) {
    const m = row.metadata ?? {};
    return {
      id: row.id,
      email: row.email,
      name: row.full_name,
      phone: row.phone,
      avatar: (m.avatar as string) ?? null,
      role: ctx.role,           // super_admin | manager | finance_manager | marketing_manager | consultant
      tenantId: ctx.tenantId,
      jobTitle: (m.jobTitle as string) ?? null,
      aboutMe: (m.aboutMe as string) ?? null,
      theme: (m.theme as string) ?? 'dark',
      locale: (m.locale as string) ?? null,
      timezone: (m.timezone as string) ?? 'dubai',
      notificationPrefs: (m.notificationPrefs as Record<string, boolean>) ?? {},
    };
  }

  @Get()
  async me(@Ctx() ctx: RequestContext) {
    if (!ctx.userId) throw new UnauthorizedException();
    const rows = await this.db.raw<MeRow>(
      `SELECT id, email, full_name, phone, metadata FROM users WHERE id = $1 AND is_active = true`,
      [ctx.userId],
    );
    if (rows.length === 0) throw new UnauthorizedException();
    return this.toMe(rows[0], ctx);
  }

  @Patch()
  async updateMe(@Ctx() ctx: RequestContext, @Body() dto: UpdateMeDto) {
    if (!ctx.userId) throw new UnauthorizedException();

    const metadataPatch: Record<string, unknown> = {};
    if (dto.jobTitle !== undefined) metadataPatch.jobTitle = dto.jobTitle;
    if (dto.aboutMe !== undefined) metadataPatch.aboutMe = dto.aboutMe;
    if (dto.theme !== undefined) metadataPatch.theme = dto.theme;
    if (dto.locale !== undefined) metadataPatch.locale = dto.locale;
    if (dto.timezone !== undefined) metadataPatch.timezone = dto.timezone;
    if (dto.notificationPrefs !== undefined) metadataPatch.notificationPrefs = dto.notificationPrefs;

    const row = await this.db.withContext(ctx, async (client) => {
      const res = await client.query<MeRow>(
        `UPDATE users
            SET full_name  = COALESCE($2, full_name),
                phone      = COALESCE($3, phone),
                metadata   = metadata || $4::jsonb,
                updated_at = now()
          WHERE id = $1
          RETURNING id, email, full_name, phone, metadata`,
        [ctx.userId, dto.fullName ?? null, dto.phone ?? null, JSON.stringify(metadataPatch)],
      );
      return res.rows[0] ?? null;
    });
    if (!row) throw new UnauthorizedException();
    return this.toMe(row, ctx);
  }

  /** Profil fotoğrafı yükle → 'media' bucket (public) → metadata.avatar. */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(@Ctx() ctx: RequestContext, @UploadedFile() file: UploadedFileLike) {
    if (!ctx.userId) throw new UnauthorizedException();
    if (!file) throw new BadRequestException('Dosya gerekli');
    if (!AVATAR_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Yalnızca görsel yükleyebilirsiniz (JPG, PNG, WEBP, GIF).');
    }
    const ext = AVATAR_EXT[file.mimetype] ?? 'jpg';
    const path = `avatars/${ctx.userId}-${Date.now()}.${ext}`;
    await this.storage.upload(path, file.buffer, file.mimetype, MEDIA_BUCKET);
    const url = this.storage.publicUrl(path, MEDIA_BUCKET);

    const row = await this.db.withContext(ctx, async (client) => {
      const res = await client.query<MeRow>(
        `UPDATE users SET metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('avatar', $2::text), updated_at = now()
          WHERE id = $1
          RETURNING id, email, full_name, phone, metadata`,
        [ctx.userId, url],
      );
      return res.rows[0] ?? null;
    });
    if (!row) throw new UnauthorizedException();
    return this.toMe(row, ctx);
  }

  @Get('notifications')
  async listNotifications(@Ctx() ctx: RequestContext) {
    if (!ctx.userId) throw new UnauthorizedException();
    return this.notifications.feed(ctx, ctx.userId);
  }

  @Post('notifications/seen')
  async markNotificationsSeen(@Ctx() ctx: RequestContext) {
    if (!ctx.userId) throw new UnauthorizedException();
    return this.notifications.markSeen(ctx, ctx.userId);
  }
}
