import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Eylül'ün haftalık kendini-geliştirme döngüsü: konuşmalardan çıkarılan ve
// Onur'un Telegram'dan ONAYLADIĞI Q&A çiftleri bilgi bankasına (documents)
// eklenir. Embedding n8n'de üretilir (text-embedding-3-small, 1536).
export class KnowledgeAddDto {
  @IsString() @MinLength(20) @MaxLength(4000)
  content!: string;

  @IsArray() @ArrayMinSize(1536) @ArrayMaxSize(1536)
  @IsNumber({}, { each: true })
  embedding!: number[];

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
