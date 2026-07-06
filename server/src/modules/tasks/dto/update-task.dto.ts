// =====================================================================
// PREI | UpdateTaskDto — istemci görsel etiketleri gönderir (TaskDTO şekli);
// servis enum'a çevirir. En az bir alan gerekli (status veya priority).
// =====================================================================
import { IsOptional, IsIn } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional() @IsIn(['Pending', 'In Progress', 'Completed'])
  status?: 'Pending' | 'In Progress' | 'Completed';

  @IsOptional() @IsIn(['Low', 'Medium', 'High'])
  priority?: 'Low' | 'Medium' | 'High';
}

export const STATUS_TO_ENUM: Record<string, string> = {
  Pending: 'pending', 'In Progress': 'in_progress', Completed: 'completed',
};
export const PRIORITY_TO_ENUM: Record<string, string> = {
  Low: 'low', Medium: 'medium', High: 'high',
};
