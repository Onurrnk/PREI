// =====================================================================
// PREI | StorageService — Supabase Storage REST sarmalayıcısı.
// İki bucket: 'vault' (özel; kısa ömürlü imzalı URL) ve 'media' (herkese
// açık; proje görselleri + marka logosu gibi <img>'de doğrudan kullanılan
// varlıklar). service_role YALNIZ burada, sunucu tarafında kullanılır.
// =====================================================================
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export const VAULT_BUCKET = 'vault';
export const MEDIA_BUCKET = 'media';

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

  /** Dosyayı bucket'a yükler (varsayılan: vault). */
  async upload(path: string, body: Buffer, contentType: string, bucket = VAULT_BUCKET): Promise<void> {
    const res = await fetch(`${this.baseUrl}/object/${bucket}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'false' }),
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Storage yükleme hatası (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  /** Kısa ömürlü indirme URL'i üretir (varsayılan 5 dk; vault için). */
  async signedUrl(path: string, expiresInSeconds = 300, bucket = VAULT_BUCKET): Promise<string> {
    const res = await fetch(`${this.baseUrl}/object/sign/${bucket}/${path}`, {
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

  /** Public bucket'taki nesnenin kalıcı URL'i (media için). */
  publicUrl(path: string, bucket = MEDIA_BUCKET): string {
    return `${this.baseUrl}/object/public/${bucket}/${path}`;
  }

  /** Nesneyi bucket'tan siler (DB soft-delete ile birlikte çağrılır). */
  async remove(path: string, bucket = VAULT_BUCKET): Promise<void> {
    const res = await fetch(`${this.baseUrl}/object/${bucket}/${path}`, {
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
