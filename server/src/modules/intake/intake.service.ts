// =====================================================================
// PREI | IntakeService — davet linki üretimi + geliştirici gönderimi + kuyruk.
// Görseller media (public URL), broşür vault (imzalı URL) bucket'ına yüklenir.
// Onay gerçek `properties` satırı üretir (IntakeRepository.approve).
// =====================================================================
import {
  BadRequestException, Injectable, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import { IntakeRepository, type InviteRow, type SubmissionRow } from './intake.repository';
import { StorageService, MEDIA_BUCKET, VAULT_BUCKET } from '../documents/storage.service';
import type { CreateInviteDto, SubmitProjectDto } from './dto/intake.dto';
import type { InviteContext } from './submission-token.guard';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_BROCHURE = 15 * 1024 * 1024;
const MAX_IMAGES = 8;

interface UploadFile { originalname: string; mimetype: string; size: number; buffer: Buffer }

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
}

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);
  constructor(
    private readonly repo: IntakeRepository,
    private readonly storage: StorageService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private inviteUrl(token: string): string {
    const base = this.config.get('frontendUrl', { infer: true }).replace(/\/$/, '');
    return `${base}/submit/${token}`;
  }

  private toInvite(r: InviteRow) {
    const revoked = !!r.revoked_at;
    const expired = !!r.expires_at && new Date(r.expires_at) <= new Date();
    const exhausted = r.max_uses != null && r.used_count >= r.max_uses;
    return {
      id: r.id,
      developerId: r.developer_id,
      developerName: r.developer_name,
      label: r.label,
      url: this.inviteUrl(r.token),
      expiresAt: r.expires_at,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      status: revoked ? 'revoked' : expired ? 'expired' : exhausted ? 'exhausted' : 'active',
      createdAt: r.created_at,
    };
  }

  async createInvite(ctx: RequestContext, dto: CreateInviteDto) {
    const token = randomBytes(24).toString('base64url'); // ~32 char, URL-safe
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 86_400_000).toISOString()
      : null;
    const row = await this.repo.createInvite(ctx, {
      developerId: dto.developerId ?? null,
      label: dto.label ?? null,
      token,
      expiresAt,
      maxUses: dto.maxUses ?? null,
    });
    return this.toInvite(row);
  }

  async listInvites(ctx: RequestContext) {
    const rows = await this.repo.listInvites(ctx);
    return rows.map((r) => this.toInvite(r));
  }

  revokeInvite(ctx: RequestContext, id: string): Promise<boolean> {
    return this.repo.revokeInvite(ctx, id);
  }

  // ---- Public gönderim ----
  async submit(
    ctx: RequestContext,
    invite: InviteContext,
    dto: SubmitProjectDto,
    files: { brochure?: UploadFile[]; images?: UploadFile[] },
    ip: string | null,
  ) {
    const brochure = files.brochure?.[0];
    const images = files.images ?? [];

    if (!brochure) throw new BadRequestException('Broşür (PDF) zorunludur.');
    if (brochure.mimetype !== 'application/pdf') throw new BadRequestException('Broşür yalnız PDF olabilir.');
    if (brochure.size > MAX_BROCHURE) throw new BadRequestException('Broşür 15MB sınırını aşıyor.');
    if (images.length === 0) throw new BadRequestException('En az 1 görsel gereklidir.');
    if (images.length > MAX_IMAGES) throw new BadRequestException(`En fazla ${MAX_IMAGES} görsel.`);
    for (const im of images) {
      if (!IMAGE_MIMES.includes(im.mimetype)) throw new BadRequestException('Görseller yalnız JPEG/PNG/WEBP olabilir.');
      if (im.size > MAX_IMAGE) throw new BadRequestException('Bir görsel 10MB sınırını aşıyor.');
    }

    const submissionId = randomUUID();

    // Görseller → media (public URL)
    const imageUrls: string[] = [];
    for (const im of images) {
      const path = `submissions/${submissionId}/${randomUUID()}-${safeName(im.originalname)}`;
      await this.storage.upload(path, im.buffer, im.mimetype, MEDIA_BUCKET);
      imageUrls.push(this.storage.publicUrl(path, MEDIA_BUCKET));
    }

    // Broşür → vault (imzalı URL ile sunulur)
    const brochurePath = `submissions/${submissionId}/brochure-${randomUUID()}.pdf`;
    await this.storage.upload(brochurePath, brochure.buffer, 'application/pdf', VAULT_BUCKET);

    const unitTypes = (dto.unitTypes ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);

    await this.repo.insertSubmission(ctx, {
      id: submissionId,
      inviteId: invite.inviteId,
      developerId: invite.developerId,
      title: dto.title.trim(),
      city: dto.city?.trim() || null,
      district: dto.district?.trim() || null,
      marketCode: dto.marketCode ?? null,
      priceMin: dto.priceMin ?? null,
      priceMax: dto.priceMax ?? null,
      currency: dto.currency ?? 'EUR',
      commissionPct: dto.commissionPct ?? null,
      unitTypes,
      description: dto.description?.trim() || null,
      imageUrls,
      brochurePath,
      payload: {
        brochureName: safeName(brochure.originalname),
        brochureSize: brochure.size,
        completionDate: dto.completionDate ?? null,
        developerName: invite.developerName,
      },
      ip,
    });

    await this.repo.incrementInviteUse(invite.inviteId);
    this.logger.log(`Yeni proje gönderimi: ${submissionId} (davet ${invite.inviteId})`);
    return { ok: true as const, submissionId };
  }

  // ---- Onay kuyruğu ----
  async listQueue(ctx: RequestContext) {
    const rows = await this.repo.listSubmissions(ctx, 'pending');
    return Promise.all(rows.map((r) => this.toSubmission(r)));
  }

  async pendingCount(ctx: RequestContext): Promise<{ count: number }> {
    return { count: await this.repo.pendingCount(ctx) };
  }

  async getForReview(ctx: RequestContext, id: string) {
    const row = await this.repo.getSubmission(ctx, id);
    return row ? this.toSubmission(row) : null;
  }

  approve(ctx: RequestContext, id: string) {
    return this.repo.approve(ctx, id);
  }

  reject(ctx: RequestContext, id: string, note: string | null) {
    return this.repo.reject(ctx, id, note);
  }

  private async toSubmission(r: SubmissionRow) {
    let brochureUrl: string | null = null;
    if (r.brochure_path) {
      try {
        brochureUrl = await this.storage.signedUrl(r.brochure_path, 600, VAULT_BUCKET);
      } catch {
        brochureUrl = null; // imza üretilemezse önizleme yok, akış kırılmasın
      }
    }
    return {
      id: r.id,
      status: r.status,
      title: r.title,
      developerName: r.developer_name,
      city: r.city,
      district: r.district,
      marketCode: r.market_code,
      priceMin: r.price_min != null ? Number(r.price_min) : null,
      priceMax: r.price_max != null ? Number(r.price_max) : null,
      currency: r.currency,
      commissionPct: r.commission_pct != null ? Number(r.commission_pct) : null,
      unitTypes: r.unit_types,
      description: r.description,
      imageUrls: r.image_urls,
      brochureUrl,
      createdPropertyId: r.created_property_id,
      reviewNote: r.review_note,
      createdAt: r.created_at,
    };
  }
}
