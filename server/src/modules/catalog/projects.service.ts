import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CatalogRepository } from './catalog.repository';
import { MEDIA_BUCKET, StorageService } from '../documents/storage.service';
import type { RequestContext } from '../../common/request-context';
import { toProjectResponse, type ProjectResponse } from './dto/project-response.dto';
import type { CreateProjectDto } from './dto/create-project.dto';

export interface UploadedImageLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly storage: StorageService,
  ) {}

  async list(ctx: RequestContext, limit?: number, offset?: number): Promise<ProjectResponse[]> {
    const rows = await this.repo.listProjects(ctx, limit, offset);
    const docs = await this.repo.documentsByProjectIds(ctx, rows.map((r) => r.id));
    return rows.map((row) => toProjectResponse(row, docs.filter((d) => d.related_id === row.id)));
  }

  async findOne(ctx: RequestContext, id: string): Promise<ProjectResponse> {
    const row = await this.repo.findProject(ctx, id);
    if (!row) throw new NotFoundException();
    const docs = await this.repo.documentsByProjectIds(ctx, [id]);
    return toProjectResponse(row, docs);
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

  /** Proje görsellerini media bucket'ına yükler, public URL'leri metadata'ya ekler. */
  async uploadImages(ctx: RequestContext, id: string, files: UploadedImageLike[]): Promise<ProjectResponse> {
    if (!files || files.length === 0) throw new BadRequestException('Görsel dosyası gelmedi.');
    const existing = await this.repo.findProject(ctx, id);
    if (!existing) throw new NotFoundException();

    const urls: string[] = [];
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
        throw new BadRequestException(`Desteklenmeyen görsel türü: ${file.mimetype}`);
      }
      if (file.size > MAX_IMAGE_BYTES) {
        throw new BadRequestException(`Görsel çok büyük (maks 10MB): ${file.originalname}`);
      }
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
      const path = `projects/${id}/${randomUUID()}-${safeName}`;
      await this.storage.upload(path, file.buffer, file.mimetype, MEDIA_BUCKET);
      urls.push(this.storage.publicUrl(path));
    }

    const row = await this.repo.appendProjectImages(ctx, id, urls);
    if (!row) throw new NotFoundException();
    return toProjectResponse(row);
  }
}
