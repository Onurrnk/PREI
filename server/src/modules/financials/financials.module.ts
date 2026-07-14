import { Module } from '@nestjs/common';
import { FinancialsController } from './financials.controller';
import { FinancialsService } from './financials.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [FinancialsController],
  providers: [FinancialsService, JwtAuthGuard, RbacGuard],
})
export class FinancialsModule {}
