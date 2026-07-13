-- =====================================================================
-- PREI | 002i — prei_app (NOBYPASSRLS) rolü.
-- Bu ana kadar backend `postgres` superuser ile bağlanıyordu — RLS
-- politikaları servis katmanında (DatabaseService.withContext + app_*
-- GUC'ları) doğru çalıştığı kanıtlanmıştı, ama superuser BYPASSRLS
-- olduğundan RLS'in kendisi hiç zorlanmıyordu (defense-in-depth eksikti).
-- Bu migration, backend'in artık gerçekten RLS'e tabi bir rolle
-- bağlanabilmesi için gereken rol+GRANT'ları kurar. Parola ayrı
-- verilir (migration dosyasına gömülmez).
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'prei_app') THEN
    CREATE ROLE prei_app WITH LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO prei_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO prei_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO prei_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO prei_app;

-- Gelecekteki migration'larda yeni tablo/fonksiyon eklenince otomatik
-- kapsansın diye (unutma riski olmadan).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prei_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO prei_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO prei_app;

-- F6 append-only tabloları: blanket GRANT'ın üstüne aynı REVOKE'u
-- prei_app için de uygula (002b/002f'de PUBLIC+authenticated+anon için
-- yapılmıştı, prei_app doğrudan grant aldığı için ayrıca gerekiyor).
-- Trigger zaten engelliyor (doğrulandı) — bu GRANT-seviyesinde ikinci kat.
REVOKE UPDATE, DELETE ON audit_log FROM prei_app;
REVOKE UPDATE, DELETE ON lead_scores FROM prei_app;
