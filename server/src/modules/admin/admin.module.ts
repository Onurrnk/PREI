import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { StorageService } from '../documents/storage.service';

@Module({
  controllers: [AuditController, AdminController],
  providers: [AuditService, AdminService, StorageService, JwtAuthGuard, RbacGuard],
})
export class AdminModule {}
