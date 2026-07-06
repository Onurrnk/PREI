import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import type { RequestContext } from '../../common/request-context';
import type { CreateContactDto } from './dto/contact.dto';
import { toContactResponse, type ContactResponse } from './dto/contact-response.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly repo: ContactsRepository) {}

  async list(ctx: RequestContext, search?: string, limit?: number, offset?: number): Promise<ContactResponse[]> {
    const rows = await this.repo.list(ctx, search, limit, offset);
    return rows.map(toContactResponse);
  }

  async findOne(ctx: RequestContext, id: string): Promise<ContactResponse> {
    const row = await this.repo.findById(ctx, id);
    if (!row) throw new NotFoundException();
    return toContactResponse(row);
  }

  async create(ctx: RequestContext, dto: CreateContactDto): Promise<ContactResponse> {
    const row = await this.repo.create(ctx, dto);
    return toContactResponse(row);
  }
}
