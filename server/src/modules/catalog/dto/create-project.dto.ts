import {
  IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];
const STATUSES = ['Off-plan', 'Under Construction', 'Completed'];

export class PaymentPlanRowDto {
  @IsString() @MinLength(1) @MaxLength(120)
  milestone!: string;

  @IsNumber() @Min(0)
  percentage!: number;

  @IsString() @MaxLength(120)
  date!: string;
}

export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

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
