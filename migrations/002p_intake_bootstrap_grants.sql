-- =====================================================================
-- PREI | Migration 002p — intake public token çözümü için bootstrap grant'leri
-- =====================================================================
-- SubmissionTokenGuard, davet token'ını istek bağlamı (tenant) OLUŞMADAN
-- çözer → DatabaseService.raw (prei_bootstrap, BYPASSRLS) kullanır. Bu rol
-- 002j'de yalnız users/user_roles/roles'a yetkiliydi; token çözümü + kullanım
-- sayacı + geliştirici adı için project_invites (SELECT/UPDATE) ve
-- organizations (SELECT) yetkisi gerekir. (Auth bootstrap deseniyle aynı
-- gerekçe: tenant bilinmeden okuma.)
-- =====================================================================

GRANT SELECT, UPDATE ON project_invites TO prei_bootstrap;
GRANT SELECT ON organizations TO prei_bootstrap;

-- DOWN:
--   REVOKE SELECT, UPDATE ON project_invites FROM prei_bootstrap;
--   REVOKE SELECT ON organizations FROM prei_bootstrap;
