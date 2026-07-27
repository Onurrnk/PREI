-- =====================================================================
-- 003i | Deal 'won' → kişi otomatik Müşteri (003h tamamlayıcısı)
--
-- Elle "Müşteriye çevir" düğmesine EK: bir anlaşma kazanılınca (deals.status
-- = 'won') o anlaşmanın kişisi kendiliğinden 'customer' olur. Uygulamada
-- şu an deal-yazan bir akış yok; kural DB katmanında durursa hangi yolla
-- yazılırsa yazılsın (gelecekteki özellik, elle SQL, içe aktarım) tetiklenir.
--
-- Zincir: deals.lead_id → leads.contact_id → contacts.
-- =====================================================================

CREATE OR REPLACE FUNCTION prei_deal_won_to_customer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'won' THEN
    UPDATE contacts c
       SET lifecycle_stage = 'customer', updated_at = now()
      FROM leads l
     WHERE l.id = NEW.lead_id
       AND c.id = l.contact_id
       AND c.lifecycle_stage <> 'customer'
       AND c.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_won_to_customer ON deals;

-- INSERT ve status UPDATE'inde çalışır; yalnız 'won'a geçişte iş yapar
-- (fonksiyon içinde kontrol). AFTER: ana yazma tamamlandıktan sonra.
CREATE TRIGGER trg_deal_won_to_customer
  AFTER INSERT OR UPDATE OF status ON deals
  FOR EACH ROW
  EXECUTE FUNCTION prei_deal_won_to_customer();
