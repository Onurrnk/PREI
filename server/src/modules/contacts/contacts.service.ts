import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  /** Duplicate ön-kontrolü: e-posta/telefonla mevcut kişi var mı (kayıttan önce). */
  async lookup(
    ctx: RequestContext, opts: { email?: string; phone?: string },
  ): Promise<{ match: { id: string; fullName: string; email: string | null; phone: string | null; matchedBy: string } | null }> {
    if (!opts.email?.trim() && !opts.phone?.trim()) return { match: null };
    const found = await this.repo.findByIdentity(ctx, opts);
    if (!found) return { match: null };
    const r = found.row;
    const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '—';
    return { match: { id: r.id, fullName, email: r.email, phone: r.phone, matchedBy: found.matchedBy } };
  }

  async create(ctx: RequestContext, dto: CreateContactDto): Promise<ContactResponse> {
    const row = await this.repo.create(ctx, dto);
    return toContactResponse(row);
  }

  /** KALICI silme — yalnız super_admin (G-1: deny → 404). İş verisi bağıysa 409. */
  async remove(ctx: RequestContext, id: string): Promise<{ deleted: true }> {
    if (ctx.role !== 'super_admin') throw new NotFoundException();
    const result = await this.repo.remove(ctx, id);
    if (result === 'not_found') throw new NotFoundException();
    if (result === 'has_business') {
      throw new ConflictException(
        'Bu kişi satış/finans/sözleşme kaydına bağlı — silinemez. Önce ilgili kayıtları kaldırın.',
      );
    }
    return { deleted: true };
  }
}
