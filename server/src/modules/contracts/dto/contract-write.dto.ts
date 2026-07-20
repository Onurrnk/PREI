// =====================================================================
// PREI | Contract yazma DTO'ları (create + update). Komisyon/legalEntity/
// paymentTerms metadata jsonb'ye; property_id→proje+geliştirici read'de
// join'lenir. 'contracts' izni (finance_manager+manager+super_admin) gerekir.
// =====================================================================
import { Type } from 'class-transformer';
import {
  IsIn, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min,
} from 'class-validator';

export const CONTRACT_TYPES = ['sale', 'rental', 'pm', 'reservation'] as const;
export const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated', 'renewed'] as const;

export class CreateContractDto {
  @IsIn(CONTRACT_TYPES)
  contractType!: (typeof CONTRACT_TYPES)[number];

  @IsOptional() @IsIn(CONTRACT_STATUSES)
  status?: (typeof CONTRACT_STATUSES)[number];

  @IsOptional() @IsUUID()
  propertyId?: string | null;

  @IsOptional() @IsUUID()
  contactId?: string | null;

  @IsOptional() @IsISO8601()
  startDate?: string | null;

  @IsOptional() @IsISO8601()
  endDate?: string | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  amount?: number | null;

  @IsOptional() @IsString() @MaxLength(8)
  currency?: string;

  @IsOptional() @IsString() @MaxLength(60)
  commission?: string;

  @IsOptional() @IsString() @MaxLength(200)
  legalEntity?: string;

  @IsOptional() @IsString() @MaxLength(400)
  paymentTerms?: string;
}

export class UpdateContractDto {
  @IsOptional() @IsIn(CONTRACT_TYPES)
  contractType?: (typeof CONTRACT_TYPES)[number];

  @IsOptional() @IsIn(CONTRACT_STATUSES)
  status?: (typeof CONTRACT_STATUSES)[number];

  @IsOptional() @IsUUID()
  propertyId?: string | null;

  @IsOptional() @IsUUID()
  contactId?: string | null;

  @IsOptional() @IsISO8601()
  startDate?: string | null;

  @IsOptional() @IsISO8601()
  endDate?: string | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  amount?: number | null;

  @IsOptional() @IsString() @MaxLength(8)
  currency?: string;

  @IsOptional() @IsString() @MaxLength(60)
  commission?: string;

  @IsOptional() @IsString() @MaxLength(200)
  legalEntity?: string;

  @IsOptional() @IsString() @MaxLength(400)
  paymentTerms?: string;
}
