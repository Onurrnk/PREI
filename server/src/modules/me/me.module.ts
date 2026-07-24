import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { NotificationsService } from './notifications.service';
import { StorageService } from '../documents/storage.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Module({
  controllers: [MeController],
  providers: [NotificationsService, StorageService, JwtAuthGuard],
})
export class MeModule {}
