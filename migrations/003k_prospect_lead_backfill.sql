-- =====================================================================
-- 003k | Lead'i olmayan adaylara pipeline kaydı aç.
--
-- SORUN: Müşteriler dizini yalnız lifecycle_stage='customer' gösterir,
-- Adaylar ekranı leads tablosundan beslenir. Lead'i olmayan bir aday
-- HİÇBİR listede görünmüyordu. Canlıda 19 Temmuz'da "Referans" kaynağıyla
-- elle eklenen gerçek bir kişi 10 gün boyunca kayıptı.
--
-- Kod tarafı prospect-lead.ts ile kapatıldı (elle kayıt + CSV aktarımı).
-- Bu migration halihazırda kayıp olanları görünür kılar.
--
-- Aşama TAHMİN EDİLMEZ: status='new' — "geldi, henüz işlenmedi".
-- created_by: kişiyi kim eklediyse o; yoksa tenant'ın en eski aktif
-- kullanıcısı (NOT NULL kolon, boş bırakılamaz). public.users'ta rol
-- kolonu yoktur — rol ayrı taşınır, o yüzden burada rol filtresi yok.
-- =====================================================================
BEGIN;

INSERT INTO leads (tenant_id, contact_id, status, metadata, created_by, updated_by)
SELECT c.tenant_id,
       c.id,
       'new',
       jsonb_build_object('created_via', 'backfill_003k'),
       COALESCE(c.created_by, u.id),
       COALESCE(c.created_by, u.id)
  FROM contacts c
  LEFT JOIN LATERAL (
    SELECT id FROM public.users
     WHERE tenant_id = c.tenant_id AND is_active AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1
  ) u ON true
 WHERE c.deleted_at IS NULL
   AND c.merged_into_id IS NULL
   AND c.lifecycle_stage <> 'customer'
   AND COALESCE(c.created_by, u.id) IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM leads l WHERE l.contact_id = c.id AND l.deleted_at IS NULL
   );

COMMIT;
