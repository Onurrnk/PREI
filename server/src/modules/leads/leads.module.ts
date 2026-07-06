import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository, JwtAuthGuard, RbacGuard],
})
export class LeadsModule {}
