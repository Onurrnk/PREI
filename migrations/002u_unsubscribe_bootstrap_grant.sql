-- =====================================================================
-- PREI | Migration 002u — abonelikten çıkma (KVKK) için bootstrap grant'i
-- =====================================================================
-- Public /api/public/unsubscribe ucu KİMLİKSİZDİR (token HMAC ile doğrulanır).
-- İstek bağlamı (tenant) olmadan marketing_consent=false yapılır → sistem
-- sorgusu (prei_bootstrap, BYPASSRLS). Rol en az yetki ilkesiyle YALNIZ
-- gerekli kolonlara sınırlanır: id/tenant_id/deleted_at okuma + marketing_consent
-- güncelleme (+ RETURNING için ad kolonları). Toplu okuma/silme yetkisi yok.
-- =====================================================================

GRANT SELECT (id, tenant_id, deleted_at, first_name, last_name) ON contacts TO prei_bootstrap;
GRANT UPDATE (marketing_consent) ON contacts TO prei_bootstrap;

-- DOWN:
--   REVOKE UPDATE (marketing_consent) ON contacts FROM prei_bootstrap;
--   REVOKE SELECT (id, tenant_id, deleted_at, first_name, last_name) ON contacts FROM prei_bootstrap;
