// =====================================================================
// PREI | SetLifecycleDto — proje yaşam döngüsü durumu değişimi.
// active = katalogda + müşteri eşleşmesinde; diğerleri eşleşmeden düşer.
// =====================================================================
import { IsIn } from 'class-validator';

export const LIFECYCLE_STATUSES = ['active', 'sold', 'paused', 'archived'] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export class SetLifecycleDto {
  @IsIn(LIFECYCLE_STATUSES)
  status!: LifecycleStatus;
}
