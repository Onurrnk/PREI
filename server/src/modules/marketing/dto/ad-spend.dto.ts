// =====================================================================
// PREI | Marketing — ad_spend giriş DTO'ları (elle + CSV içe aktarım).
// Global ValidationPipe(whitelist + forbidNonWhitelisted) aktif olduğundan
// tüm gövde alanları burada decorator ile tanımlı olmak ZORUNDA.
// =====================================================================
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber,
  IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];
const MARKETS = ['TR', 'AE', 'ES', 'GB', 'TH', 'DE'];
const CHANNELS = ['meta', 'instagram', 'google', 'other'];
const STATUSES = ['active', 'paused'];

export class CreateAdSpendDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @MaxLength(120)
  campaignRef?: string;

  @IsOptional() @IsIn(MARKETS)
  marketCode?: string;

  @IsOptional() @IsIn(CHANNELS)
  channel?: string;

  @IsOptional() @IsIn(STATUSES)
  status?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsNumber() @Min(0)
  spend!: number;

  @IsOptional() @IsIn(CURRENCIES)
  currency?: string;

  @IsOptional() @IsInt() @Min(0)
  impressions?: number;

  @IsOptional() @IsInt() @Min(0)
  clicks?: number;
}

export class ImportAdSpendDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateAdSpendDto)
  rows!: CreateAdSpendDto[];
}

export class UpdateAdSpendDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(120)
  campaignRef?: string;

  @IsOptional() @IsIn(MARKETS)
  marketCode?: string;

  @IsOptional() @IsIn(CHANNELS)
  channel?: string;

  @IsOptional() @IsIn(STATUSES)
  status?: string;

  @IsOptional() @IsDateString()
  periodStart?: string;

  @IsOptional() @IsDateString()
  periodEnd?: string;

  @IsOptional() @IsNumber() @Min(0)
  spend?: number;

  @IsOptional() @IsIn(CURRENCIES)
  currency?: string;

  @IsOptional() @IsInt() @Min(0)
  impressions?: number;

  @IsOptional() @IsInt() @Min(0)
  clicks?: number;
}
