// =====================================================================
// PREI | IntelModule — haftalık rapor motoru.
//
// UI YOK. Bu modül PREI ekranlarına hiçbir şey basmaz: raporu alır,
// içeriğe çevirir, Google Drive'a yazar. İçerik üretimi Drive'da yaşar;
// PREI müşteri/işlem yönetir.
// =====================================================================
import { Module } from '@nestjs/common';
import { AgentIntelController } from './intel.controller';
import { AgentPublishingController } from './publishing-plan.controller';
import { IntelService } from './intel.service';
import { ContentPackService } from './content-pack.service';
import { PublishingPlanService } from './publishing-plan.service';
import { GeminiImageService } from './gemini-image.service';
import { DriveService } from './drive.service';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Drive yüklemesi kullanıcının Google token'ını kullanır → AuthModule.
  imports: [AuthModule],
  controllers: [AgentIntelController, AgentPublishingController],
  providers: [
    IntelService, ContentPackService, PublishingPlanService,
    GeminiImageService, DriveService, AgentKeyGuard,
  ],
})
export class IntelModule {}
