import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientsRepository } from './clients.repository';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  // Yatırım hedefleri kişiye bağlı → ContactsModule.
  imports: [ContactsModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsRepository, JwtAuthGuard, RbacGuard],
})
export class ClientsModule {}
