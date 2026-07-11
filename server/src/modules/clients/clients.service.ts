import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientsRepository } from './clients.repository';
import type { RequestContext } from '../../common/request-context';
import { toClientResponse, type ClientResponse } from './dto/client-response.dto';
import type { UpdateClientDto } from './dto/client-update.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly repo: ClientsRepository) {}

  async list(ctx: RequestContext, limit?: number, offset?: number): Promise<ClientResponse[]> {
    const rows = await this.repo.list(ctx, limit, offset);
    return rows.map(toClientResponse);
  }

  async findOne(ctx: RequestContext, id: string): Promise<ClientResponse> {
    const row = await this.repo.findById(ctx, id);
    if (!row) throw new NotFoundException();
    return toClientResponse(row);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateClientDto): Promise<ClientResponse> {
    const row = await this.repo.update(ctx, id, dto);
    if (!row) throw new NotFoundException();
    return toClientResponse(row);
  }
}
