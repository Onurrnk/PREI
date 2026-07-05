-- =====================================================================
-- PREI | Smart Suites — Migration 002b: RLS Sertleştirme (B-3 onarımı)
-- Kapsam:
--   * app_* GUC fonksiyonlarına search_path pinleme (advisor: mutable)
--   * B-3: leads/deals/activities ownership'i AS RESTRICTIVE'e çevir
--     (permissive-OR açığı → consultant başkasının lead'ini SQL'den okuyamaz)
--   * RLS'i TÜM public veri tablolarına genişlet (PostgREST anon/authenticated
--     GUC'suz erişince 0 satır görür — safety net)
--   * financials komisyon gizliliği (K-4): is_confidential yalnız
--     super_admin + finance_manager
--   * audit_log append-only teknik enforcement (F6): REVOKE + trigger
-- Model: birincil yetki SERVICE katmanı; RLS savunma-derinliği. NestJS
--   app.tenant_id/user_id/role GUC'lerini set eden bir rolle bağlanır
--   (service_role DEĞİL — o RLS'i bypass eder).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Yardımcı fonksiyonlar — search_path pinlenmiş sürümler
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_tenant() RETURNS uuid
  LANGUAGE sql STABLE SET search_path = public, pg_temp
  AS $fn$ SELECT nullif(current_setting('app.tenant_id', true),'')::uuid $fn$;
CREATE OR REPLACE FUNCTION app_user() RETURNS uuid
  LANGUAGE sql STABLE SET search_path = public, pg_temp
  AS $fn$ SELECT nullif(current_setting('app.user_id', true),'')::uuid $fn$;
CREATE OR REPLACE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE SET search_path = public, pg_temp
  AS $fn$ SELECT coalesce(nullif(current_setting('app.role', true),''),'') $fn$;
-- Ayrıcalıklı = tüm tenant verisini görür. service_agent (Eylül ingest) dahil,
-- AMA gizli komisyon HARİÇ (aşağıdaki ayrı fonksiyon).
CREATE OR REPLACE FUNCTION app_is_privileged() RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
  AS $fn$ SELECT app_role() IN ('super_admin','manager','marketing_manager','finance_manager','service_agent') $fn$;
-- K-4: gizli komisyon satırlarını yalnız bunlar görür (AI servis-principal HARİÇ)
CREATE OR REPLACE FUNCTION app_can_see_confidential() RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
  AS $fn$ SELECT app_role() IN ('super_admin','finance_manager') $fn$;

-- set_updated_at (001'den) — search_path pinle
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    IF TG_OP = 'UPDATE' AND to_jsonb(NEW) ? 'version' THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$;

-- match_documents (n8n filter'lı sürüm) — search_path pinle
CREATE OR REPLACE FUNCTION match_documents(query_embedding vector, match_count integer DEFAULT 5, filter jsonb DEFAULT '{}'::jsonb)
  RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
  LANGUAGE plpgsql STABLE SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.content, d.metadata, 1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.metadata @> filter
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. B-3 ONARIMI: leads / deals / activities — ownership RESTRICTIVE
--    Eski permissive politikaları kaldır; permissive tenant + restrictive
--    ownership ile yeniden kur. RESTRICTIVE'ler AND'lenir → sızıntı kapanır.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS leads_tenant_isolation ON leads;
DROP POLICY IF EXISTS leads_ownership_read ON leads;
DROP POLICY IF EXISTS deals_tenant_isolation ON deals;
DROP POLICY IF EXISTS deals_ownership_read ON deals;
DROP POLICY IF EXISTS activities_tenant_isolation ON activities;
DROP POLICY IF EXISTS activities_scope ON activities;

-- leads
CREATE POLICY leads_tenant ON leads FOR ALL
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());
CREATE POLICY leads_ownership ON leads AS RESTRICTIVE FOR ALL
    USING (app_is_privileged() OR owner_id = app_user())
    WITH CHECK (app_is_privileged() OR owner_id = app_user());

-- deals
CREATE POLICY deals_tenant ON deals FOR ALL
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());
CREATE POLICY deals_ownership ON deals AS RESTRICTIVE FOR ALL
    USING (app_is_privileged() OR owner_id = app_user())
    WITH CHECK (app_is_privileged() OR owner_id = app_user());

-- activities (sahiplik = atanan veya oluşturan)
CREATE POLICY activities_tenant ON activities FOR ALL
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());
CREATE POLICY activities_ownership ON activities AS RESTRICTIVE FOR ALL
    USING (app_is_privileged() OR assigned_to = app_user() OR created_by = app_user())
    WITH CHECK (app_is_privileged() OR assigned_to = app_user() OR created_by = app_user());

-- ---------------------------------------------------------------------
-- 3. RLS'i tüm tenant-scoped tablolara genişlet (basit tenant izolasyonu).
--    contacts zaten 001'de var; tekrar kurulmaz (DROP+CREATE ile idempotent).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS contacts_tenant_isolation ON contacts;
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'contacts','communications','lead_assignment_history','lead_property_interests',
        'lead_sources','lead_stage_history','lead_tags','organizations','pipeline_stages',
        'pipelines','roles','tags','team_members','teams','user_roles','users','properties',
        'conversation_sessions','meeting_notes','contracts','lead_attributions'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS %1$s_tenant ON %1$s;', t);
        EXECUTE format(
          'CREATE POLICY %1$s_tenant ON %1$s FOR ALL
             USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());', t);
    END LOOP;
END $$;

-- tenants tablosu: kendi satırı (id = app_tenant())
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_self ON tenants;
CREATE POLICY tenants_self ON tenants FOR ALL
    USING (id = app_tenant()) WITH CHECK (id = app_tenant());

-- ---------------------------------------------------------------------
-- 4. FINANCIALS: tenant izolasyonu + K-4 komisyon gizliliği (RESTRICTIVE)
-- ---------------------------------------------------------------------
ALTER TABLE financials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financials_tenant ON financials;
DROP POLICY IF EXISTS financials_confidential ON financials;
CREATE POLICY financials_tenant ON financials FOR ALL
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());
-- Gizli satırlar yalnız super_admin + finance_manager'a; diğer herkese (AI dahil) görünmez
CREATE POLICY financials_confidential ON financials AS RESTRICTIVE FOR ALL
    USING (NOT is_confidential OR app_can_see_confidential())
    WITH CHECK (NOT is_confidential OR app_can_see_confidential());

-- ---------------------------------------------------------------------
-- 5. AUDIT_LOG: append-only teknik enforcement (F6)
--    - RLS: SELECT yalnız ayrıcalıklı; INSERT tenant içi serbest
--    - UPDATE/DELETE: hem GRANT seviyesinde REVOKE hem trigger ile blok
-- ---------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_select ON audit_log;
DROP POLICY IF EXISTS audit_insert ON audit_log;
CREATE POLICY audit_select ON audit_log FOR SELECT
    USING (tenant_id = app_tenant() AND app_is_privileged());
CREATE POLICY audit_insert ON audit_log FOR INSERT
    WITH CHECK (tenant_id = app_tenant());
-- UPDATE/DELETE için policy YOK → RLS altında reddedilir. Ek olarak GRANT + trigger:
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
        EXECUTE 'REVOKE UPDATE, DELETE ON audit_log FROM authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
        EXECUTE 'REVOKE UPDATE, DELETE ON audit_log FROM anon';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log değiştirilemez (append-only): % engellendi', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_log;
CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- ---------------------------------------------------------------------
-- 6. Global referans / RAG tabloları: RLS aç, okuma serbest (hassas değil)
--    markets = ülke listesi; documents/company_knowledge = pazarlama bilgisi.
--    Yazma yalnız service_role (RLS bypass) ile.
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['markets','documents','company_knowledge']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
            EXECUTE format('DROP POLICY IF EXISTS %1$s_read ON %1$s;', t);
            EXECUTE format('CREATE POLICY %1$s_read ON %1$s FOR SELECT USING (true);', t);
        END IF;
    END LOOP;
END $$;
