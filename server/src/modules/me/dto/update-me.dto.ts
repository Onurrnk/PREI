// =====================================================================
// PREI | UpdateMeDto — kendi profilini düzenleme sözleşmesi (tüm alanlar
// opsiyonel; yalnız gönderilenler yazılır). fullName/phone doğrudan users
// kolonlarına, geri kalanı users.metadata jsonb'e yazılır.
// =====================================================================
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(200)
  fullName?: string;

  @IsOptional() @IsString() @MaxLength(120)
  jobTitle?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  aboutMe?: string;

  @IsOptional() @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @IsOptional() @IsIn(['en', 'tr'])
  locale?: string;

  @IsOptional() @IsString() @MaxLength(40)
  timezone?: string;

  @IsOptional() @IsObject()
  notificationPrefs?: Record<string, boolean>;
}
