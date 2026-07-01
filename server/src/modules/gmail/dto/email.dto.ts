// =====================================================================
// PREI | Gmail DTOs
// Response DTOs are the PREI-shaped contract returned to the frontend —
// deliberately decoupled from Gmail's raw schema (ACL boundary).
// Request DTOs are validated by class-validator.
// =====================================================================
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export interface ContactMatchDTO {
  contactId: string;
  type: 'lead' | 'client';
  name: string;
}

export interface ThreadSummaryDTO {
  id: string;
  subject: string;
  from: string; // display name or email
  fromEmail: string;
  snippet: string;
  date: string; // ISO
  unread: boolean;
  contact: ContactMatchDTO | null;
}

export interface EmailMessageDTO {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string[];
  subject: string;
  date: string; // ISO
  snippet: string;
  bodyText: string;
  bodyHtml: string | null;
}

export interface ThreadDetailDTO {
  id: string;
  subject: string;
  contact: ContactMatchDTO | null;
  messages: EmailMessageDTO[];
}

export class SendEmailDTO {
  @IsEmail()
  to!: string;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  /** Reply within an existing thread. */
  @IsOptional()
  @IsString()
  threadId?: string;

  /** RFC822 Message-Id of the message being replied to (sets In-Reply-To). */
  @IsOptional()
  @IsString()
  inReplyTo?: string;
}
