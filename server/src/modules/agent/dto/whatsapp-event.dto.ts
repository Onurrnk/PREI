// =====================================================================
// PREI | Agent Ingest DTO — n8n WhatsApp webhook → PREI atomik yazım.
// =====================================================================
import {
  IsString, IsOptional, MaxLength, IsIn, IsInt, Min, Max, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AttributionDto {
  @IsOptional() @IsString() @MaxLength(64) ad_id?: string;
  @IsOptional() @IsString() @MaxLength(64) adset_id?: string;
  @IsOptional() @IsString() @MaxLength(64) campaign_id?: string;
  @IsOptional() @IsString() @MaxLength(300) headline?: string;
}

export class WhatsAppEventDto {
  // Zorunlu: gönderenin telefonu (contact dedup anahtarı — normalized_phone).
  // Telegram testinde gerçek telefon yok — n8n chat_id'yi digits-only string
  // olarak buraya geçirir (aynı dedup mekaniği, geçici test kimliği).
  @IsString() @MaxLength(32)
  phone!: string;

  // whatsapp (varsayılan) | telegram — comm_channel enum (002h). Eylül'ün
  // konuşma akışını WhatsApp/Meta onayı gelene kadar Telegram'da test etmek
  // için eklendi; ingest'in geri kalanı (contact/lead/session/dedup) ortak.
  @IsOptional() @IsIn(['whatsapp', 'telegram'])
  channel?: 'whatsapp' | 'telegram';

  @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @IsString() @MaxLength(8000)
  message!: string;

  // WhatsApp Cloud API oturum kimliği (dedupe + oturum eşleme)
  @IsOptional() @IsString() @MaxLength(128)
  external_session_id?: string;

  // Provider mesaj kimliği (idempotency — B-8 dedupe)
  @IsOptional() @IsString() @MaxLength(128)
  external_message_id?: string;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  qualification_score?: number;

  @IsOptional() @IsIn(['ad', 'organic', 'referral'])
  source_type?: 'ad' | 'organic' | 'referral';

  @IsOptional() @IsObject() @ValidateNested() @Type(() => AttributionDto)
  attribution?: AttributionDto;
}
