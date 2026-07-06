import { Module } from '@nestjs/common';
import { ContactMatcherService } from './contact-matcher.service';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactsRepository } from './contacts.repository';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [ContactsController],
  providers: [ContactMatcherService, ContactsService, ContactsRepository, JwtAuthGuard, RbacGuard],
  exports: [ContactMatcherService],
})
export class ContactsModule {}
