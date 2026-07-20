// =====================================================================
// PREI | Proje (properties) tam-alan güncelleme DTO'su. Tüm alanlar
// opsiyonel; verilen alanlar güncellenir. Kolonlar (title/developer/city/
// district/price/currency/description) doğrudan; status/completion/units/
// paymentPlan/amenities metadata'ya merge. 'projects' izni gerekir.
// =====================================================================
import {
  IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentPlanRowDto } from './create-project.dto';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];
const STATUSES = ['Off-plan', 'Under Construction', 'Completed'];

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsUUID()
  developerId?: string;

  @IsOptional() @IsIn(STATUSES)
  status?: string;

  @IsOptional() @IsString() @MaxLength(120)
  city?: string;

  @IsOptional() @IsString() @MaxLength(120)
  district?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsNumber() @Min(0)
  price?: number;

  @IsOptional() @IsIn(CURRENCIES)
  currency?: string;

  @IsOptional() @IsString() @MaxLength(60)
  completionDate?: string;

  @IsOptional() @IsInt() @Min(0)
  totalUnits?: number;

  @IsOptional() @IsInt() @Min(0)
  availableUnits?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentPlanRowDto)
  paymentPlan?: PaymentPlanRowDto[];

  @IsOptional() @IsArray() @IsString({ each: true })
  amenities?: string[];
}
