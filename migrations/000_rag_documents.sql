-- =====================================================================
-- PREI | Smart Suites — Migration 000: RAG altyapısı (documents + pgvector)
-- Bu tablolar ProDuality RAG kurulumundan (n8n reingest) geliyordu ve
-- migration zincirinin DIŞINDA oluşturulmuştu. Zinciri kendi-kendine
-- yeterli kılmak (CI boş DB migration-dry-run) için idempotent olarak
-- buraya alındı. Prod'da hepsi IF NOT EXISTS → no-op.
-- Sıra: 000 (RAG) → 001 (CRM core) → 002a (şema) → 002b (RLS).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector — embedding araması

-- Eylül'ün factual bilgi tabanı (1.515 chunk, text-embedding-3-small / 1536).
CREATE TABLE IF NOT EXISTS documents (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content    text,
    embedding  vector(1536),
    metadata   jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
    ON documents USING hnsw (embedding vector_cosine_ops);

-- Web widget'ının hızlı hizmet özetleri (ayrı, küçük katman).
CREATE TABLE IF NOT EXISTS company_knowledge (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category   varchar(100),
    title      text,
    content    text,
    keywords   text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- match_documents RPC'si 002b'de (pinlenmiş search_path ile) tanımlanır;
-- burada tablo + extension yeterli.
