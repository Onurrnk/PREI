import { Module } from '@nestjs/common';
import { IntelController, AgentIntelController } from './intel.controller';
import { IntelService } from './intel.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { AgentKeyGuard } from '../../auth/agent-key.guard';

@Module({
  controllers: [IntelController, AgentIntelController],
  providers: [IntelService, JwtAuthGuard, RbacGuard, AgentKeyGuard],
})
export class IntelModule {}
