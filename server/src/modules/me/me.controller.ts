// =====================================================================
// PREI | /api/me — doğrulanmış kullanıcının profili + rolü + kendi
// profil/tercih ayarlarını okuma-yazma (Settings > Profile & Preferences).
// job_title/theme/locale/timezone/notification_prefs users.metadata jsonb'e
// yazılır (şema değişikliği gerekmedi — avatar zaten aynı deseni kullanıyor).
// JwtAuthGuard ctx'i doldurur; userId/role JWT'den gelir (DEBT-GMAIL-002).
// =====================================================================
import { Body, Controller, Get, Patch, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { DatabaseService } from '../../database/database.service';
import { UpdateMeDto } from './dto/update-me.dto';

interface MeRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  metadata: Record<string, unknown>;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async me(@Ctx() ctx: RequestContext) {
    if (!ctx.userId) throw new UnauthorizedException();
    const rows = await this.db.raw<MeRow>(
      `SELECT id, email, full_name, phone, metadata FROM users WHERE id = $1 AND is_active = true`,
      [ctx.userId],
    );
    if (rows.length === 0) throw new UnauthorizedException();
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.full_name,
      phone: row.phone,
      role: ctx.role,           // 5 rol seti: super_admin | manager | finance_manager | marketing_manager | consultant
      tenantId: ctx.tenantId,
      jobTitle: (row.metadata?.jobTitle as string) ?? null,
      aboutMe: (row.metadata?.aboutMe as string) ?? null,
      theme: (row.metadata?.theme as string) ?? 'dark',
      locale: (row.metadata?.locale as string) ?? null,
      timezone: (row.metadata?.timezone as string) ?? 'dubai',
      notificationPrefs: (row.metadata?.notificationPrefs as Record<string, boolean>) ?? {},
    };
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

    return {
      id: row.id,
      email: row.email,
      name: row.full_name,
      phone: row.phone,
      role: ctx.role,
      tenantId: ctx.tenantId,
      jobTitle: (row.metadata?.jobTitle as string) ?? null,
      aboutMe: (row.metadata?.aboutMe as string) ?? null,
      theme: (row.metadata?.theme as string) ?? 'dark',
      locale: (row.metadata?.locale as string) ?? null,
      timezone: (row.metadata?.timezone as string) ?? 'dubai',
      notificationPrefs: (row.metadata?.notificationPrefs as Record<string, boolean>) ?? {},
    };
  }
}
