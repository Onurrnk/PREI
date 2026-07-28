import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CatalogRepository } from './catalog.repository';
import { MEDIA_BUCKET, StorageService } from '../documents/storage.service';
import type { RequestContext } from '../../common/request-context';
import { toProjectResponse, type ProjectResponse } from './dto/project-response.dto';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import { toAudience, type AudienceSummary } from './audience';

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

  /** Bu proje kimlere sunuldu (Sunulan Ürünler kaydının ters yönü). */
  async audience(ctx: RequestContext, id: string, lang: 'tr' | 'en' = 'tr'): Promise<AudienceSummary> {
    const row = await this.repo.findProject(ctx, id);
    if (!row) throw new NotFoundException();
    return toAudience(await this.repo.presentedAudience(ctx, id), lang);
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

  /** Proje tam-alan güncelleme — yalnız verilen alanlar değişir. */
  async update(ctx: RequestContext, id: string, dto: UpdateProjectDto): Promise<ProjectResponse> {
    const metadataPatch: Record<string, unknown> = {};
    if (dto.status !== undefined) metadataPatch.project_status = dto.status;
    if (dto.completionDate !== undefined) metadataPatch.completion_date = dto.completionDate;
    if (dto.totalUnits !== undefined) metadataPatch.total_units = dto.totalUnits;
    if (dto.availableUnits !== undefined) metadataPatch.available_units = dto.availableUnits;
    if (dto.paymentPlan !== undefined) metadataPatch.payment_plan = dto.paymentPlan;
    if (dto.amenities !== undefined) metadataPatch.amenities = dto.amenities;

    const row = await this.repo.updateProject(ctx, id, {
      title: dto.title?.trim(),
      developerId: dto.developerId,
      city: dto.city?.trim(),
      district: dto.district?.trim(),
      description: dto.description?.trim(),
      price: dto.price,
      currency: dto.currency,
      metadataPatch: Object.keys(metadataPatch).length ? metadataPatch : undefined,
    });
    if (!row) throw new NotFoundException();
    return toProjectResponse(row);
  }

  /** Yaşam döngüsü durumunu değiştirir (aktif/satıldı/duraklat/arşiv). */
  async setLifecycle(ctx: RequestContext, id: string, status: string): Promise<ProjectResponse> {
    const row = await this.repo.setLifecycleStatus(ctx, id, status);
    if (!row) throw new NotFoundException();
    return toProjectResponse(row);
  }

  /** Projeyi siler (soft delete). Test/yanlış giriş temizliği. */
  async remove(ctx: RequestContext, id: string): Promise<{ deleted: true }> {
    const ok = await this.repo.deleteProject(ctx, id);
    if (!ok) throw new NotFoundException('Proje bulunamadı.');
    return { deleted: true };
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

  /**
   * Görseli projeden kaldırır ve depodan siler.
   *
   * Depo silme BEST-EFFORT: dosya başka bir kayıtta da kullanılıyor olabilir
   * ya da harici bir URL olabilir. Kayıt her hâlükârda güncellenir —
   * kullanıcı "sildim" dediyse galeride görmemeli.
   */
  async removeImage(ctx: RequestContext, id: string, url: string): Promise<ProjectResponse> {
    const clean = (url ?? '').trim();
    if (!clean) throw new BadRequestException('Görsel adresi gerekli.');

    const row = await this.repo.removeProjectImage(ctx, id, clean);
    if (!row) throw new NotFoundException();

    const path = this.storage.pathFromPublicUrl(clean, MEDIA_BUCKET);
    if (path) {
      await this.storage.remove(path, MEDIA_BUCKET).catch(() => undefined);
    }
    return toProjectResponse(row);
  }
}
