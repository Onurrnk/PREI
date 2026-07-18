import { IsOptional, IsString, MaxLength } from 'class-validator';

// Analiz maili gönderildi işareti + (opsiyonel) raporun kendisi —
// verilirse meeting_notes'a kaydedilir, ClientProfile "AI Analiz" sekmesi okur.
export class AnalysisSentDto {
  @IsOptional() @IsString() @MaxLength(300)
  subject?: string;

  @IsOptional() @IsString() @MaxLength(20000)
  report?: string;
}
