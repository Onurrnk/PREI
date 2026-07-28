import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientsRepository } from './clients.repository';
import { PresentedService } from './presented/presented.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  // Yatırım hedefleri kişiye bağlı → ContactsModule.
  imports: [ContactsModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsRepository, PresentedService, JwtAuthGuard, RbacGuard],
})
export class ClientsModule {}
