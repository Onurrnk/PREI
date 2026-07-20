// =====================================================================
// PREI | MeetingsModule — takvim görünümü. tasks(task_type='meeting') üstünde
// salt-okuma; toplantıya özgü alanlar (yer/platform/süre/tür) metadata'dan.
// =====================================================================
import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  imports: [AuthModule], // GoogleCalendarService (PREI randevusu → Google Takvim)
  controllers: [MeetingsController],
  providers: [MeetingsService, JwtAuthGuard, RbacGuard],
})
export class MeetingsModule {}
