import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractsRepository, type ContractWriteInput } from './contracts.repository';
import type { RequestContext } from '../../common/request-context';
import { toContractResponse, type ContractResponse } from './dto/contract-response.dto';
import type { CreateContractDto, UpdateContractDto } from './dto/contract-write.dto';

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

  /** commission/legalEntity/paymentTerms → metadata (read tarafı buradan okur). */
  private toWriteInput(dto: CreateContractDto | UpdateContractDto): ContractWriteInput {
    const metadataPatch: Record<string, unknown> = {};
    if (dto.commission !== undefined) metadataPatch.commission = dto.commission;
    if (dto.legalEntity !== undefined) metadataPatch.legal_entity = dto.legalEntity;
    if (dto.paymentTerms !== undefined) metadataPatch.payment_terms = dto.paymentTerms;
    return {
      contractType: dto.contractType,
      status: dto.status,
      propertyId: dto.propertyId,
      contactId: dto.contactId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      amount: dto.amount,
      currency: dto.currency,
      metadataPatch: Object.keys(metadataPatch).length ? metadataPatch : undefined,
    };
  }

  async create(ctx: RequestContext, dto: CreateContractDto): Promise<ContractResponse> {
    const row = await this.repo.create(ctx, this.toWriteInput(dto));
    return toContractResponse(row, []);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateContractDto): Promise<ContractResponse> {
    const row = await this.repo.update(ctx, id, this.toWriteInput(dto));
    if (!row) throw new NotFoundException();
    const docs = await this.repo.documentsByContractIds(ctx, [id]);
    return toContractResponse(row, docs);
  }
}
