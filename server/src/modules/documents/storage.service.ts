// =====================================================================
// PREI | StorageService — Supabase Storage REST sarmalayıcısı (vault bucket).
// service_role YALNIZ burada, sunucu tarafında kullanılır; istemciye inen
// tek şey kısa ömürlü imzalı URL'dir.
// =====================================================================
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

const BUCKET = 'vault';

@Injectable()
export class StorageService {
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const sb = config.get('supabase', { infer: true });
    this.baseUrl = `${sb.url.replace(/\/$/, '')}/storage/v1`;
    this.serviceKey = sb.serviceRoleKey;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      apikey: this.serviceKey,
      ...extra,
    };
  }

  /** Dosyayı vault bucket'ına yükler. */
  async upload(path: string, body: Buffer, contentType: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'false' }),
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Storage yükleme hatası (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  /** Kısa ömürlü indirme URL'i üretir (varsayılan 5 dk). */
  async signedUrl(path: string, expiresInSeconds = 300): Promise<string> {
    const res = await fetch(`${this.baseUrl}/object/sign/${BUCKET}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`İmzalı URL hatası (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { signedURL: string };
    return `${this.baseUrl}${json.signedURL}`;
  }

  /** Nesneyi bucket'tan siler (DB soft-delete ile birlikte çağrılır). */
  async remove(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/object/${BUCKET}/${path}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    // 404 tolere edilir (nesne zaten yoksa DB kaydını silmeyi engelleme)
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Storage silme hatası (${res.status}): ${text.slice(0, 200)}`);
    }
  }
}
