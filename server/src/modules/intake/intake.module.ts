import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { PublicIntakeController } from './public-intake.controller';
import { IntakeNotifyController } from './intake-notify.controller';
import { IntakeService } from './intake.service';
import { IntakeRepository } from './intake.repository';
import { SubmissionTokenGuard } from './submission-token.guard';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { StorageService } from '../documents/storage.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [IntakeController, PublicIntakeController, IntakeNotifyController],
  providers: [IntakeService, IntakeRepository, StorageService, SubmissionTokenGuard, AgentKeyGuard, JwtAuthGuard, RbacGuard],
})
export class IntakeModule {}
