import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { AuthModule } from '../auth/auth.module';
import { ContactsModule } from '../contacts/contacts.module';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  imports: [AuthModule, ContactsModule],
  controllers: [GmailController],
  providers: [GmailService, JwtAuthGuard, RbacGuard],
  // AgentModule hoş geldiniz e-postasını GmailService üzerinden gönderir.
  exports: [GmailService],
})
export class GmailModule {}
