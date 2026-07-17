import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Yeni ekip üyesi: Supabase Auth hesabı + PREI users satırı + rol ataması.
// roleKey'in geçerliliği (tenant'ın roles tablosunda var mı) servis katmanında
// doğrulanır — biçim burada kontrol edilir.
export class CreateTeamMemberDto {
  @IsString() @MinLength(2) @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString() @MinLength(1) @MaxLength(60)
  roleKey!: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;
}
