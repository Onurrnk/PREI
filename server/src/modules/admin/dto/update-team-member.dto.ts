import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Gerçek atanabilir roller tenant'ın roles tablosundan gelir (GET /api/admin/roles);
// burada yalnız biçim doğrulanır, varlık kontrolü servis katmanında yapılır.
export class UpdateTeamMemberDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  roleKey?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
