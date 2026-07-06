import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { ProposalsRepository } from './proposals.repository';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [ProposalsController],
  providers: [ProposalsService, ProposalsRepository, JwtAuthGuard, RbacGuard],
})
export class ProposalsModule {}
