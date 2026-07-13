// =====================================================================
// PREI | Agent Outbound-Message DTO — Eylül'ün (AI) cevabını
// communications'a outbound olarak yazar (WhatsApp/Telegram ortak yol).
// =====================================================================
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class OutboundMessageDto {
  @IsUUID()
  lead_id!: string;

  @IsIn(['whatsapp', 'telegram'])
  channel!: 'whatsapp' | 'telegram';

  @IsString() @MaxLength(8000)
  message!: string;

  @IsOptional() @IsString() @MaxLength(128)
  external_message_id?: string;
}
