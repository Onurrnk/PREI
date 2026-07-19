// =====================================================================
// PREI | IntakeService — davet linki üretimi + geliştirici gönderimi + kuyruk.
// Görseller media (public URL), broşür vault (imzalı URL) bucket'ına yüklenir.
// Onay gerçek `properties` satırı üretir (IntakeRepository.approve).
// =====================================================================
import {
  BadRequestException, Injectable, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import { IntakeRepository, type InviteRow, type SubmissionRow } from './intake.repository';
import { StorageService, MEDIA_BUCKET, VAULT_BUCKET } from '../documents/storage.service';
import type { CreateInviteDto, SubmitProjectDto } from './dto/intake.dto';
import type { InviteContext } from './submission-token.guard';

const MARKET_NAME: Record<string, string> = {
  TR: 'Türkiye', AE: 'Dubai (BAE)', ES: 'İspanya', GB: 'İngiltere', TH: 'Tayland', DE: 'Almanya',
};
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mapUrl = (lat: unknown, lng: unknown): string | null =>
  lat != null && lng != null ? `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}` : null;

/** Telefonu maskeler: yalnız son 2 hane görünür, gerisi *. Ör. +90…05 → "+•• ••• ••• •• 05". */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 2) return '••';
  const last2 = digits.slice(-2);
  return `${'•'.repeat(Math.min(digits.length - 2, 12))} ${last2}`;
}

export interface NotifyCandidate {
  contactId: string;
  to: string;
  toName: string;
  lang: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  propertyIds: string[];
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_BROCHURE = 15 * 1024 * 1024;
const MAX_IMAGES = 8;

interface UploadFile { originalname: string; mimetype: string; size: number; buffer: Buffer }

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
}

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);
  constructor(
    private readonly repo: IntakeRepository,
    private readonly storage: StorageService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private inviteUrl(token: string): string {
    const base = this.config.get('frontendUrl', { infer: true }).replace(/\/$/, '');
    return `${base}/submit/${token}`;
  }

  private toInvite(r: InviteRow) {
    const revoked = !!r.revoked_at;
    const expired = !!r.expires_at && new Date(r.expires_at) <= new Date();
    const exhausted = r.max_uses != null && r.used_count >= r.max_uses;
    return {
      id: r.id,
      developerId: r.developer_id,
      developerName: r.developer_name,
      label: r.label,
      url: this.inviteUrl(r.token),
      expiresAt: r.expires_at,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      status: revoked ? 'revoked' : expired ? 'expired' : exhausted ? 'exhausted' : 'active',
      createdAt: r.created_at,
    };
  }

  async createInvite(ctx: RequestContext, dto: CreateInviteDto) {
    const token = randomBytes(24).toString('base64url'); // ~32 char, URL-safe
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 86_400_000).toISOString()
      : null;
    const row = await this.repo.createInvite(ctx, {
      developerId: dto.developerId ?? null,
      label: dto.label ?? null,
      token,
      expiresAt,
      maxUses: dto.maxUses ?? null,
    });
    return this.toInvite(row);
  }

  async listInvites(ctx: RequestContext) {
    const rows = await this.repo.listInvites(ctx);
    return rows.map((r) => this.toInvite(r));
  }

  revokeInvite(ctx: RequestContext, id: string): Promise<boolean> {
    return this.repo.revokeInvite(ctx, id);
  }

  // ---- Public gönderim ----
  async submit(
    ctx: RequestContext,
    invite: InviteContext,
    dto: SubmitProjectDto,
    files: {
      brochure?: UploadFile[]; images?: UploadFile[];
      imagesInterior?: UploadFile[]; imagesExterior?: UploadFile[]; imagesSocial?: UploadFile[];
    },
    ip: string | null,
  ) {
    const brochure = files.brochure?.[0];
    // Kategorili görseller (iç/dış/sosyal) + eski istemci uyumu için 'images' (genel).
    const categories: Array<[string, UploadFile[]]> = [
      ['interior', files.imagesInterior ?? []],
      ['exterior', files.imagesExterior ?? []],
      ['social', files.imagesSocial ?? []],
      ['general', files.images ?? []],
    ];
    const totalImages = categories.reduce((s, [, arr]) => s + arr.length, 0);

    if (!brochure) throw new BadRequestException('Broşür (PDF) zorunludur.');
    if (brochure.mimetype !== 'application/pdf') throw new BadRequestException('Broşür yalnız PDF olabilir.');
    if (brochure.size > MAX_BROCHURE) throw new BadRequestException('Broşür 15MB sınırını aşıyor.');
    if (totalImages === 0) throw new BadRequestException('En az 1 görsel gereklidir.');
    if (totalImages > MAX_IMAGES * 3) throw new BadRequestException('Görsel sayısı sınırı aşıyor.');
    for (const [, arr] of categories) {
      for (const im of arr) {
        if (!IMAGE_MIMES.includes(im.mimetype)) throw new BadRequestException('Görseller yalnız JPEG/PNG/WEBP olabilir.');
        if (im.size > MAX_IMAGE) throw new BadRequestException('Bir görsel 10MB sınırını aşıyor.');
      }
    }

    const submissionId = randomUUID();

    // Görseller → media (public URL); kategori yol ön ekiyle + kategori haritası.
    const imageUrls: string[] = [];
    const imagesByCategory: Record<string, string[]> = {};
    for (const [cat, arr] of categories) {
      for (const im of arr) {
        const path = `submissions/${submissionId}/${cat}-${randomUUID()}-${safeName(im.originalname)}`;
        await this.storage.upload(path, im.buffer, im.mimetype, MEDIA_BUCKET);
        const url = this.storage.publicUrl(path, MEDIA_BUCKET);
        imageUrls.push(url);
        (imagesByCategory[cat] ??= []).push(url);
      }
    }

    // Broşür → vault (imzalı URL ile sunulur)
    const brochurePath = `submissions/${submissionId}/brochure-${randomUUID()}.pdf`;
    await this.storage.upload(brochurePath, brochure.buffer, 'application/pdf', VAULT_BUCKET);

    const unitTypes = (dto.unitTypes ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);

    await this.repo.insertSubmission(ctx, {
      id: submissionId,
      inviteId: invite.inviteId,
      developerId: invite.developerId,
      title: dto.title.trim(),
      city: dto.city?.trim() || null,
      district: dto.district?.trim() || null,
      marketCode: dto.marketCode ?? null,
      priceMin: dto.priceMin ?? null,
      priceMax: dto.priceMax ?? null,
      currency: dto.currency ?? 'EUR',
      commissionPct: dto.commissionPct ?? null,
      unitTypes,
      description: dto.description?.trim() || null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      imageUrls,
      brochurePath,
      payload: {
        brochureName: safeName(brochure.originalname),
        brochureSize: brochure.size,
        completionDate: dto.completionDate ?? null,
        developerName: invite.developerName,
        imagesByCategory,
        downPaymentPct: dto.downPaymentPct ?? null,
        installmentMonths: dto.installmentMonths ?? null,
        paymentNote: dto.paymentNote?.trim() || null,
      },
      ip,
    });

    await this.repo.incrementInviteUse(invite.inviteId);
    this.logger.log(`Yeni proje gönderimi: ${submissionId} (davet ${invite.inviteId})`);
    return { ok: true as const, submissionId };
  }

  // ---- Onay kuyruğu ----
  async listQueue(ctx: RequestContext) {
    const rows = await this.repo.listSubmissions(ctx, 'pending');
    return Promise.all(rows.map((r) => this.toSubmission(r)));
  }

  async pendingCount(ctx: RequestContext): Promise<{ count: number }> {
    return { count: await this.repo.pendingCount(ctx) };
  }

  async getForReview(ctx: RequestContext, id: string) {
    const row = await this.repo.getSubmission(ctx, id);
    return row ? this.toSubmission(row) : null;
  }

  approve(ctx: RequestContext, id: string) {
    return this.repo.approve(ctx, id);
  }

  // ---- Faz 2: kriter-eşleşmeli müşteri bildirimi (n8n digest) ----
  async notifyCandidates(ctx: RequestContext): Promise<NotifyCandidate[]> {
    const rows = await this.repo.notificationCandidates(ctx);
    const byClient = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byClient.get(r.contact_id) ?? [];
      arr.push(r);
      byClient.set(r.contact_id, arr);
    }

    const out: NotifyCandidate[] = [];
    for (const [contactId, projects] of byClient) {
      const first = projects[0];
      const en = first.lang === 'en';
      const name = first.name || (en ? 'there' : 'Yatırımcımız');

      const items = projects.map((p) => {
        const market = p.market_code ? (MARKET_NAME[p.market_code] ?? p.market_code) : '';
        const loc = [p.city, market].filter(Boolean).join(', ');
        const min = p.price_min ? Number(p.price_min) : null;
        const max = p.price_max ? Number(p.price_max) : null;
        const range = min && max && min !== max
          ? `${min.toLocaleString('tr-TR')} – ${max.toLocaleString('tr-TR')} ${p.currency}`
          : (min || max ? `${(min || max)!.toLocaleString('tr-TR')} ${p.currency}` : '');
        const tail = [loc, range].filter(Boolean).join(' · ');
        return { title: p.title, line: tail, map: mapUrl(p.latitude, p.longitude) };
      });

      const n = projects.length;
      const subject = en
        ? (n === 1 ? `A new project that matches you: ${first.title}` : `${n} new investment opportunities for you`)
        : (n === 1 ? `Size uygun yeni proje: ${first.title}` : `Size uygun ${n} yeni yatırım fırsatı`);

      // Not: selamlama ("Merhaba {ad},") agent-mail.php markalı kabukta ekleniyor —
      // gövde selamla BAŞLAMAZ (çift selamlama olmasın).
      const mapLabel = en ? 'View on map' : 'Haritada Gör';
      const li = items.map((i) => `<li style="margin:0 0 8px 0;"><strong>${esc(i.title)}</strong>${i.line ? ` — ${esc(i.line)}` : ''}${i.map ? ` · <a href="${i.map}" style="color:#9B5BB3;">${mapLabel}</a>` : ''}</li>`).join('');
      const bodyHtml = en
        ? `<p style="margin:0 0 18px 0;">New project${n > 1 ? 's' : ''} matching your interests ${n > 1 ? 'have' : 'has'} just been added to our catalog:</p><ul style="margin:0 0 18px 0; padding-left:20px;">${li}</ul><p style="margin:0 0 18px 0;">Reply to this email for a tailored assessment and full details.</p>`
        : `<p style="margin:0 0 18px 0;">İlgi alanınıza uygun, kataloğumuza yeni eklenen proje${n > 1 ? 'ler' : ''}:</p><ul style="margin:0 0 18px 0; padding-left:20px;">${li}</ul><p style="margin:0 0 18px 0;">Size özel değerlendirme ve detaylı bilgi için bu e-postayı yanıtlamanız yeterli.</p>`;

      const textLines = items.map((i) => `- ${i.title}${i.line ? ` — ${i.line}` : ''}${i.map ? ` (${i.map})` : ''}`).join('\n');
      const bodyText = en
        ? `New projects matching your interests:\n${textLines}\n\nReply for details.`
        : `İlgi alanınıza uygun yeni projeler:\n${textLines}\n\nDetaylar için yanıtlayın.`;

      out.push({
        contactId, to: first.email, toName: name, lang: en ? 'en' : 'tr',
        subject, bodyHtml, bodyText, propertyIds: projects.map((p) => p.property_id),
      });
    }
    return out;
  }

  markNotified(ctx: RequestContext, contactId: string, propertyIds: string[]) {
    return this.repo.markNotified(ctx, contactId, propertyIds);
  }

  // ---- Geliştirici atıf bildirimi (komisyon/hak koruması) ----
  async developerAttributions(ctx: RequestContext): Promise<Array<{
    developerId: string; to: string; toName: string; subject: string;
    bodyHtml: string; bodyText: string; pairs: Array<{ propertyId: string; contactId: string }>;
  }>> {
    const rows = await this.repo.developerAttributionCandidates(ctx);
    const byDev = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byDev.get(r.developer_id) ?? [];
      arr.push(r);
      byDev.set(r.developer_id, arr);
    }

    const out = [];
    for (const [developerId, refs] of byDev) {
      const first = refs[0];
      const liRows = refs.map((r) => {
        const inv = [r.investor_name || '—', r.investor_city ? `(${r.investor_city})` : ''].filter(Boolean).join(' ');
        const tel = maskPhone(r.investor_phone);
        const date = new Date(r.sent_at).toISOString().slice(0, 10);
        const parts = [`Yatırımcı: ${esc(inv)}`, tel ? `Tel: ${tel}` : '', date].filter(Boolean).join(' · ');
        return `<li style="margin:0 0 8px 0;"><strong>${esc(r.project_title)}</strong> → ${parts}</li>`;
      }).join('');
      const bodyHtml =
        `<p style="margin:0 0 18px 0;">ProDuality olarak, aşağıdaki projeniz için bir yatırımcı yönlendirmesi yaptığımızı resmî olarak bilginize sunarız. Bu e-posta, ilgili yatırımcının tarafımızca tanıtıldığının kaydıdır.</p>` +
        `<ul style="margin:0 0 18px 0; padding-left:20px;">${liRows}</ul>` +
        `<p style="margin:0 0 18px 0;">Bu yatırımcılarla ilerleyen süreçte ProDuality'nin aracılık ve komisyon hakkı saklıdır. Sorularınız için bu e-postayı yanıtlayabilirsiniz.</p>`;
      const textLines = refs.map((r) => {
        const inv = [r.investor_name || '—', r.investor_city ? `(${r.investor_city})` : ''].filter(Boolean).join(' ');
        const tel = maskPhone(r.investor_phone);
        const date = new Date(r.sent_at).toISOString().slice(0, 10);
        return `- ${r.project_title} -> ${inv}${tel ? ` · Tel: ${tel}` : ''} · ${date}`;
      }).join('\n');
      const bodyText = `ProDuality yatırımcı yönlendirme bildirimi:\n${textLines}\n\nProDuality'nin aracılık/komisyon hakkı saklıdır.`;

      out.push({
        developerId,
        to: first.developer_email,
        toName: first.developer_name || 'Yetkili',
        subject: 'Yatırımcı yönlendirme bildirimi — ProDuality',
        bodyHtml, bodyText,
        pairs: refs.map((r) => ({ propertyId: r.property_id, contactId: r.contact_id })),
      });
    }
    return out;
  }

  markDeveloperNotified(ctx: RequestContext, pairs: Array<{ propertyId: string; contactId: string }>) {
    return this.repo.markDeveloperNotified(ctx, pairs);
  }

  reject(ctx: RequestContext, id: string, note: string | null) {
    return this.repo.reject(ctx, id, note);
  }

  private async toSubmission(r: SubmissionRow) {
    let brochureUrl: string | null = null;
    if (r.brochure_path) {
      try {
        brochureUrl = await this.storage.signedUrl(r.brochure_path, 600, VAULT_BUCKET);
      } catch {
        brochureUrl = null; // imza üretilemezse önizleme yok, akış kırılmasın
      }
    }
    return {
      id: r.id,
      status: r.status,
      title: r.title,
      developerName: r.developer_name,
      city: r.city,
      district: r.district,
      marketCode: r.market_code,
      priceMin: r.price_min != null ? Number(r.price_min) : null,
      priceMax: r.price_max != null ? Number(r.price_max) : null,
      currency: r.currency,
      commissionPct: r.commission_pct != null ? Number(r.commission_pct) : null,
      unitTypes: r.unit_types,
      description: r.description,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      mapUrl: mapUrl(r.latitude, r.longitude),
      imageUrls: r.image_urls,
      imagesByCategory: ((r.payload as Record<string, unknown>)?.imagesByCategory ?? {}) as Record<string, string[]>,
      downPaymentPct: ((r.payload as Record<string, unknown>)?.downPaymentPct ?? null) as number | null,
      installmentMonths: ((r.payload as Record<string, unknown>)?.installmentMonths ?? null) as number | null,
      paymentNote: ((r.payload as Record<string, unknown>)?.paymentNote ?? null) as string | null,
      brochureUrl,
      createdPropertyId: r.created_property_id,
      reviewNote: r.review_note,
      createdAt: r.created_at,
    };
  }
}
