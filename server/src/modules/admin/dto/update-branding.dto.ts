import { IsHexColor, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBrandingDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  companyName?: string;

  @IsOptional() @IsUrl({ require_protocol: true })
  websiteUrl?: string;

  @IsOptional() @IsHexColor()
  primaryColor?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  offPlanCommissionPct?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  secondaryCommissionPct?: number;
}
