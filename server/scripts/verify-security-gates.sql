-- =====================================================================
-- PREI | Güvenlik kapısı regresyon doğrulaması (G-1..G-6, master plan §4.5)
-- Seed-bağımsız: yalnız pg_catalog/information_schema. Herhangi bir kontrol
-- düşerse RAISE EXCEPTION → psql (ON_ERROR_STOP=1) exit 1 → CI kapısı kırılır.
-- Gerçek regresyonu yakalar: RESTRICTIVE→PERMISSIVE zayıflatma, gizli komisyon
-- erişimini genişletme, audit trigger'ını/append-only GRANT'ını düşürme.
-- Çalıştırma: psql -v ON_ERROR_STOP=1 -f verify-security-gates.sql
-- =====================================================================
DO $$
DECLARE
  v_bool boolean;
  v_txt  text;
  v_expr text;
  v_int  integer;
  v_tgtype smallint;
BEGIN
  -- 1) RLS aktif kritik tablolarda
  FOR v_txt IN SELECT unnest(ARRAY['financials','audit_log','leads','contacts','deals']) LOOP
    SELECT relrowsecurity INTO v_bool FROM pg_class WHERE relname = v_txt;
    IF v_bool IS DISTINCT FROM true THEN RAISE EXCEPTION 'G-KAPI: % tablosunda RLS kapalı', v_txt; END IF;
  END LOOP;
  RAISE NOTICE '1) RLS aktif (financials/audit_log/leads/contacts/deals) ✓';

  -- 2) Komisyon gizliliği (K-4): financials_confidential RESTRICTIVE + app_can_see_confidential
  SELECT polpermissive INTO v_bool FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'financials' AND p.polname = 'financials_confidential';
  IF v_bool IS NULL THEN RAISE EXCEPTION 'G-KAPI: financials_confidential politikası YOK'; END IF;
  IF v_bool <> false THEN RAISE EXCEPTION 'G-KAPI: financials_confidential PERMISSIVE olmuş (RESTRICTIVE olmalı)'; END IF;

  SELECT pg_get_expr(polqual, polrelid) INTO v_txt FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'financials' AND p.polname = 'financials_confidential';
  IF v_txt !~ 'app_can_see_confidential' THEN RAISE EXCEPTION 'G-KAPI: politika app_can_see_confidential() kullanmıyor'; END IF;

  -- Fonksiyon gövdesi: super_admin + finance_manager VAR; service_agent/consultant YOK
  SELECT prosrc INTO v_txt FROM pg_proc WHERE proname = 'app_can_see_confidential';
  IF v_txt IS NULL THEN RAISE EXCEPTION 'G-KAPI: app_can_see_confidential() fonksiyonu YOK'; END IF;
  IF v_txt !~ 'super_admin' OR v_txt !~ 'finance_manager' THEN
    RAISE EXCEPTION 'G-KAPI: gizli erişim super_admin/finance_manager içermiyor'; END IF;
  IF v_txt ~ 'service_agent' THEN
    RAISE EXCEPTION 'G-KAPI: gizli komisyona service_agent (AI/Eylül) erişimi EKLENMİŞ'; END IF;
  IF v_txt ~ 'consultant' THEN
    RAISE EXCEPTION 'G-KAPI: gizli komisyona consultant erişimi EKLENMİŞ'; END IF;
  RAISE NOTICE '2) Komisyon gizliliği (K-4): RESTRICTIVE + yalnız super_admin/finance_manager ✓';

  -- 3) audit_log append-only (F6): trigger BEFORE UPDATE OR DELETE
  SELECT tgtype INTO v_tgtype FROM pg_trigger
    WHERE tgname = 'trg_audit_immutable' AND NOT tgisinternal;
  IF v_tgtype IS NULL THEN RAISE EXCEPTION 'G-KAPI: trg_audit_immutable trigger YOK'; END IF;
  -- BEFORE=2, UPDATE=16, DELETE=8 bit'leri set olmalı
  IF (v_tgtype & 2) = 0 OR (v_tgtype & 16) = 0 OR (v_tgtype & 8) = 0 THEN
    RAISE EXCEPTION 'G-KAPI: audit trigger BEFORE UPDATE OR DELETE için kurulu değil (tgtype=%)', v_tgtype; END IF;

  -- audit_log: UPDATE/DELETE/ALL politikası OLMAMALI (yalnız SELECT + INSERT)
  SELECT count(*) INTO v_int FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'audit_log' AND p.polcmd IN ('w','d','*');
  IF v_int > 0 THEN RAISE EXCEPTION 'G-KAPI: audit_log''da UPDATE/DELETE/ALL politikası var (append-only ihlali)'; END IF;

  -- audit_log: PUBLIC/authenticated/anon UPDATE/DELETE GRANT'ı OLMAMALI
  SELECT count(*) INTO v_int FROM information_schema.role_table_grants
    WHERE table_name = 'audit_log' AND privilege_type IN ('UPDATE','DELETE')
      AND grantee IN ('PUBLIC','authenticated','anon');
  IF v_int > 0 THEN RAISE EXCEPTION 'G-KAPI: audit_log UPDATE/DELETE PUBLIC/authenticated/anon''a GRANT edilmiş'; END IF;
  RAISE NOTICE '3) audit_log append-only (F6): trigger + INSERT-only policy + REVOKE ✓';

  -- 4) Ownership/ABAC RLS (go/no-go #5): consultant başkasının lead/deal'ini
  --    göremez. leads_ownership/deals_ownership RESTRICTIVE + owner_id +
  --    app_is_privileged referansı zorunlu. Permissive'e çevrilirse consultant
  --    tüm tenant lead'lerini görür → sızıntı; bu kontrol onu yakalar.
  FOR v_txt IN SELECT unnest(ARRAY['leads','deals']) LOOP
    SELECT p.polpermissive, pg_get_expr(p.polqual, p.polrelid)
      INTO v_bool, v_expr
      FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
     WHERE c.relname = v_txt AND p.polname = v_txt || '_ownership';
    IF v_bool IS NULL THEN RAISE EXCEPTION 'G-KAPI: %_ownership politikası YOK', v_txt; END IF;
    IF v_bool <> false THEN RAISE EXCEPTION 'G-KAPI: %_ownership PERMISSIVE olmuş (RESTRICTIVE olmalı)', v_txt; END IF;
    IF v_expr !~ 'owner_id' OR v_expr !~ 'app_is_privileged' THEN
      RAISE EXCEPTION 'G-KAPI: %_ownership sahiplik/ayrıcalık kontrolünü kaybetmiş', v_txt; END IF;
  END LOOP;
  RAISE NOTICE '4) Ownership RLS (go/no-go #5): leads/deals RESTRICTIVE + owner/privileged ✓';

  RAISE NOTICE '=== TÜM GÜVENLİK KAPILARI GEÇTİ ===';
END $$;
