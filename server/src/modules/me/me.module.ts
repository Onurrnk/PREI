import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Module({
  controllers: [MeController],
  providers: [JwtAuthGuard],
})
export class MeModule {}
