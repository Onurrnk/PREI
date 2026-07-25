// =====================================================================
// PREI | Toplu içe aktarım DTO'su.
// ValidationPipe(whitelist + forbidNonWhitelisted) DTO-dışı alanı reddeder.
// =====================================================================
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** 5000 satır × makul satır uzunluğu için üst sınır (~8 MB). */
const MAX_CSV = 8_000_000;

export class ImportContactsDto {
  @IsString() @MaxLength(MAX_CSV, { message: 'Dosya çok büyük (en çok 8 MB).' })
  csv!: string;

  /**
   * Ülke kodsuz yerel numaralar için varsayılan alan kodu ("90").
   * Verilmezse yerel numaralar ülkesiz kalır — ülke UYDURULMAZ.
   */
  @IsOptional() @IsString() @Matches(/^\d{1,4}$/, {
    message: 'Alan kodu yalnız rakam olmalı (ör. 90).',
  })
  defaultDialCode?: string;

  /** Ayırıcı; verilmezse dosyadan ölçülerek seçilir. */
  @IsOptional() @IsIn([',', ';', '\t', '|'])
  delimiter?: string;
}
