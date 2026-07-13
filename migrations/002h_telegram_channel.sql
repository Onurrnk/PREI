-- =====================================================================
-- PREI | 002h — comm_channel enum'a 'telegram' eklenir.
-- Onur, WhatsApp/Meta onayı beklenirken Eylül (AI danışman) akışını
-- Telegram üzerinden test etmek istedi (2026-07-13). Aynı ingest/outbound
-- kod yolu (agent.service.ts) channel parametreli hale getirildi; şema
-- tarafında tek eksik buydu. ADD VALUE bu migration'ın kendi transaction'ı
-- İÇİNDE aynı transaction'da KULLANILAMAZ (Postgres kısıtı) — bu yüzden
-- sonraki INSERT'ler ayrı bir bağlantı/transaction'da olmalı (apply
-- script'i zaten öyle çalışıyor, ayrı bağlantılar kullanıyor).
-- =====================================================================

ALTER TYPE comm_channel ADD VALUE IF NOT EXISTS 'telegram';
