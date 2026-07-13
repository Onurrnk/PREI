import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import type { RequestContext } from '../../common/request-context';
import type { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
import { toLeadResponse, type LeadResponse } from './dto/lead-response.dto';
import { toCommunicationResponse, type LeadCommunicationResponse } from './dto/lead-communication.dto';
import { toLeadScoreResponse, type LeadScoreResponse } from './dto/lead-score.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly repo: LeadsRepository) {}

  async list(ctx: RequestContext, limit?: number, offset?: number): Promise<LeadResponse[]> {
    const rows = await this.repo.list(ctx, limit, offset);
    return rows.map(toLeadResponse);
  }

  async findOne(ctx: RequestContext, id: string): Promise<LeadResponse> {
    const lead = await this.repo.findById(ctx, id);
    if (!lead) throw new NotFoundException();
    return toLeadResponse(lead);
  }

  async listCommunications(ctx: RequestContext, id: string): Promise<LeadCommunicationResponse[]> {
    const rows = await this.repo.listCommunications(ctx, id);
    return rows.map(toCommunicationResponse);
  }

  async listScores(ctx: RequestContext, id: string): Promise<LeadScoreResponse[]> {
    const rows = await this.repo.listScores(ctx, id);
    return rows.map(toLeadScoreResponse);
  }

  async create(ctx: RequestContext, dto: CreateLeadDto): Promise<LeadResponse> {
    const lead = await this.repo.create(ctx, dto);
    return toLeadResponse(lead);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateLeadDto): Promise<LeadResponse> {
    const result = await this.repo.update(ctx, id, dto);
    if (result === 'not_found') throw new NotFoundException();
    if (result === 'conflict') {
      throw new ConflictException('Kayıt bu sırada değişti (version uyuşmadı). Yenileyip tekrar deneyin.');
    }
    return toLeadResponse(result);
  }
}
