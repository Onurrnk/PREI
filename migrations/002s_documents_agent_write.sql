-- =====================================================================
-- PREI | Migration 002s — documents (RAG bilgi tabanı) yazma politikası
-- =====================================================================
-- Sorun: documents tablosunda RLS açık; tek INSERT politikası Supabase
-- varsayılanı ("auth.role() = 'authenticated'"). Backend prei_app rolüyle +
-- app.role GUC'siyle bağlanır; auth.role() JWT claim'ine bakar, biz onu
-- set etmediğimizden asla geçmez → Eylül'ün haftalık Q&A ekleme akışı
-- (POST /api/agent/knowledge/add, service_agent) "new row violates RLS
-- policy for table documents" ile 500 veriyordu.
-- Çözüm: app_role()'e dayalı yazma politikaları. documents'ta tenant_id
-- kolonu YOK (tek-tenant global bilgi tabanı) → politika yalnız rol bazlı.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- =====================================================================

-- Eylül self-improve (service_agent) + ayrıcalıklı personel INSERT edebilir.
DROP POLICY IF EXISTS documents_app_write ON documents;
CREATE POLICY documents_app_write ON documents
    FOR INSERT
    WITH CHECK (app_role() = 'service_agent' OR app_is_privileged());

-- Ayrıcalıklı personel bilgi tabanını düzeltebilir/silebilir (yönetim).
DROP POLICY IF EXISTS documents_app_update ON documents;
CREATE POLICY documents_app_update ON documents
    FOR UPDATE
    USING (app_is_privileged())
    WITH CHECK (app_is_privileged());

DROP POLICY IF EXISTS documents_app_delete ON documents;
CREATE POLICY documents_app_delete ON documents
    FOR DELETE
    USING (app_is_privileged());

-- DOWN:
--   DROP POLICY IF EXISTS documents_app_write ON documents;
--   DROP POLICY IF EXISTS documents_app_update ON documents;
--   DROP POLICY IF EXISTS documents_app_delete ON documents;
