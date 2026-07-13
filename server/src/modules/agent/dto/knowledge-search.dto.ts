// =====================================================================
// PREI | Agent Knowledge-Search DTO — n8n'in RAG sorgusu.
// Embedding n8n tarafında üretilir (OpenAI text-embedding-3-small,
// 1536 boyut — mevcut knowledge_chunks korpusuyla AYNI model olmalı).
// service_role burada gerekmiyor: backend kendi DB bağlantısıyla
// match_documents'ı çağırır, n8n yalnız sonucu görür (OV-4).
// =====================================================================
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class KnowledgeSearchDto {
  @IsArray() @ArrayMinSize(1536) @ArrayMaxSize(1536) @IsNumber({}, { each: true })
  embedding!: number[];

  @IsOptional() @IsInt() @Min(1) @Max(20)
  matchCount?: number;
}
