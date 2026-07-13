// =====================================================================
// PREI | Agent Lead-Score DTO — n8n RAG skorlama sonucu → PREI atomik yazım.
// =====================================================================
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class LeadScoreEventDto {
  @IsUUID()
  lead_id!: string;

  @IsInt() @Min(0) @Max(100)
  score!: number;

  @IsOptional() @IsString() @MaxLength(4000)
  reasoning?: string;

  // Yapılandırılmış sinyal kırılımı — n8n'in RAG akışında topladığı ölçülebilir
  // faktörler (ör. { budget_clarity: 0.8, response_speed_min: 12, market_match: true }).
  // Şekli kasıtlı olarak sabitlenmedi — skorlama modeli olgunlaştıkça değişecek.
  @IsOptional() @IsObject()
  signals?: Record<string, unknown>;
}
