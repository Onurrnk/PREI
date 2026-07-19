import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { PublicIntakeController } from './public-intake.controller';
import { IntakeService } from './intake.service';
import { IntakeRepository } from './intake.repository';
import { SubmissionTokenGuard } from './submission-token.guard';
import { StorageService } from '../documents/storage.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [IntakeController, PublicIntakeController],
  providers: [IntakeService, IntakeRepository, StorageService, SubmissionTokenGuard, JwtAuthGuard, RbacGuard],
})
export class IntakeModule {}
