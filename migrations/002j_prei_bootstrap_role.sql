-- =====================================================================
-- PREI | 002j — prei_bootstrap rolü.
-- 002i'de prei_app (NOBYPASSRLS) eklenince gerçek bir chicken-and-egg
-- ortaya çıktı: DatabaseService.raw() (JwtAuthGuard.resolvePrincipal,
-- AgentKeyGuard'ın servis-principal çözümü) email'den tenant/rol bulmak
-- için users/user_roles/roles'a bakar — ama bu tablolar da tenant_id =
-- app_tenant() RLS'ine tabi (002b), ve bu sorgu ÇALIŞTIĞI ANDA henüz
-- hangi tenant olduğu bilinmiyor (GUC set edilmemiş). prei_app ile bu
-- sorgu 0 satır döner, login çalışmaz.
--
-- Çözüm: yalnız bu üç tabloyu okuyabilen, BAŞKA HİÇBİR ŞEYE erişimi
-- olmayan, dar yetkili bir BYPASSRLS rolü. BYPASSRLS RLS satır filtresini
-- atlar ama GRANT katmanını atlamaz — bu rol sızsa bile yapabileceği tek
-- şey users/user_roles/roles'u okumak (e-posta/rol/tenant_id; finansal/
-- lead verisi yok).
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'prei_bootstrap') THEN
    CREATE ROLE prei_bootstrap WITH LOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO prei_bootstrap;
GRANT SELECT ON users, user_roles, roles TO prei_bootstrap;
