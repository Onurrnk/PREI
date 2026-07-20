// =====================================================================
// PREI | Gmail service (ACL adapter over googleapis)
// Lists/reads threads and sends mail for a given PREI user, returning
// PREI DTOs (never raw Gmail objects). Associates senders with CRM
// contacts via ContactMatcherService.
// =====================================================================
import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { google, type gmail_v1 } from 'googleapis';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { ContactMatcherService } from '../contacts/contact-matcher.service';
import { DatabaseService } from '../../database/database.service';
import {
  getHeader,
  parseAddress,
  toMessageDTO,
} from './gmail.mapper';
import { buildClientEmailHtml, buildClientEmailText } from './email-template';
import { PRODUALITY_LOGO_BASE64, PRODUALITY_LOGO_CONTENT_ID } from './logo-asset';
import type {
  SendEmailDTO,
  ThreadDetailDTO,
  ThreadSummaryDTO,
  ContactMatchDTO,
} from './dto/email.dto';

interface SenderProfile {
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
}

// Gmail'in ham mesaj limiti ~25MB; base64 şişmesi + şablon payı için
// eklerin toplamını 15MB (base64 olarak ~20MB) ile sınırlıyoruz.
const MAX_ATTACHMENT_TOTAL_BASE64 = 20 * 1024 * 1024;

/**
 * Gmail bağlantısı yeniden yetkilendirme gerektiriyor. İki sınıf:
 *  (a) token ölü — refresh iptal/süre-dolumu (`invalid_grant`) veya hiç bağlı değil;
 *  (b) kapsam/izin yetersiz — token geçerli ama gerekli Gmail izni verilmemiş
 *      (`Insufficient Permission` / insufficientPermissions, 403).
 * 401 DEĞİL 424 kullanılır: frontend api client herhangi bir 401'i "PREI
 * oturumu düştü → token'ı sil, login'e at" diye yorumluyor; Gmail alt-
 * entegrasyonunun düşmesi kullanıcıyı PREI'den ATMAMALI. 4xx olduğu için
 * SentryGlobalFilter bunu raporlamaz (beklenen, kullanıcı-eylemi gerektiren
 * durum — 5xx gürültüsü değil).
 */
export class GmailReauthRequiredException extends HttpException {
  constructor() {
    super(
      { code: 'gmail_reauth_required', message: 'Gmail bağlantısı yenilenmeli — Ayarlar’dan tüm izinleri onaylayarak yeniden bağlanın.' },
      HttpStatus.FAILED_DEPENDENCY,
    );
  }
}

/** Token ÖLÜ (refresh iptal/süre-dolumu) — yeniden yetki + ölü token temizliği
 *  gerektirir. Geçici ağ/5xx hatalarından ayrıdır. */
export function isGmailAuthError(err: unknown): boolean {
  const e = err as { message?: string; response?: { data?: { error?: string } } };
  const oauthError = e?.response?.data?.error;
  if (oauthError === 'invalid_grant' || oauthError === 'invalid_client' || oauthError === 'unauthorized_client') {
    return true;
  }
  const msg = typeof e?.message === 'string' ? e.message : '';
  return /invalid_grant|invalid_client|unauthorized_client|no refresh token|no access.*refresh token/i.test(msg);
}

/** Token GEÇERLİ ama gerekli Gmail KAPSAMI/izni verilmemiş (403 Insufficient
 *  Permission / insufficientPermissions / ACCESS_TOKEN_SCOPE_INSUFFICIENT).
 *  Kullanıcı Ayarlar'dan tüm izinleri onaylayarak yeniden bağlamalı. Ölü token
 *  DEĞİL → otomatik silinmez (send gibi diğer kapsamlar çalışıyor olabilir). */
export function isGmailScopeError(err: unknown): boolean {
  const e = err as {
    message?: string;
    errors?: Array<{ reason?: string }>;
    response?: { data?: { error?: { errors?: Array<{ reason?: string }> } } };
  };
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (/insufficient permission|insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(msg)) {
    return true;
  }
  const reasons = e?.response?.data?.error?.errors ?? e?.errors ?? [];
  return Array.isArray(reasons) && reasons.some(
    (x) => x?.reason === 'insufficientPermissions' || x?.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
  );
}

/** Kompozör HTML'ini e-postaya gömmeden önce daralt: yalnız temel
 *  biçimlendirme etiketlerine izin ver, olay öznitelikleri ile script/style
 *  gövdelerini at. (Girdi zaten kimlik doğrulamalı danışmandan gelir; bu
 *  katman yanlışlıkla yapıştırılan aktif içeriğe karşı emniyet kemeri.) */
export function sanitizeComposerHtml(html: string): string {
  const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'A', 'SPAN']);
  return html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\/?>/g, (full, tagName: string, attrs: string) => {
      const upper = tagName.toUpperCase();
      if (!ALLOWED.has(upper)) return '';
      const isClosing = full.startsWith('</');
      if (isClosing) return `</${tagName.toLowerCase()}>`;
      // Yalnız <a href="http(s)://..."> özniteliğini koru; gerisini at.
      if (upper === 'A') {
        const hrefMatch = /href\s*=\s*"(https?:\/\/[^"]*)"/i.exec(attrs);
        return hrefMatch ? `<a href="${hrefMatch[1]}" style="color:#94529F;">` : '<a>';
      }
      return `<${tagName.toLowerCase()}>`;
    });
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly matcher: ContactMatcherService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Gmail API çağrılarını tek noktadan sarar: bağlı client'ı hazırlar, işi
   * çalıştırır ve refresh'in KALICI başarısızlığını (`invalid_grant` / hiç
   * bağlı değil) yakalar → ölü token'ı temizleyip {@link GmailReauthRequiredException}
   * (424) fırlatır. Böylece (1) ham `invalid_grant` bir daha unhandled 500 →
   * Sentry olmaz, (2) Ayarlar'daki bağlantı durumu "bağlı" yalanını sürdürmez,
   * (3) kullanıcı 401 yüzünden PREI'den atılmaz. Geçici hatalar aynen yükselir.
   */
  private async withGmail<T>(userId: string, fn: (gmail: gmail_v1.Gmail) => Promise<T>): Promise<T> {
    try {
      const gmail = await this.client(userId);
      return await fn(gmail);
    } catch (err) {
      const notConnected = err instanceof UnauthorizedException;
      if (isGmailAuthError(err) || notConnected) {
        // Token gerçekten ölü → sakla-tut yerine temizle ki getConnection
        // dürüstçe "bağlı değil" desin ve kullanıcı yeniden bağlansın.
        if (!notConnected) {
          await this.oauth.disconnect(userId).catch((e) =>
            this.logger.warn(`Ölü Gmail token temizlenemedi (user=${userId}): ${(e as Error).message}`),
          );
        }
        throw new GmailReauthRequiredException();
      }
      // Kapsam/izin yetersiz (403): token ölü DEĞİL — silme (send çalışabilir),
      // yalnız handled 424'e çevir ki unhandled 500 → Sentry olmasın; kullanıcı
      // tüm izinleri onaylayarak yeniden bağlamalı.
      if (isGmailScopeError(err)) {
        this.logger.warn(`Gmail kapsamı yetersiz (user=${userId}): ${(err as Error).message}`);
        throw new GmailReauthRequiredException();
      }
      throw err;
    }
  }

  private async senderProfile(userId: string): Promise<SenderProfile> {
    const rows = await this.db.raw<{ full_name: string; email: string; phone: string | null; metadata: Record<string, unknown> }>(
      `SELECT full_name, email, phone, metadata FROM users WHERE id = $1`,
      [userId],
    );
    const row = rows[0];
    return {
      name: row?.full_name ?? 'ProDuality Advisory',
      email: row?.email ?? 'info@produality.com',
      phone: row?.phone ?? null,
      jobTitle: (row?.metadata?.jobTitle as string) ?? null,
    };
  }

  private async client(userId: string): Promise<gmail_v1.Gmail> {
    const auth = await this.oauth.getAuthorizedClient(userId);
    return google.gmail({ version: 'v1', auth });
  }

  private toContactDTO(email: string, match: Awaited<ReturnType<ContactMatcherService['matchByEmail']>>): ContactMatchDTO | null {
    if (!match) return null;
    return { contactId: match.contactId, type: match.type, name: match.name };
  }

  /**
   * Gmail sorgusuna uyan mesajların .ics eklerini döndürür (Calendly
   * free-tier senkronu: webhook yok → bildirim mailindeki davet ekinden
   * randevu çıkarılır). Ek yoksa ics=null ile mesaj yine listelenir.
   */
  async listMessagesWithIcs(
    userId: string, q: string, maxResults = 15,
  ): Promise<Array<{ messageId: string; ics: string | null }>> {
    return this.withGmail(userId, async (gmail) => {
    const list = await gmail.users.messages.list({ userId: 'me', q, maxResults });
    const out: Array<{ messageId: string; ics: string | null }> = [];

    for (const m of list.data.messages ?? []) {
      const full = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' });
      const parts: gmail_v1.Schema$MessagePart[] = [];
      const walk = (p?: gmail_v1.Schema$MessagePart | null): void => {
        if (!p) return;
        parts.push(p);
        (p.parts ?? []).forEach(walk);
      };
      walk(full.data.payload);

      let ics: string | null = null;
      for (const p of parts) {
        const isIcs = p.mimeType === 'text/calendar'
          || (p.filename ?? '').toLowerCase().endsWith('.ics');
        if (!isIcs) continue;
        if (p.body?.data) {
          ics = Buffer.from(p.body.data, 'base64url').toString('utf8');
        } else if (p.body?.attachmentId) {
          const att = await gmail.users.messages.attachments.get({
            userId: 'me', messageId: m.id!, id: p.body.attachmentId,
          });
          if (att.data.data) ics = Buffer.from(att.data.data, 'base64url').toString('utf8');
        }
        if (ics) break;
      }
      out.push({ messageId: m.id!, ics });
    }
    return out;
    });
  }

  /** List recent threads (optionally filtered by a Gmail query `q`). */
  async listThreads(userId: string, q?: string, maxResults = 20): Promise<ThreadSummaryDTO[]> {
    return this.withGmail(userId, async (gmail) => {
    const list = await gmail.users.threads.list({ userId: 'me', q, maxResults });
    const threads = list.data.threads ?? [];

    const summaries = await Promise.all(
      threads.map(async (t) => {
        const detail = await gmail.users.threads.get({
          userId: 'me',
          id: t.id ?? '',
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const messages = detail.data.messages ?? [];
        const first = messages[0];
        const headers = first?.payload?.headers ?? undefined;
        const from = parseAddress(getHeader(headers, 'From'));
        const dateHeader = getHeader(headers, 'Date');
        const unread = messages.some((m) => m.labelIds?.includes('UNREAD'));
        const match = await this.matcher.matchByEmail(from.email);

        const summary: ThreadSummaryDTO = {
          id: t.id ?? '',
          subject: getHeader(headers, 'Subject') || '(konu yok)',
          from: from.name,
          fromEmail: from.email,
          snippet: detail.data.snippet ?? t.snippet ?? '',
          date: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
          unread,
          contact: this.toContactDTO(from.email, match),
        };
        return summary;
      }),
    );

    return summaries;
    });
  }

  /** Full thread with decoded message bodies. */
  async getThread(userId: string, threadId: string): Promise<ThreadDetailDTO> {
    return this.withGmail(userId, async (gmail) => {
    const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    const messages = (res.data.messages ?? []).map(toMessageDTO);
    const first = messages[0];
    const match = first ? await this.matcher.matchByEmail(first.fromEmail) : null;

    return {
      id: threadId,
      subject: first?.subject || '(konu yok)',
      contact: first ? this.toContactDTO(first.fromEmail, match) : null,
      messages,
    };
    });
  }

  /** Send a new email or reply within a thread. Rendered through the
   *  branded HTML template (§ email-template.ts) with a plain-text
   *  fallback part for clients that don't render HTML. */
  async sendEmail(userId: string, dto: SendEmailDTO): Promise<{ id: string; threadId: string }> {
    const attachmentTotal = (dto.attachments ?? []).reduce((sum, a) => sum + a.dataBase64.length, 0);
    if (attachmentTotal > MAX_ATTACHMENT_TOTAL_BASE64) {
      throw new BadRequestException('Ekler çok büyük — toplam en fazla ~15MB gönderilebilir.');
    }
    return this.withGmail(userId, async (gmail) => {
      const sender = await this.senderProfile(userId);
      const raw = this.buildRawMessage(dto, sender);
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw, threadId: dto.threadId },
      });
      return { id: res.data.id ?? '', threadId: res.data.threadId ?? '' };
    });
  }

  /** Tam sayfa markalı HTML gönderir (teklif). Composer sanitizer'ından
   *  geçmez — teklif şablonu kendi markasını taşır (logo, tablolar). From
   *  başlığı danışmanın profilinden gelir; müşteri "Gönderilenler"e düşer. */
  async sendHtmlEmail(
    userId: string,
    args: { to: string; subject: string; html: string },
  ): Promise<{ id: string; threadId: string }> {
    return this.withGmail(userId, async (gmail) => {
      const sender = await this.senderProfile(userId);
      const headers = [
        `To: ${args.to}`,
        `From: ${sender.name} <${sender.email}>`,
        `Subject: ${this.encodeSubject(args.subject)}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
      ];
      const body = Buffer.from(args.html, 'utf-8').toString('base64');
      const message = `${headers.join('\r\n')}\r\n\r\n${body}`;
      const raw = Buffer.from(message, 'utf-8').toString('base64url');
      const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
      return { id: res.data.id ?? '', threadId: res.data.threadId ?? '' };
    });
  }

  /** Build a base64url-encoded RFC822 message: multipart/related wrapping
   *  a multipart/alternative (text+html) part plus the inline logo image
   *  (referenced from the HTML template via `cid:`), so the real
   *  ProDuality wordmark renders without depending on a public image URL. */
  private buildRawMessage(dto: SendEmailDTO, sender: SenderProfile): string {
    const altBoundary = `prei_alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const relBoundary = `prei_rel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const mixBoundary = `prei_mix_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const bodyParagraphs = dto.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const recipientName = dto.recipientName?.trim() || dto.to.split('@')[0];
    const attachments = dto.attachments ?? [];

    const templateParams = {
      recipientName,
      greeting: dto.greeting,
      consultantName: sender.name,
      consultantTitle: sender.jobTitle ?? undefined,
      consultantEmail: sender.email,
      consultantPhone: sender.phone ?? undefined,
      bodyParagraphs,
      bodyHtml: dto.bodyHtml ? sanitizeComposerHtml(dto.bodyHtml) : undefined,
      ctaLabel: dto.ctaLabel,
      ctaUrl: dto.ctaUrl,
      paragraphsAfterCta: dto.bodyAfterCta
        ? dto.bodyAfterCta.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : undefined,
      preheader: bodyParagraphs[0]?.slice(0, 140),
    };
    const textPart = buildClientEmailText(templateParams);
    const htmlPart = buildClientEmailHtml(templateParams);

    // Ek varsa en dış zarf multipart/mixed olur; markalı gövde (related)
    // ilk parça, ekler onu izler. Ek yoksa yapı öncekiyle birebir aynı.
    const outerBoundary = attachments.length > 0 ? mixBoundary : relBoundary;
    const outerType = attachments.length > 0 ? 'multipart/mixed' : 'multipart/related';

    const headers = [
      `To: ${dto.to}`,
      `From: ${sender.name} <${sender.email}>`,
      `Subject: ${this.encodeSubject(dto.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: ${outerType}; boundary="${outerBoundary}"`,
    ];
    if (dto.inReplyTo) {
      headers.push(`In-Reply-To: ${dto.inReplyTo}`);
      headers.push(`References: ${dto.inReplyTo}`);
    }

    const logoBase64Lines = PRODUALITY_LOGO_BASE64.match(/.{1,76}/g) ?? [];

    const relatedPart = [
      `--${relBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      textPart,
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlPart,
      '',
      `--${altBoundary}--`,
      '',
      `--${relBoundary}`,
      'Content-Type: image/png',
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${PRODUALITY_LOGO_CONTENT_ID}>`,
      'Content-Disposition: inline; filename="logo.png"',
      '',
      logoBase64Lines.join('\r\n'),
      '',
      `--${relBoundary}--`,
    ];

    let bodyLines: string[];
    if (attachments.length === 0) {
      bodyLines = relatedPart;
    } else {
      bodyLines = [
        `--${mixBoundary}`,
        `Content-Type: multipart/related; boundary="${relBoundary}"`,
        '',
        ...relatedPart,
        '',
      ];
      for (const att of attachments) {
        const safeName = att.filename.replace(/[\r\n"]/g, '_');
        const dataLines = att.dataBase64.replace(/\s/g, '').match(/.{1,76}/g) ?? [];
        bodyLines.push(
          `--${mixBoundary}`,
          `Content-Type: ${att.mimeType}; name="${safeName}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${safeName}"`,
          '',
          dataLines.join('\r\n'),
          '',
        );
      }
      bodyLines.push(`--${mixBoundary}--`);
    }

    const message = [headers.join('\r\n'), '', ...bodyLines].join('\r\n');

    return Buffer.from(message, 'utf-8').toString('base64url');
  }

  /** RFC 2047 encode the subject so non-ASCII (Turkish) renders correctly. */
  private encodeSubject(subject: string): string {
    const encoded = Buffer.from(subject, 'utf-8').toString('base64');
    return `=?UTF-8?B?${encoded}?=`;
  }
}
