import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingSyncController } from './marketing-sync.controller';
import { MarketingService } from './marketing.service';
import { SocialService } from './social.service';
import { AdProposalsController } from './ad-proposals.controller';
import { AdProposalsService } from './ad-proposals.service';
import { MarketingBrainService } from './marketing-brain.service';
import { MarketingManagerService } from './marketing-manager.service';
import { MarketingRepository } from './marketing.repository';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { AgentKeyGuard } from '../../auth/agent-key.guard';

@Module({
  controllers: [AdProposalsController, MarketingController, MarketingSyncController],
  providers: [MarketingService, SocialService, AdProposalsService, MarketingBrainService, MarketingManagerService, MarketingRepository, JwtAuthGuard, RbacGuard, AgentKeyGuard],
})
export class MarketingModule {}
