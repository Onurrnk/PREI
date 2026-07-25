-- =====================================================================
-- PREI | 003f — 003e'deki keyContact taşımasını düzelt.
--
-- Hata: 003e metadata anahtarlarını camelCase okudu (keyContactName) ama
-- DevelopersService snake_case yazıyor (key_contact_name). Sonuç: hiçbir
-- kilit kişi taşınmadı, sessizce 0 satır eklendi. Doğru anahtarlarla
-- yeniden çalıştırılıyor.
-- =====================================================================
BEGIN;

INSERT INTO organization_contacts
  (tenant_id, organization_id, full_name, title, email, phone, is_primary, created_by, updated_by)
SELECT o.tenant_id, o.id,
       btrim(o.metadata->>'key_contact_name'),
       NULLIF(btrim(coalesce(o.metadata->>'key_contact_title', '')), ''),
       NULLIF(btrim(coalesce(o.metadata->>'key_contact_email', '')), ''),
       NULLIF(btrim(coalesce(o.metadata->>'key_contact_phone', '')), ''),
       true, o.created_by, o.updated_by
  FROM organizations o
 WHERE o.deleted_at IS NULL
   AND btrim(coalesce(o.metadata->>'key_contact_name', '')) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM organization_contacts c
      WHERE c.organization_id = o.id AND c.deleted_at IS NULL
   );

COMMIT;
