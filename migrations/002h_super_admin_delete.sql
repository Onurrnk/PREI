-- =====================================================================
-- PREI | Migration 002h — super_admin kalıcı silme desteği
-- Onur talebi (2026-07-18): "süper adminim ama hiçbir şey silemiyorum,
-- test kayıtlarını silip sıfırdan başlamak istiyorum."
--
-- Tek engel: lead_scores append-only trigger'ı (002f) DELETE'i koşulsuz
-- engelliyor → leads ON DELETE CASCADE zinciri lead_scores'a gelince
-- patlıyor, lead hiç silinemiyor. Bu migration trigger'a KONTROLLÜ bir
-- istisna açar: yalnız super_admin oturumunda (app.role GUC) DELETE geçer.
-- UPDATE her rol için engelli kalır (skor geçmişi oynanamaz).
-- audit_log'a DOKUNULMAZ — o her koşulda append-only (F6); silme işlemi
-- de audit_log'a 'lead.deleted' / 'contact.deleted' satırı olarak düşer.
--
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- Down-script en altta (yorum).
-- =====================================================================

-- 1. Trigger: UPDATE her zaman engelli; DELETE yalnız super_admin ---------
CREATE OR REPLACE FUNCTION lead_scores_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
    -- super_admin silmesi (lead silme cascade'i dahil) serbest;
    -- diğer her şey append-only kuralına takılır.
    IF TG_OP = 'DELETE' AND app_role() = 'super_admin' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'lead_scores değiştirilemez (append-only): % engellendi', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- 2. RLS: DELETE politikası (yalnız super_admin, kendi tenant'ı) ----------
-- 002f'de DELETE policy yoktu → RLS-zorunlu rollerde delete reddedilirdi.
DROP POLICY IF EXISTS lead_scores_delete ON lead_scores;
CREATE POLICY lead_scores_delete ON lead_scores FOR DELETE
    USING (tenant_id = app_tenant() AND app_role() = 'super_admin');

-- Not: 002f'deki REVOKE UPDATE/DELETE (PUBLIC/authenticated/anon) yerinde
-- kalır — backend'in bağlandığı rol (tablo sahibi) bundan etkilenmez;
-- Supabase REST rolleri silme yapamaz olmaya devam eder.

-- =====================================================================
-- DOWN (geri alma — 002f'nin koşulsuz trigger'ına dönüş):
--   DROP POLICY IF EXISTS lead_scores_delete ON lead_scores;
--   CREATE OR REPLACE FUNCTION lead_scores_immutable() RETURNS trigger
--     LANGUAGE plpgsql SET search_path = public, pg_temp
--   AS $fn$
--   BEGIN
--       RAISE EXCEPTION 'lead_scores değiştirilemez (append-only): % engellendi', TG_OP
--           USING ERRCODE = 'insufficient_privilege';
--   END;
--   $fn$;
-- =====================================================================
