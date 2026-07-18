import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { MarketingRepository } from './marketing.repository';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [MarketingController],
  providers: [MarketingService, MarketingRepository, JwtAuthGuard, RbacGuard],
})
export class MarketingModule {}
