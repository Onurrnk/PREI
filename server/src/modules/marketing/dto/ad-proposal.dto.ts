import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ApproveProposalDto {
  /** Onaylanan günlük bütçe. Verilmezse AI önerisi korunur. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  dailyBudget?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
