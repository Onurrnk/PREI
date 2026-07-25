-- =====================================================================
-- 002x | comm_channel: Instagram ve Messenger DM kanalları
--
-- Eylül artık Instagram/Facebook DM'lerine de cevap veriyor; gelen ve
-- giden mesajlar communications tablosuna aynı Telegram/WhatsApp gibi
-- yazılıyor. Enum'da bu iki değer olmadığı için INSERT reddediliyordu.
--
-- ADD VALUE IF NOT EXISTS: tekrar çalıştırılabilir (idempotent).
-- Not: ALTER TYPE ... ADD VALUE transaction bloğu içinde çalıştırılamaz,
-- bu yüzden dosyada BEGIN/COMMIT YOKTUR — psql'e doğrudan verilmelidir.
-- =====================================================================

ALTER TYPE comm_channel ADD VALUE IF NOT EXISTS 'instagram';
ALTER TYPE comm_channel ADD VALUE IF NOT EXISTS 'facebook';
