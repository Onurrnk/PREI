import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

// Global: her modül DatabaseService'i import'suz enjekte edebilir.
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
