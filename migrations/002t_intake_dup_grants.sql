-- =====================================================================
-- PREI | Migration 002t — mükerrer proje ön-kontrolü için bootstrap grant'leri
-- =====================================================================
-- Public proje gönderimi (IntakeService.submit) service_agent bağlamında çalışır
-- ve properties/project_submissions'a SELECT yetkisi yoktur. Kaynak bağımsız
-- mükerrer proje tespiti (IntakeRepository.findDuplicateProject) tenant elle
-- süzülen bir sistem sorgusuyla (prei_bootstrap, BYPASSRLS) yapılır; bu rol
-- 002p'de project_invites + organizations okuyabiliyordu, mükerrer kontrolü için
-- properties + project_submissions SELECT de gerekir. (Yalnız SELECT — yazma yok.)
-- =====================================================================

GRANT SELECT ON properties TO prei_bootstrap;
GRANT SELECT ON project_submissions TO prei_bootstrap;

-- DOWN:
--   REVOKE SELECT ON properties FROM prei_bootstrap;
--   REVOKE SELECT ON project_submissions FROM prei_bootstrap;
