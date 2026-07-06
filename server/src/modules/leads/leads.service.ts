import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadsRepository, type LeadRow } from './leads.repository';
import type { RequestContext } from '../../common/request-context';
import type { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly repo: LeadsRepository) {}

  list(ctx: RequestContext, limit?: number, offset?: number): Promise<LeadRow[]> {
    return this.repo.list(ctx, limit, offset);
  }

  async findOne(ctx: RequestContext, id: string): Promise<LeadRow> {
    const lead = await this.repo.findById(ctx, id);
    if (!lead) throw new NotFoundException();
    return lead;
  }

  create(ctx: RequestContext, dto: CreateLeadDto): Promise<LeadRow> {
    return this.repo.create(ctx, dto);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateLeadDto): Promise<LeadRow> {
    const result = await this.repo.update(ctx, id, dto);
    if (result === 'not_found') throw new NotFoundException();
    if (result === 'conflict') {
      throw new ConflictException('Kayıt bu sırada değişti (version uyuşmadı). Yenileyip tekrar deneyin.');
    }
    return result;
  }
}
