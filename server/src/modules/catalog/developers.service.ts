import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogRepository, type ProjectRow } from './catalog.repository';
import type { RequestContext } from '../../common/request-context';
import { toDeveloperResponse, type DeveloperResponse } from './dto/developer-response.dto';
import type { CreateDeveloperDto, UpdateDeveloperDto } from './dto/create-developer.dto';

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

  async create(ctx: RequestContext, dto: CreateDeveloperDto): Promise<DeveloperResponse> {
    const dev = await this.repo.createDeveloper(ctx, {
      name: dto.name.trim(),
      phone: dto.keyContactPhone?.trim() || null,
      email: dto.keyContactEmail?.trim() || null,
      metadata: {
        tier: dto.tier ?? 'Boutique',
        headquarters: dto.headquarters ?? '',
        partnership_status: dto.partnershipStatus ?? 'Active',
        commission_rate: dto.commissionRate ?? '',
        key_contact_name: dto.keyContactName ?? '',
        key_contact_email: dto.keyContactEmail ?? '',
        key_contact_phone: dto.keyContactPhone ?? '',
        website: dto.website ?? '',
      },
    });
    return toDeveloperResponse(dev, []);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateDeveloperDto): Promise<DeveloperResponse> {
    const metadataPatch: Record<string, unknown> = {};
    if (dto.tier !== undefined) metadataPatch.tier = dto.tier;
    if (dto.headquarters !== undefined) metadataPatch.headquarters = dto.headquarters;
    if (dto.partnershipStatus !== undefined) metadataPatch.partnership_status = dto.partnershipStatus;
    if (dto.commissionRate !== undefined) metadataPatch.commission_rate = dto.commissionRate;
    if (dto.keyContactName !== undefined) metadataPatch.key_contact_name = dto.keyContactName;
    if (dto.keyContactEmail !== undefined) metadataPatch.key_contact_email = dto.keyContactEmail;
    if (dto.keyContactPhone !== undefined) metadataPatch.key_contact_phone = dto.keyContactPhone;
    if (dto.website !== undefined) metadataPatch.website = dto.website;

    const dev = await this.repo.updateDeveloper(ctx, id, {
      name: dto.name?.trim() ?? null,
      phone: dto.keyContactPhone?.trim() ?? null,
      email: dto.keyContactEmail?.trim() ?? null,
      metadataPatch,
    });
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
