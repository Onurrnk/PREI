import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingSyncController } from './marketing-sync.controller';
import { MarketingService } from './marketing.service';
import { SocialService } from './social.service';
import { MarketingRepository } from './marketing.repository';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { AgentKeyGuard } from '../../auth/agent-key.guard';

@Module({
  controllers: [MarketingController, MarketingSyncController],
  providers: [MarketingService, SocialService, MarketingRepository, JwtAuthGuard, RbacGuard, AgentKeyGuard],
})
export class MarketingModule {}
