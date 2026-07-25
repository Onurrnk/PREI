// =====================================================================
// PREI | DriveService — haftalık yayın akışı dosyalarını Google Drive'a yükler.
//
// Onur LinkedIn'i ELLE paylaşıyor (otomasyon ban riski taşıyor), o yüzden
// postlar Drive'da dosya olarak hazır bekler: telefondan da açılır,
// kopyalanıp LinkedIn'e yapıştırılır.
//
// KAPSAM: drive.file — PREI YALNIZ kendi oluşturduğu dosyaları görür.
// Mevcut Drive içeriğine erişimi yoktur. Bu bilinçli bir tercih.
// =====================================================================
import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';
import { GoogleOAuthService } from '../auth/google-oauth.service';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ROOT_FOLDER = 'ProDuality Yayın Akışı';

export interface DriveUploadResult {
  ok: boolean;
  message?: string;
  folderId?: string;
  folderLink?: string;
  files: Array<{ name: string; id: string | null; link: string | null; error?: string }>;
}

export interface DriveFile {
  name: string;
  mimeType: string;
  /** Metin dosyaları için; ikili içerik için data kullan. */
  content?: string;
  data?: Buffer;
}

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(private readonly oauth: GoogleOAuthService) {}

  private async client(userId: string): Promise<drive_v3.Drive> {
    const auth = await this.oauth.getAuthorizedClient(userId);
    return google.drive({ version: 'v3', auth });
  }

  /**
   * Klasörü ada göre bulur, yoksa oluşturur.
   * drive.file kapsamında yalnız BİZİM oluşturduğumuz klasörler görünür —
   * yani kullanıcının aynı adlı başka bir klasörüne yazma riski yok.
   */
  private async ensureFolder(
    drive: drive_v3.Drive, name: string, parentId?: string,
  ): Promise<string> {
    const q = [
      `name = '${name.replace(/'/g, "\\'")}'`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      'trashed = false',
      parentId ? `'${parentId}' in parents` : `'root' in parents`,
    ].join(' and ');

    const found = await drive.files.list({ q, fields: 'files(id,name)', pageSize: 5 });
    const existing = found.data.files?.[0]?.id;
    if (existing) return existing;

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      },
      fields: 'id',
    });
    if (!created.data.id) throw new Error(`Klasör oluşturulamadı: ${name}`);
    return created.data.id;
  }

  /**
   * Haftalık klasörü kurar ve dosyaları yükler.
   * Aynı adlı dosya varsa ÜZERİNE YAZAR (haftalık akış yeniden üretilirse
   * kopya birikmesin).
   */
  async uploadWeek(
    userId: string, weekLabel: string, files: DriveFile[],
  ): Promise<DriveUploadResult> {
    // Drive kapsamı verilmemişse net söyle — sessizce başarısız olmasın.
    const hasScope = await this.oauth.hasScope(userId, DRIVE_SCOPE);
    if (!hasScope) {
      return {
        ok: false,
        message: 'Google hesabınızda Drive izni yok. Ayarlar\'dan Google\'ı yeniden bağlayın ' +
                 '(PREI yalnız kendi oluşturduğu dosyalara erişir).',
        files: [],
      };
    }

    let drive: drive_v3.Drive;
    try {
      drive = await this.client(userId);
    } catch (e) {
      return { ok: false, message: `Google bağlantısı kurulamadı: ${(e as Error).message}`, files: [] };
    }

    let folderId: string;
    try {
      const root = await this.ensureFolder(drive, ROOT_FOLDER);
      folderId = await this.ensureFolder(drive, weekLabel, root);
    } catch (e) {
      const msg = (e as Error).message;
      // Kapsam eksikse Google 403 "insufficientPermissions" döner.
      if (/insufficient|scope|permission/i.test(msg)) {
        return {
          ok: false,
          message: 'Drive izni eksik. Ayarlar\'dan Google\'ı yeniden bağlayın.',
          files: [],
        };
      }
      return { ok: false, message: `Klasör hazırlanamadı: ${msg}`, files: [] };
    }

    const out: DriveUploadResult['files'] = [];
    for (const f of files) {
      try {
        // Aynı adlı dosya varsa güncelle, yoksa oluştur.
        const q = [
          `name = '${f.name.replace(/'/g, "\\'")}'`,
          `'${folderId}' in parents`,
          'trashed = false',
        ].join(' and ');
        const existing = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
        const id = existing.data.files?.[0]?.id;

        const media = {
          mimeType: f.mimeType,
          // İkili içerik akış ister; metin doğrudan verilebilir.
          body: f.data ? Readable.from(f.data) : f.content ?? '',
        };

        const res = id
          ? await drive.files.update({ fileId: id, media, fields: 'id,webViewLink' })
          : await drive.files.create({
              requestBody: { name: f.name, parents: [folderId] },
              media, fields: 'id,webViewLink',
            });

        out.push({
          name: f.name,
          id: res.data.id ?? null,
          link: res.data.webViewLink ?? null,
        });
      } catch (e) {
        out.push({ name: f.name, id: null, link: null, error: (e as Error).message });
      }
    }

    const failed = out.filter((f) => f.error).length;
    this.logger.log(
      `Drive yüklemesi (${weekLabel}): ${out.length - failed}/${out.length} dosya`);

    return {
      ok: failed === 0,
      message: failed > 0 ? `${failed} dosya yüklenemedi.` : undefined,
      folderId,
      folderLink: `https://drive.google.com/drive/folders/${folderId}`,
      files: out,
    };
  }
}
