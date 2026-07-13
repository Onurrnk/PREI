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

const ALLOWED_FOLDERS = ['Root', 'Client KYC', 'Contracts', 'Marketing', 'Developer Agreements'];
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

  async list(ctx: RequestContext): Promise<VaultDocumentResponse[]> {
    const rows = await this.repo.list(ctx);
    return rows.map(toVaultDocumentResponse);
  }

  async upload(
    ctx: RequestContext,
    file: UploadedFileLike,
    folder: string,
    relatedType?: string,
    relatedId?: string,
  ): Promise<VaultDocumentResponse> {
    if (!file || !file.buffer?.length) throw new BadRequestException('Dosya boş.');
    if (file.size > MAX_SIZE_BYTES) throw new BadRequestException('Dosya 50MB sınırını aşıyor.');
    const targetFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'Root';

    // Storage yolu: tenant/klasör-slug/uuid-orijinalad (çakışma imkansız)
    const safeName = file.originalname.replace(/[^\w.\-()İıŞşĞğÜüÖöÇç ]/g, '_').slice(0, 140);
    const folderSlug = targetFolder.toLowerCase().replace(/\s+/g, '-');
    const storagePath = `${ctx.tenantId}/${folderSlug}/${randomUUID()}-${safeName}`;

    await this.storage.upload(storagePath, file.buffer, file.mimetype || 'application/octet-stream');

    try {
      const row = await this.repo.create(ctx, {
        name: file.originalname,
        folder: targetFolder,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        storagePath,
        relatedType,
        relatedId,
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
