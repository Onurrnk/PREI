import { Module } from '@nestjs/common';
import { IntelController, AgentIntelController } from './intel.controller';
import {
  PublishingPlanController, AgentPublishingController,
} from './publishing-plan.controller';
import { IntelService } from './intel.service';
import { ContentPackService } from './content-pack.service';
import { PublishingPlanService } from './publishing-plan.service';
import { GeminiImageService } from './gemini-image.service';
import { DriveService } from './drive.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Drive yüklemesi kullanıcının Google token'ını kullanır → AuthModule.
  imports: [AuthModule],
  controllers: [
    IntelController, AgentIntelController,
    PublishingPlanController, AgentPublishingController,
  ],
  providers: [
    IntelService, ContentPackService, PublishingPlanService,
    GeminiImageService, DriveService,
    JwtAuthGuard, RbacGuard, AgentKeyGuard,
  ],
})
export class IntelModule {}
