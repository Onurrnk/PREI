import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const TIERS = ['Tier 1', 'Tier 2', 'Boutique'];
const PARTNERSHIP_STATUSES = ['Active', 'Negotiating', 'Inactive'];

export class CreateDeveloperDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @IsOptional() @IsIn(TIERS)
  tier?: string;

  @IsOptional() @IsString() @MaxLength(120)
  headquarters?: string;

  @IsOptional() @IsIn(PARTNERSHIP_STATUSES)
  partnershipStatus?: string;

  @IsOptional() @IsString() @MaxLength(20)
  commissionRate?: string;

  @IsOptional() @IsString() @MaxLength(120)
  keyContactName?: string;

  @IsOptional() @IsEmail()
  keyContactEmail?: string;

  @IsOptional() @IsString() @MaxLength(40)
  keyContactPhone?: string;

  @IsOptional() @IsString() @MaxLength(200)
  website?: string;
}

export class UpdateDeveloperDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsIn(TIERS)
  tier?: string;

  @IsOptional() @IsString() @MaxLength(120)
  headquarters?: string;

  @IsOptional() @IsIn(PARTNERSHIP_STATUSES)
  partnershipStatus?: string;

  @IsOptional() @IsString() @MaxLength(20)
  commissionRate?: string;

  @IsOptional() @IsString() @MaxLength(120)
  keyContactName?: string;

  @IsOptional() @IsEmail()
  keyContactEmail?: string;

  @IsOptional() @IsString() @MaxLength(40)
  keyContactPhone?: string;

  @IsOptional() @IsString() @MaxLength(200)
  website?: string;
}
