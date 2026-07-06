import { Module } from '@nestjs/common';
import { CatalogRepository } from './catalog.repository';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [ProjectsController, DevelopersController],
  providers: [CatalogRepository, ProjectsService, DevelopersService, JwtAuthGuard, RbacGuard],
})
export class CatalogModule {}
