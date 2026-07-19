// =====================================================================
// PREI | UpdateProposalDto — teklif güncelleme (kısmi). Zengin alanlar
// metadata içinde taşınır; status taslak↔gönderildi geçişleri buradan
// veya /send ucundan yapılır.
// =====================================================================
import { IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];

export class UpdateProposalDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsNumber() @Min(0) totalValue?: number;
  @IsOptional() @IsIn(CURRENCIES) currency?: string;
  @IsOptional() @IsIn(['draft', 'sent', 'viewed', 'accepted', 'rejected']) status?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
