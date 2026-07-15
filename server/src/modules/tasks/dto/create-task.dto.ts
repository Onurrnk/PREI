// =====================================================================
// PREI | CreateTaskDto — yeni görev oluşturma. task_type her zaman
// 'task' (toplantılar ayrı bir akıştan gelecek); status her zaman
// 'pending' başlar.
// =====================================================================
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsIn(['Low', 'Medium', 'High'])
  priority?: 'Low' | 'Medium' | 'High';

  @IsOptional() @IsUUID()
  assigneeId?: string;
}
