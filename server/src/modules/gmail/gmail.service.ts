// =====================================================================
// PREI | Gmail service (ACL adapter over googleapis)
// Lists/reads threads and sends mail for a given PREI user, returning
// PREI DTOs (never raw Gmail objects). Associates senders with CRM
// contacts via ContactMatcherService.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { google, type gmail_v1 } from 'googleapis';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { ContactMatcherService } from '../contacts/contact-matcher.service';
import {
  getHeader,
  parseAddress,
  toMessageDTO,
} from './gmail.mapper';
import type {
  SendEmailDTO,
  ThreadDetailDTO,
  ThreadSummaryDTO,
  ContactMatchDTO,
} from './dto/email.dto';

@Injectable()
export class GmailService {
  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly matcher: ContactMatcherService,
  ) {}

  private async client(userId: string): Promise<gmail_v1.Gmail> {
    const auth = await this.oauth.getAuthorizedClient(userId);
    return google.gmail({ version: 'v1', auth });
  }

  private toContactDTO(email: string, match: Awaited<ReturnType<ContactMatcherService['matchByEmail']>>): ContactMatchDTO | null {
    if (!match) return null;
    return { contactId: match.contactId, type: match.type, name: match.name };
  }

  /** List recent threads (optionally filtered by a Gmail query `q`). */
  async listThreads(userId: string, q?: string, maxResults = 20): Promise<ThreadSummaryDTO[]> {
    const gmail = await this.client(userId);
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
  }

  /** Full thread with decoded message bodies. */
  async getThread(userId: string, threadId: string): Promise<ThreadDetailDTO> {
    const gmail = await this.client(userId);
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
  }

  /** Send a new email or reply within a thread. */
  async sendEmail(userId: string, dto: SendEmailDTO): Promise<{ id: string; threadId: string }> {
    const gmail = await this.client(userId);
    const raw = this.buildRawMessage(dto);
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: dto.threadId },
    });
    return { id: res.data.id ?? '', threadId: res.data.threadId ?? '' };
  }

  /** Build a base64url-encoded RFC822 message. */
  private buildRawMessage(dto: SendEmailDTO): string {
    const headers = [
      `To: ${dto.to}`,
      `Subject: ${this.encodeSubject(dto.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
    ];
    if (dto.inReplyTo) {
      headers.push(`In-Reply-To: ${dto.inReplyTo}`);
      headers.push(`References: ${dto.inReplyTo}`);
    }
    const message = `${headers.join('\r\n')}\r\n\r\n${dto.body}`;
    return Buffer.from(message, 'utf-8').toString('base64url');
  }

  /** RFC 2047 encode the subject so non-ASCII (Turkish) renders correctly. */
  private encodeSubject(subject: string): string {
    const encoded = Buffer.from(subject, 'utf-8').toString('base64');
    return `=?UTF-8?B?${encoded}?=`;
  }
}
