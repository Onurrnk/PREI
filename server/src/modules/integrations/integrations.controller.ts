// =====================================================================
// PREI | /api/integrations — entegrasyonların tek listesi.
// Ayarlar ekranı bu uçtan beslenir; sabit "yakında" kutuları biter.
// =====================================================================
import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('settings')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  list(@Ctx() ctx: RequestContext, @Query('lang') lang?: string) {
    return this.integrations.list(ctx, lang === 'en' ? 'en' : 'tr');
  }

  @Delete(':provider')
  disconnect(@Ctx() ctx: RequestContext, @Param('provider') provider: string) {
    return this.integrations.disconnect(ctx, provider);
  }
}
