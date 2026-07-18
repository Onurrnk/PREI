-- =====================================================================
-- PREI | Migration 002i — lead_status enum'una 'frozen' değeri
-- Onur talebi (2026-07-18): welcome takip maili gönderildikten sonra da
-- yanıt vermeyen lead'ler PREI'de "Donduruldu" statüsüne çekilsin
-- (günlük n8n Welcome Takip akışının freeze-stale adımı yazar).
-- Not: enum'a değer eklemek geri alınamaz (Postgres enum değeri düşürmeyi
-- desteklemez) — down gerektiğinde status'ü 'nurturing'e taşımak yeterli.
-- Konvansiyon: apply_migration kendi transaction'ını sarar → BEGIN/COMMIT YOK.
-- =====================================================================

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'frozen';
