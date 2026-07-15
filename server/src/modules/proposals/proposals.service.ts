import { Injectable, NotFoundException } from '@nestjs/common';
import { ProposalsRepository } from './proposals.repository';
import type { RequestContext } from '../../common/request-context';
import { toProposalResponse, type ProposalResponse } from './dto/proposal-response.dto';
import type { CreateProposalDto } from './dto/create-proposal.dto';

@Injectable()
export class ProposalsService {
  constructor(private readonly repo: ProposalsRepository) {}

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
    const row = await this.repo.create(ctx, {
      title: dto.title.trim(),
      contactId: dto.contactId,
      propertyId: dto.propertyId ?? null,
      totalValue: dto.totalValue ?? null,
      currency: dto.currency ?? 'EUR',
      metadata: dto.metadata ?? {},
    });
    return toProposalResponse(row);
  }
}
