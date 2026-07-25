// =====================================================================
// PREI | UpdateTaskDto — istemci görsel etiketleri gönderir (TaskDTO şekli);
// servis enum'a çevirir. En az bir alan gerekli (status veya priority).
// =====================================================================
import { IsOptional, IsIn, IsString, MaxLength, MinLength, IsDateString, ValidateIf } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional() @IsIn(['Pending', 'In Progress', 'Completed'])
  status?: 'Pending' | 'In Progress' | 'Completed';

  @IsOptional() @IsIn(['Low', 'Medium', 'High'])
  priority?: 'Low' | 'Medium' | 'High';

  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  title?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  /** '' = tarihi temizle; ISO tarih = ayarla. */
  @IsOptional() @ValidateIf((_, v) => v !== '') @IsDateString()
  dueDate?: string;

  /** Bu işlemle birlikte kaydedilecek rapor notu (geniş alan). */
  @IsOptional() @IsString() @MaxLength(5000)
  report?: string;
}

export const STATUS_TO_ENUM: Record<string, string> = {
  Pending: 'pending', 'In Progress': 'in_progress', Completed: 'completed',
};
export const PRIORITY_TO_ENUM: Record<string, string> = {
  Low: 'low', Medium: 'medium', High: 'high',
};
