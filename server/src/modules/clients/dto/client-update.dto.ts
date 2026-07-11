// =====================================================================
// PREI | UpdateClientDto — profil düzenleme sözleşmesi (tüm alanlar opsiyonel;
// yalnız gönderilenler yazılır). Frontend EditableProfile ile hizalı.
// =====================================================================
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClientDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(320)
  email?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(80)
  nationality?: string;

  @IsOptional() @IsIn(['Individual', 'Corporate', 'VIP'])
  type?: string;

  @IsOptional() @IsIn(['Active', 'Dormant', 'Churned'])
  relationshipStatus?: string;

  @IsOptional() @IsIn(['Conservative', 'Balanced', 'Aggressive'])
  investmentProfile?: string;

  @IsOptional() @IsString() @MaxLength(120)
  assignedConsultant?: string;

  @IsOptional() @IsString() @MaxLength(120)
  source?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  preferredRegions?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  unitTypes?: string[];

  @IsOptional() @IsIn(['Investment', 'End-use', 'Golden Visa', 'Relocation'])
  purpose?: string;

  @IsOptional() @IsString() @MaxLength(120)
  budgetRange?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  requirements?: string;
}
