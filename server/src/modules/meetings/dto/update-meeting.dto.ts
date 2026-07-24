// =====================================================================
// PREI | UpdateMeetingDto — randevu düzenleme. Tüm alanlar opsiyonel;
// yalnız gönderilenler güncellenir (title/date COALESCE dışı, gönderilirse
// yazılır). CreateMeetingDto ile aynı doğrulama kuralları.
// =====================================================================
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeetingDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString() @MaxLength(20)
  durationLabel?: string;

  @IsOptional() @IsString() @MaxLength(120)
  client?: string;

  @IsOptional() @IsEmail()
  clientEmail?: string;

  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsIn(['In-person', 'Zoom', 'Phone'])
  platform?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @IsOptional() @IsIn(['meeting', 'viewing', 'signing'])
  kind?: string;
}
