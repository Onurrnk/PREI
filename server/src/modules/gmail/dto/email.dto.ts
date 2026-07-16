// =====================================================================
// PREI | Gmail DTOs
// Response DTOs are the PREI-shaped contract returned to the frontend —
// deliberately decoupled from Gmail's raw schema (ACL boundary).
// Request DTOs are validated by class-validator.
// =====================================================================
import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class EmailAttachmentDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  /** Dosya içeriği, base64 (data: prefix'siz). Toplam boyut serviste sınırlanır. */
  @IsString()
  @MinLength(1)
  dataBase64!: string;
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

  /** Kompozörden gelen zengin gövde (b/i/u/liste). Verilirse markalı
   *  şablonun paragraf bölümüne (sanitize edilerek) bu yerleştirilir. */
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDTO)
  attachments?: EmailAttachmentDTO[];

  /** Reply within an existing thread. */
  @IsOptional()
  @IsString()
  threadId?: string;

  /** RFC822 Message-Id of the message being replied to (sets In-Reply-To). */
  @IsOptional()
  @IsString()
  inReplyTo?: string;

  /** Alıcının görünen adı — verilmezse e-postanın @ öncesi kısmı kullanılır. */
  @IsOptional()
  @IsString()
  recipientName?: string;
}
