// =====================================================================
// PREI | Agent Lead-Profile DTO — Eylül'ün konuşmadan çıkardığı yatırımcı
// profili. Tüm alanlar opsiyonel: extraction yalnız emin olduğu alanları
// gönderir; boş/verilmeyen alan mevcut kaydı EZMEZ (yalnız doldurur).
// =====================================================================
import { IsEmail, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class LeadProfileDto {
  @IsUUID()
  lead_id!: string;

  @IsOptional() @IsString() @MaxLength(120)
  first_name?: string;

  @IsOptional() @IsString() @MaxLength(120)
  last_name?: string;

  @IsOptional() @IsEmail() @MaxLength(200)
  email?: string;

  // Konuşmada verilen GERÇEK telefon (Telegram chat-id değil).
  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @IsOptional() @IsNumber() @Min(0)
  budget_min?: number;

  @IsOptional() @IsNumber() @Min(0)
  budget_max?: number;

  @IsOptional() @IsIn(['TRY', 'USD', 'EUR', 'GBP', 'AED'])
  currency?: string;

  // Serbest şekilli kriterler (unit_type, area_m2, market, district,
  // purpose, timeline, special_requests...) — leads.metadata.criteria'ya
  // merge edilir; şema kasıtlı kilitlenmedi (keşif akışı evrilecek).
  @IsOptional() @IsObject()
  criteria?: Record<string, unknown>;
}
