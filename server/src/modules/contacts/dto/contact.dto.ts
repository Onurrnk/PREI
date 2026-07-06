// =====================================================================
// PREI | Contacts DTO — kişi (person master) oluşturma şeması.
// ValidationPipe(whitelist+forbidNonWhitelisted) DTO-dışı alanları reddeder.
// =====================================================================
import {
  IsOptional, IsString, IsEmail, IsBoolean, MaxLength, MinLength, IsIn,
} from 'class-validator';

const LANGS = ['tr', 'en', 'nl', 'es', 'ar', 'de'] as const;

export class CreateContactDto {
  @IsString() @MinLength(1) @MaxLength(120)
  first_name!: string;

  @IsOptional() @IsString() @MaxLength(120)
  last_name?: string;

  @IsOptional() @IsEmail() @MaxLength(200)
  email?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(40)
  whatsapp?: string;

  @IsOptional() @IsIn(LANGS)
  preferred_lang?: (typeof LANGS)[number];

  @IsOptional() @IsBoolean()
  marketing_consent?: boolean;

  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string;
}
