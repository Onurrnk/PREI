import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogRepository } from './catalog.repository';
import type { RequestContext } from '../../common/request-context';
import { toProjectResponse, type ProjectResponse } from './dto/project-response.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly repo: CatalogRepository) {}

  async list(ctx: RequestContext, limit?: number, offset?: number): Promise<ProjectResponse[]> {
    const rows = await this.repo.listProjects(ctx, limit, offset);
    return rows.map(toProjectResponse);
  }

  async findOne(ctx: RequestContext, id: string): Promise<ProjectResponse> {
    const row = await this.repo.findProject(ctx, id);
    if (!row) throw new NotFoundException();
    return toProjectResponse(row);
  }
}
