import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractsRepository } from './contracts.repository';
import type { RequestContext } from '../../common/request-context';
import { toContractResponse, type ContractResponse } from './dto/contract-response.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly repo: ContractsRepository) {}

  async list(ctx: RequestContext, limit?: number, offset?: number): Promise<ContractResponse[]> {
    const rows = await this.repo.list(ctx, limit, offset);
    const docs = await this.repo.documentsByContractIds(ctx, rows.map((r) => r.id));
    return rows.map((row) => toContractResponse(row, docs.filter((d) => d.related_id === row.id)));
  }

  async findOne(ctx: RequestContext, id: string): Promise<ContractResponse> {
    const row = await this.repo.findById(ctx, id);
    if (!row) throw new NotFoundException();
    const docs = await this.repo.documentsByContractIds(ctx, [id]);
    return toContractResponse(row, docs);
  }
}
