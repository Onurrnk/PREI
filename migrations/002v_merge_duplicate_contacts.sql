-- =====================================================================
-- ProDuality / PREI — mükerrer kişi birleştirme + uydurma telefon temizliği
-- 2026-07-24. Kök neden (Telegram chat id'sinin telefon alanına yazılması)
-- kodda düzeltildi (commit 4880bb6); bu betik geriye dönük veriyi temizler.
--
-- Kudret: 19b411da (mükerrer) -> 7afacd53 (asıl)   lead d0a629d1 -> 4f5082a9
-- Onur  : a59ce100 (mükerrer) -> 94d8fff4 (asıl)   lead 9ec307f5 -> 12341e7a
-- Duygu : ca3d3b26 uydurma telefon (+6374496062) temizlenir
-- Tüm Telegram kişileri: chat id metadata.channel_handles'a taşınır
-- =====================================================================
BEGIN;

-- Kimlikler (önekle çözülür; bu veri setinde önekler tekil)
CREATE TEMP TABLE m AS
SELECT
  (SELECT id FROM contacts WHERE id::text LIKE '7afacd53%') AS kudret_asil,
  (SELECT id FROM contacts WHERE id::text LIKE '19b411da%') AS kudret_dup,
  (SELECT id FROM leads    WHERE id::text LIKE '4f5082a9%') AS kudret_lead_asil,
  (SELECT id FROM leads    WHERE id::text LIKE 'd0a629d1%') AS kudret_lead_dup,
  (SELECT id FROM contacts WHERE id::text LIKE '94d8fff4%') AS onur_asil,
  (SELECT id FROM contacts WHERE id::text LIKE 'a59ce100%') AS onur_dup,
  (SELECT id FROM leads    WHERE id::text LIKE '12341e7a%') AS onur_lead_asil,
  (SELECT id FROM leads    WHERE id::text LIKE '9ec307f5%') AS onur_lead_dup,
  (SELECT id FROM contacts WHERE id::text LIKE 'ca3d3b26%') AS duygu;

-- Hiçbiri NULL olmamalı; olursa transaction burada patlar (güvenlik kapısı)
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM m;
  IF r.kudret_asil IS NULL OR r.kudret_dup IS NULL OR r.kudret_lead_asil IS NULL
     OR r.kudret_lead_dup IS NULL OR r.onur_asil IS NULL OR r.onur_dup IS NULL
     OR r.onur_lead_asil IS NULL OR r.onur_lead_dup IS NULL OR r.duygu IS NULL THEN
    RAISE EXCEPTION 'Kimliklerden biri çözülemedi — birleştirme iptal';
  END IF;
END $$;

-- ---------- YEDEK ----------
DROP TABLE IF EXISTS merge_backup_20260724;
CREATE TABLE merge_backup_20260724 (kind text, snapshot jsonb, taken_at timestamptz DEFAULT now());
INSERT INTO merge_backup_20260724 (kind, snapshot)
SELECT 'contact', to_jsonb(c) FROM contacts c, m
 WHERE c.id IN (m.kudret_asil, m.kudret_dup, m.onur_asil, m.onur_dup, m.duygu);
INSERT INTO merge_backup_20260724 (kind, snapshot)
SELECT 'lead', to_jsonb(l) FROM leads l, m
 WHERE l.id IN (m.kudret_lead_asil, m.kudret_lead_dup, m.onur_lead_asil, m.onur_lead_dup);
INSERT INTO merge_backup_20260724 (kind, snapshot)
SELECT 'communication', to_jsonb(x) FROM communications x, m
 WHERE x.contact_id IN (m.kudret_dup, m.onur_dup);
INSERT INTO merge_backup_20260724 (kind, snapshot)
SELECT 'lead_score', to_jsonb(x) FROM lead_scores x, m
 WHERE x.lead_id IN (m.kudret_lead_dup, m.onur_lead_dup);
INSERT INTO merge_backup_20260724 (kind, snapshot)
SELECT 'meeting_note', to_jsonb(x) FROM meeting_notes x, m
 WHERE x.contact_id IN (m.kudret_dup, m.onur_dup) OR x.lead_id IN (m.kudret_lead_dup, m.onur_lead_dup);

-- NOT: lead_scores append-only (immutable) bir audit tablosudur; skor GEÇMİŞİ
-- mükerrer lead'de bırakılır. Güncel skor asıl lead'e GREATEST ile taşınır.
-- ---------- 1) KUDRET ----------
UPDATE communications x SET contact_id = m.kudret_asil, lead_id = m.kudret_lead_asil
  FROM m WHERE x.contact_id = m.kudret_dup;
UPDATE meeting_notes x SET contact_id = m.kudret_asil, lead_id = m.kudret_lead_asil
  FROM m WHERE x.contact_id = m.kudret_dup OR x.lead_id = m.kudret_lead_dup;
-- e-posta mükerrer kayıtta duruyordu; asıl kayda taşı + soyadı düzelt
UPDATE contacts c SET email = COALESCE(c.email, (SELECT email FROM contacts d, m WHERE d.id = m.kudret_dup)),
                      last_name = 'Kalyoncuoğlu', updated_at = now()
  FROM m WHERE c.id = m.kudret_asil;
UPDATE leads l SET score = GREATEST(COALESCE(l.score,0), (SELECT COALESCE(score,0) FROM leads d, m WHERE d.id = m.kudret_lead_dup)), updated_at = now()
  FROM m WHERE l.id = m.kudret_lead_asil;
UPDATE leads l SET deleted_at = now() FROM m WHERE l.id = m.kudret_lead_dup;
UPDATE contacts c SET merged_into_id = m.kudret_asil, email = NULL, updated_at = now()
  FROM m WHERE c.id = m.kudret_dup;

-- ---------- 2) ONUR ----------
UPDATE communications x SET contact_id = m.onur_asil, lead_id = m.onur_lead_asil
  FROM m WHERE x.contact_id = m.onur_dup;
UPDATE meeting_notes x SET contact_id = m.onur_asil, lead_id = m.onur_lead_asil
  FROM m WHERE x.contact_id = m.onur_dup OR x.lead_id = m.onur_lead_dup;
UPDATE leads l SET deleted_at = now() FROM m WHERE l.id = m.onur_lead_dup;
UPDATE contacts c SET merged_into_id = m.onur_asil, updated_at = now()
  FROM m WHERE c.id = m.onur_dup;

-- ---------- 3) DUYGU: uydurma telefon temizliği ----------
UPDATE contacts c SET phone = NULL, whatsapp = NULL, updated_at = now()
  FROM m WHERE c.id = m.duygu;

-- ---------- 4) Telegram chat id'lerini kalıcı kimlik çapasına taşı ----------
UPDATE contacts c
   SET metadata = COALESCE(c.metadata, '{}'::jsonb)
       || jsonb_build_object('channel_handles',
            COALESCE(c.metadata->'channel_handles', '{}'::jsonb)
            || jsonb_build_object('telegram', regexp_replace(s.external_session_id, '^tg-', '')))
  FROM conversation_sessions s
 WHERE s.contact_id = c.id AND s.channel = 'telegram'
   AND s.external_session_id IS NOT NULL
   AND c.metadata->'channel_handles'->>'telegram' IS DISTINCT FROM regexp_replace(s.external_session_id, '^tg-', '');

COMMIT;
