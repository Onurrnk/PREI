// =====================================================================
// PREI | Leads DTO — class-validator ile şema + semantik doğrulama.
// ValidationPipe(whitelist+forbidNonWhitelisted) DTO-dışı alanları reddeder.
// =====================================================================
import {
  IsUUID, IsOptional, IsString, IsIn, IsNumber, Min, MaxLength, IsInt, Max,
} from 'class-validator';

const LEAD_STATUS = ['new', 'contacted', 'qualified', 'unqualified', 'nurturing', 'converted', 'lost'] as const;
const INTEREST = ['buy', 'rent', 'sell', 'invest'] as const;
const PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;

export class CreateLeadDto {
  @IsUUID()
  contact_id!: string;

  @IsOptional() @IsUUID()
  owner_id?: string; // verilmezse ctx.userId

  @IsOptional() @IsUUID()
  source_id?: string;

  @IsOptional() @IsIn(LEAD_STATUS)
  status?: (typeof LEAD_STATUS)[number];

  @IsOptional() @IsIn(INTEREST)
  interest_type?: (typeof INTEREST)[number];

  @IsOptional() @IsIn(PRIORITY)
  priority?: (typeof PRIORITY)[number];

  @IsOptional() @IsNumber() @Min(0)
  budget_min?: number;

  @IsOptional() @IsNumber() @Min(0)
  budget_max?: number;

  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @IsOptional() @IsString() @MaxLength(2)
  target_market_code?: string;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  score?: number;

  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string;
}

export class UpdateLeadDto {
  @IsOptional() @IsIn(LEAD_STATUS)
  status?: (typeof LEAD_STATUS)[number];

  @IsOptional() @IsIn(PRIORITY)
  priority?: (typeof PRIORITY)[number];

  @IsOptional() @IsUUID()
  owner_id?: string;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  score?: number;

  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string;

  // Optimistic concurrency: istemci gördüğü version'ı gönderir → 409 yönetimi
  @IsInt()
  version!: number;
}
