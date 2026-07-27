-- =====================================================================
-- 003h | Kişi yaşam evresi: Aday (prospect) vs Müşteri (customer)
--
-- Sorun: Müşteriler listesi FROM contacts ile TÜM kişileri gösteriyordu;
-- Adaylar pipeline'ı dönüşmüş lead'leri de taşıyordu. Aday ve müşteri iç
-- içeydi. Bu kolon iki listeyi net ayırır:
--   · Müşteriler  = lifecycle_stage = 'customer'
--   · Adaylar     = aktif lead'ler (converted/lost hariç), kişisi prospect
--
-- Geçiş: "Müşteriye çevir" aksiyonu prospect→customer yapar ve açık
-- lead'leri converted'a çeker; bir deal 'won' olunca da otomatik customer.
-- =====================================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'prospect';

-- Yalnız iki değer: yanlış yazımı DB düzeyinde engelle.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_lifecycle_stage_chk'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_lifecycle_stage_chk
      CHECK (lifecycle_stage IN ('prospect', 'customer'));
  END IF;
END $$;

-- Geçmiş kayıt backfill: gerçekten dönüşmüş olanları 'customer' yap.
-- Sinyal: kazanılmış anlaşma (deals.status='won') VEYA converted lead.
-- Diğer herkes 'prospect' (kolon varsayılanı) kalır.
UPDATE contacts c SET lifecycle_stage = 'customer'
 WHERE c.deleted_at IS NULL
   AND c.lifecycle_stage <> 'customer'
   AND (
     EXISTS (
       SELECT 1 FROM leads l JOIN deals d ON d.lead_id = l.id
        WHERE l.contact_id = c.id AND d.status = 'won' AND d.deleted_at IS NULL
     )
     OR EXISTS (
       SELECT 1 FROM leads l
        WHERE l.contact_id = c.id AND l.status = 'converted' AND l.deleted_at IS NULL
     )
   );

-- Liste filtreleri lifecycle_stage üzerinden çalışacağı için index.
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle
  ON contacts (tenant_id, lifecycle_stage)
  WHERE deleted_at IS NULL;
