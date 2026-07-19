import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProposalsRepository } from './proposals.repository';
import type { RequestContext } from '../../common/request-context';
import { toProposalResponse, type ProposalResponse } from './dto/proposal-response.dto';
import { computeRoi, type RoiInputs } from './roi.util';
import { buildProposalEmail } from './proposal-email';
import { GmailService } from '../gmail/gmail.service';
import type { CreateProposalDto } from './dto/create-proposal.dto';
import type { UpdateProposalDto } from './dto/update-proposal.dto';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly repo: ProposalsRepository,
    private readonly gmail: GmailService,
  ) {}

  async list(ctx: RequestContext, limit?: number, offset?: number): Promise<ProposalResponse[]> {
    const rows = await this.repo.list(ctx, limit, offset);
    return rows.map(toProposalResponse);
  }

  async findOne(ctx: RequestContext, id: string): Promise<ProposalResponse> {
    const row = await this.repo.findById(ctx, id);
    if (!row) throw new NotFoundException();
    return toProposalResponse(row);
  }

  async create(ctx: RequestContext, dto: CreateProposalDto): Promise<ProposalResponse> {
    const metadata = this.withRoiReport(dto.metadata ?? {}, dto.totalValue ?? null, dto.currency ?? 'EUR');
    const row = await this.repo.create(ctx, {
      title: dto.title.trim(),
      contactId: dto.contactId,
      propertyId: dto.propertyId ?? null,
      totalValue: dto.totalValue ?? null,
      currency: dto.currency ?? 'EUR',
      status: dto.status,
      metadata,
    });
    return toProposalResponse(row);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateProposalDto): Promise<ProposalResponse> {
    const existing = await this.repo.findById(ctx, id);
    if (!existing) throw new NotFoundException();

    const totalValue =
      dto.totalValue !== undefined
        ? dto.totalValue
        : existing.total_value !== null ? Number(existing.total_value) : null;

    // Gelen metadata parçasını ROI raporuyla zenginleştir (fiyat/roi girdisi değişmişse).
    const currency = dto.currency ?? existing.currency;
    const mergedForRoi = { ...(existing.metadata ?? {}), ...(dto.metadata ?? {}) };
    const metadataPatch = this.withRoiReport(dto.metadata ?? {}, totalValue, currency, mergedForRoi);

    const row = await this.repo.update(ctx, id, {
      title: dto.title,
      currency: dto.currency,
      totalValue: dto.totalValue,
      propertyId: dto.propertyId,
      status: dto.status,
      metadataPatch,
    });
    if (!row) throw new NotFoundException();
    return toProposalResponse(row);
  }

  /** Teklifi müşteriye danışmanın Gmail'inden markalı HTML olarak gönderir. */
  async send(ctx: RequestContext, id: string): Promise<ProposalResponse> {
    const row = await this.repo.findById(ctx, id);
    if (!row) throw new NotFoundException();
    const p = toProposalResponse(row);
    if (!p.clientEmail) throw new BadRequestException('client_email_missing');
    if (!ctx.userId) throw new BadRequestException('no_sender');

    const consultantName = await this.repo.ownerName(ctx);
    const { subject, html } = buildProposalEmail(p, consultantName);
    await this.gmail.sendHtmlEmail(ctx.userId, { to: p.clientEmail, subject, html });
    const sent = await this.repo.markSent(ctx, id);
    return toProposalResponse(sent ?? row);
  }

  /** metadata.roi (girdiler) + fiyat varsa metadata.roiReport'u hesaplar. */
  private withRoiReport(
    metadata: Record<string, unknown>,
    totalValue: number | null,
    currency: string,
    roiSource?: Record<string, unknown>,
  ): Record<string, unknown> {
    const src = roiSource ?? metadata;
    const roiInputs = src.roi as RoiInputs | undefined;
    if (roiInputs && typeof roiInputs === 'object' && totalValue && totalValue > 0) {
      return { ...metadata, roiReport: computeRoi(roiInputs, totalValue, currency) };
    }
    return metadata;
  }
}
