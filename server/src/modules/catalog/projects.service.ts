import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogRepository } from './catalog.repository';
import type { RequestContext } from '../../common/request-context';
import { toProjectResponse, type ProjectResponse } from './dto/project-response.dto';
import type { CreateProjectDto } from './dto/create-project.dto';

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

  async create(ctx: RequestContext, dto: CreateProjectDto): Promise<ProjectResponse> {
    const row = await this.repo.createProject(ctx, {
      title: dto.title.trim(),
      developerId: dto.developerId ?? null,
      city: dto.city?.trim() || null,
      district: dto.district?.trim() || null,
      description: dto.description?.trim() || null,
      price: dto.price ?? null,
      currency: dto.currency ?? 'EUR',
      metadata: {
        project_status: dto.status ?? 'Off-plan',
        completion_date: dto.completionDate ?? '',
        total_units: dto.totalUnits ?? 0,
        available_units: dto.availableUnits ?? 0,
        payment_plan: dto.paymentPlan ?? [],
        amenities: dto.amenities ?? [],
        images: [],
        documents: [],
      },
    });
    return toProjectResponse(row);
  }
}
