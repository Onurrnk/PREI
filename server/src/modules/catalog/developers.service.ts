import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogRepository, type ProjectRow } from './catalog.repository';
import type { RequestContext } from '../../common/request-context';
import { toDeveloperResponse, type DeveloperResponse } from './dto/developer-response.dto';

@Injectable()
export class DevelopersService {
  constructor(private readonly repo: CatalogRepository) {}

  async list(ctx: RequestContext, limit?: number, offset?: number): Promise<DeveloperResponse[]> {
    const devs = await this.repo.listDevelopers(ctx, limit, offset);
    const projects = await this.repo.projectsForDevelopers(ctx, devs.map((d) => d.id));
    const byDev = this.groupByDeveloper(projects);
    return devs.map((d) => toDeveloperResponse(d, byDev.get(d.id) ?? []));
  }

  async findOne(ctx: RequestContext, id: string): Promise<DeveloperResponse> {
    const dev = await this.repo.findDeveloper(ctx, id);
    if (!dev) throw new NotFoundException();
    const projects = await this.repo.projectsForDevelopers(ctx, [id]);
    return toDeveloperResponse(dev, projects);
  }

  private groupByDeveloper(rows: ProjectRow[]): Map<string, ProjectRow[]> {
    const map = new Map<string, ProjectRow[]>();
    for (const r of rows) {
      if (!r.developer_id) continue;
      const list = map.get(r.developer_id) ?? [];
      list.push(r);
      map.set(r.developer_id, list);
    }
    return map;
  }
}
