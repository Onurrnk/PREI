import {
  IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength,
} from 'class-validator';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];

export class CreateProposalDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsUUID()
  contactId!: string;

  @IsOptional() @IsUUID()
  propertyId?: string;

  @IsOptional() @IsNumber() @Min(0)
  totalValue?: number;

  @IsOptional() @IsIn(CURRENCIES)
  currency?: string;

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
