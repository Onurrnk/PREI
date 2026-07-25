-- =====================================================================
-- 003a | Denetim konsolu — aktör bazlı filtreleme için indeksler.
--
-- Mevcut indeks (idx_audit_entity) varlık odaklıdır; denetim konsolu
-- AKTÖR ve ZAMAN üzerinden filtreliyor. audit_log ve events birleşik
-- sorgulanıyor, ikisine de indeks gerekli.
-- =====================================================================

BEGIN;

-- "Bu kullanıcı ne yaptı?" — en sık sorgu.
CREATE INDEX IF NOT EXISTS idx_audit_actor_time
  ON audit_log (tenant_id, actor_id, occurred_at DESC);

-- Filtresiz akış ve tarih aralığı taraması.
CREATE INDEX IF NOT EXISTS idx_audit_time
  ON audit_log (tenant_id, occurred_at DESC);

-- events tarafı: aynı iki erişim deseni.
CREATE INDEX IF NOT EXISTS idx_events_actor_time
  ON events (tenant_id, created_by, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_time
  ON events (tenant_id, occurred_at DESC);

-- Tek kaydın geçmişi ("bu yatırımcının profilinde ne oldu?").
CREATE INDEX IF NOT EXISTS idx_events_aggregate
  ON events (tenant_id, aggregate_id, occurred_at DESC);

COMMIT;
