import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { AuthModule } from '../auth/auth.module';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [AuthModule, ContactsModule],
  controllers: [GmailController],
  providers: [GmailService],
})
export class GmailModule {}
