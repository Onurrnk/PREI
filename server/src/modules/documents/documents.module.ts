import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, StorageService, JwtAuthGuard, RbacGuard],
})
export class DocumentsModule {}
