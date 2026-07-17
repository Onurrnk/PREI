import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// produality.com formlarından (iletişim + ROI Calculator) gelen yeni
// yatırımcı talebi — contact.php bu gövdeyi X-Agent-Key ile forward eder.
export class WebLeadDto {
  @IsString() @MinLength(2) @MaxLength(160)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(80)
  country?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  message?: string;

  @IsOptional() @IsIn(['tr', 'en'])
  lang?: 'tr' | 'en';

  @IsIn(['contact', 'roi_report'])
  source!: 'contact' | 'roi_report';

  /** Formun gönderildiği sayfa yolu (analiz için). */
  @IsOptional() @IsString() @MaxLength(300)
  page?: string;
}
