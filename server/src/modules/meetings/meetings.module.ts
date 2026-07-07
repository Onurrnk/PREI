// =====================================================================
// PREI | MeetingsModule — takvim görünümü. tasks(task_type='meeting') üstünde
// salt-okuma; toplantıya özgü alanlar (yer/platform/süre/tür) metadata'dan.
// =====================================================================
import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [MeetingsController],
  providers: [MeetingsService, JwtAuthGuard, RbacGuard],
})
export class MeetingsModule {}
