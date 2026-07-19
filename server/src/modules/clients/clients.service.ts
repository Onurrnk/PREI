import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientsRepository } from './clients.repository';
import type { RequestContext } from '../../common/request-context';
import { toClientResponse, type ClientResponse } from './dto/client-response.dto';
import type { UpdateClientDto } from './dto/client-update.dto';
import { toClientNoteResponse, type ClientNoteResponse, type CreateClientNoteDto } from './dto/client-note.dto';
import { toClientTimelineEntry, type ClientTimelineEntryResponse } from './dto/client-timeline.dto';

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
