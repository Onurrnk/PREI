import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, JwtAuthGuard, RbacGuard],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
