import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientsRepository } from './clients.repository';
import { InvestmentTargetsService } from '../contacts/investment-targets.service';
import { readEngagement, applyEngagement, type Engagement } from './engagement';
import type { RequestContext } from '../../common/request-context';
import { toClientResponse, type ClientResponse } from './dto/client-response.dto';
import type { UpdateClientDto } from './dto/client-update.dto';
import { toClientNoteResponse, type ClientNoteResponse, type CreateClientNoteDto } from './dto/client-note.dto';
import { toClientTimelineEntry, type ClientTimelineEntryResponse } from './dto/client-timeline.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly repo: ClientsRepository,
    private readonly targets: InvestmentTargetsService,
  ) {}

  async list(ctx: RequestContext, limit?: number, offset?: number): Promise<ClientResponse[]> {
    const rows = await this.repo.list(ctx, limit, offset);
    const clients = rows.map(toClientResponse);
    // Hedefler tek sorguda gelir — müşteri başına ayrı istek yapılmaz.
    const ids = clients.map((c) => c.id);
    const byContact = await this.targets.listForContacts(ctx, ids);
    const leadStates = await this.repo.leadStatesFor(ctx, ids);
    for (const c of clients) {
      c.investmentTargets = byContact.get(c.id) ?? [];
      c.engagement = readEngagement(leadStates.get(c.id) ?? null);
    }
    return clients;
  }

  async findOne(ctx: RequestContext, id: string): Promise<ClientResponse> {
    const row = await this.repo.findById(ctx, id);
    if (!row) throw new NotFoundException();
    const client = toClientResponse(row);
    client.investmentTargets = await this.targets.listForContact(ctx, client.id);
    const states = await this.repo.leadStatesFor(ctx, [client.id]);
    client.engagement = readEngagement(states.get(client.id) ?? null);
    return client;
  }

  /**
   * Sıcak / normal / dondurulmuş ataması (madde 25).
   * Tek kontrol, iki mevcut alana (status + priority) yazar.
   */
  async setEngagement(
    ctx: RequestContext, contactId: string, next: Engagement,
  ): Promise<ClientResponse> {
    const states = await this.repo.leadStatesFor(ctx, [contactId]);
    const current = states.get(contactId);
    if (!current) {
      throw new NotFoundException('Bu müşteriye bağlı aday kaydı yok.');
    }
    const patch = applyEngagement(current, next);
    if (Object.keys(patch).length > 0) {
      await this.repo.patchLatestLead(ctx, contactId, patch);
    }
    return this.findOne(ctx, contactId);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateClientDto): Promise<ClientResponse> {
    const row = await this.repo.update(ctx, id, dto);
    if (!row) throw new NotFoundException();
    return toClientResponse(row);
  }

  /** Adayı Müşteriye çevirir (kayıt alındı). Güncel kaydı döndürür. */
  async convertToCustomer(
    ctx: RequestContext, id: string,
  ): Promise<{ result: 'converted' | 'already'; client: ClientResponse }> {
    const result = await this.repo.convertToCustomer(ctx, id);
    if (result === 'not_found') throw new NotFoundException('Kişi bulunamadı.');
    return { result, client: await this.findOne(ctx, id) };
  }

  async listNotes(ctx: RequestContext, contactId: string): Promise<ClientNoteResponse[]> {
    const rows = await this.repo.listNotes(ctx, contactId);
    return rows.map(toClientNoteResponse);
  }

  async createNote(ctx: RequestContext, contactId: string, dto: CreateClientNoteDto): Promise<ClientNoteResponse> {
    const row = await this.repo.createNote(ctx, contactId, dto.text.trim(), dto.tag, {
      channel: dto.channel ?? null,
      occurred_at: dto.occurredAt ?? null,
      location: dto.location?.trim() || null,
      purpose: dto.purpose?.trim() || null,
    });
    return toClientNoteResponse(row);
  }

  async updateNote(
    ctx: RequestContext, contactId: string, noteId: string, dto: CreateClientNoteDto,
  ): Promise<ClientNoteResponse> {
    const row = await this.repo.updateNote(ctx, contactId, noteId, dto.text.trim(), dto.tag, {
      channel: dto.channel ?? null,
      occurred_at: dto.occurredAt ?? null,
      location: dto.location?.trim() || null,
      purpose: dto.purpose?.trim() || null,
    });
    if (!row) throw new NotFoundException('Not bulunamadı veya düzenlenemez.');
    return toClientNoteResponse(row);
  }

  async deleteNote(
    ctx: RequestContext, contactId: string, noteId: string,
  ): Promise<{ deleted: true }> {
    const ok = await this.repo.deleteNote(ctx, contactId, noteId);
    if (!ok) throw new NotFoundException('Not bulunamadı veya silinemez.');
    return { deleted: true };
  }

  async timeline(ctx: RequestContext, contactId: string): Promise<ClientTimelineEntryResponse[]> {
    const rows = await this.repo.listTimeline(ctx, contactId);
    return rows.map(toClientTimelineEntry);
  }

  /** AI Analiz raporları (n8n analiz workflow'u yazar) — camelCase sözleşme. */
  async listAnalyses(ctx: RequestContext, contactId: string): Promise<Array<{
    id: string; subject: string; report: string; createdAt: string;
  }>> {
    const rows = await this.repo.listAnalyses(ctx, contactId);
    return rows.map((r) => ({ id: r.id, subject: r.subject, report: r.report, createdAt: r.created_at }));
  }
}
