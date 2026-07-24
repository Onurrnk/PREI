// =====================================================================
// PREI | Sosyal medya DTO'ları (002w) — elle giriş sözleşmeleri.
// =====================================================================
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const SOCIAL_PLATFORMS = ['instagram', 'linkedin', 'x', 'youtube', 'tiktok', 'facebook', 'telegram'] as const;

export class UpsertFollowersDto {
  @IsIn(SOCIAL_PLATFORMS as unknown as string[])
  platform!: string;

  @IsInt() @Min(0)
  followers!: number;

  @IsOptional() @IsDateString()
  snapshotDate?: string;
}

export class CreateSocialPostDto {
  @IsIn(SOCIAL_PLATFORMS as unknown as string[])
  platform!: string;

  @IsString() @MinLength(2) @MaxLength(300)
  title!: string;

  @IsOptional() @IsString() @MaxLength(500)
  url?: string;

  @IsOptional() @IsDateString()
  postedAt?: string;

  @IsOptional() @IsInt() @Min(0)
  impressions?: number;

  @IsOptional() @IsInt() @Min(0)
  engagements?: number;

  @IsOptional() @IsInt() @Min(0)
  leads?: number;
}
