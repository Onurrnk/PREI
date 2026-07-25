// =====================================================================
// PREI | DocumentsService — Vault orkestrasyonu: Storage + documents_vault.
// Yükleme: önce Storage'a yaz, sonra DB satırı (Storage başarısızsa DB'ye
// hiç dokunulmaz; DB başarısızsa Storage nesnesi best-effort temizlenir).
// =====================================================================
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DocumentsRepository } from './documents.repository';
import { StorageService } from './storage.service';
import type { RequestContext } from '../../common/request-context';
import { toVaultDocumentResponse, type VaultDocumentResponse } from './dto/document-response.dto';
import { buildVaultTree, normalizeCategory, type VaultCompanyNode } from './vault-taxonomy';

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB — bucket limitiyle aynı

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly repo: DocumentsRepository,
    private readonly storage: StorageService,
  ) {}

  async list(
    ctx: RequestContext,
    filter: { organizationId?: string; projectId?: string } = {},
  ): Promise<VaultDocumentResponse[]> {
    const rows = await this.repo.list(ctx, filter);
    return rows.map(toVaultDocumentResponse);
  }

  /**
   * Kasa ağacı: Firma → Proje → Kategori.
   * Gruplama sunucuda yapılır ki her istemci aynı sırayı görsün.
   */
  async tree(ctx: RequestContext): Promise<VaultCompanyNode[]> {
    const docs = await this.list(ctx);
    return buildVaultTree(docs.map((d) => ({
      id: d.id, name: d.name, folder: d.folder,
      organizationId: d.organizationId ?? null,
      organizationName: d.organizationName ?? null,
      projectId: d.projectId ?? null,
      projectName: d.projectName ?? null,
      sizeMB: d.sizeMB,
    })));
  }

  async upload(
    ctx: RequestContext,
    file: UploadedFileLike,
    folder: string,
    relatedType?: string,
    relatedId?: string,
    organizationId?: string | null,
    projectId?: string | null,
  ): Promise<VaultDocumentResponse> {
    if (!file || !file.buffer?.length) throw new BadRequestException('Dosya boş.');
    if (file.size > MAX_SIZE_BYTES) throw new BadRequestException('Dosya 50MB sınırını aşıyor.');
    // Tanınmayan kategori reddedilmez, 'other' olur — yükleme kaybolmasın.
    const category = normalizeCategory(folder);

    // Storage yolu: tenant/kategori/uuid-orijinalad (çakışma imkansız)
    const safeName = file.originalname.replace(/[^\w.\-()İıŞşĞğÜüÖöÇç ]/g, '_').slice(0, 140);
    const storagePath = `${ctx.tenantId}/${category}/${randomUUID()}-${safeName}`;

    await this.storage.upload(storagePath, file.buffer, file.mimetype || 'application/octet-stream');

    try {
      const row = await this.repo.create(ctx, {
        name: file.originalname,
        folder: category,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        storagePath,
        relatedType,
        relatedId,
        organizationId: organizationId || null,
        projectId: projectId || null,
      });
      return toVaultDocumentResponse(row);
    } catch (err) {
      // DB yazımı başarısız → yetim Storage nesnesini best-effort temizle
      await this.storage.remove(storagePath).catch(() => undefined);
      throw err;
    }
  }

  async downloadUrl(ctx: RequestContext, id: string): Promise<{ url: string; name: string }> {
    const row = await this.repo.findById(ctx, id);
    if (!row) throw new NotFoundException();
    const url = await this.storage.signedUrl(row.storage_path, 300);
    return { url, name: row.name };
  }

  async remove(ctx: RequestContext, id: string): Promise<{ deleted: true }> {
    const row = await this.repo.findById(ctx, id);
    if (!row) throw new NotFoundException();
    await this.repo.softDelete(ctx, id);
    await this.storage.remove(row.storage_path).catch(() => undefined);
    return { deleted: true };
  }
}
