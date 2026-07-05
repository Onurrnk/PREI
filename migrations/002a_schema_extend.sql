-- =====================================================================
-- PREI | Smart Suites — Migration 002a: Şema Genişletme
-- Kapsam: markets lookup (K-6), contacts/leads/properties alan eklemeleri,
--         yeni tablolar (conversation_sessions, financials, meeting_notes,
--         contracts, lead_attributions).
-- RLS onarımı 002b'de, events outbox + fx_rates 002c'de.
-- apply_migration kendi transaction'ını sarar; BEGIN/COMMIT YOK.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MARKETS lookup (K-6): çok ülkeli, genişletilebilir. Global referans
--    (tenant-bağımsız). Yeni ülke = 1 INSERT, migration yok.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS markets (
    code       text PRIMARY KEY,             -- ISO-benzeri: 'TR','AE','ES','GB','TH','DE'
    name       text NOT NULL,
    currency   text NOT NULL,                -- raporlama EUR baza normalize edilir (fx_rates, 002c)
    timezone   text NOT NULL,
    is_active  boolean NOT NULL DEFAULT true, -- aktif satış pazarı mı
    sort_order integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE markets IS 'K-6: çok pazarlı model. Aktif=TR/AE/ES/GB, planlı=TH/DE. Master Prompt CHECK(country IN...) kısıtı yerine bu tablo kullanılır.';

INSERT INTO markets (code, name, currency, timezone, is_active, sort_order) VALUES
    ('TR','Türkiye','TRY','Europe/Istanbul',   true,  10),
    ('AE','BAE (Dubai)','AED','Asia/Dubai',     true,  20),
    ('ES','İspanya','EUR','Europe/Madrid',      true,  30),
    ('GB','İngiltere','GBP','Europe/London',    true,  40),
    ('TH','Tayland','THB','Asia/Bangkok',       false, 50),
    ('DE','Almanya','EUR','Europe/Berlin',      false, 60)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. CONTACTS alan eklemeleri (§3: kişi kartı zenginleştirme)
-- ---------------------------------------------------------------------
ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS birthdate            date,
    ADD COLUMN IF NOT EXISTS nationality          text,
    ADD COLUMN IF NOT EXISTS is_pm_client         boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_subscribed_reports boolean NOT NULL DEFAULT false;
-- Not: whatsapp + preferred_lang zaten 001'de var (whatsapp_number/language olarak tekrar eklenmez).

-- Doğum günü otomasyonu (Faz 4): ay-gün üzerinden yaklaşan doğum günü sorgusu
CREATE INDEX IF NOT EXISTS idx_contacts_birthday_md
    ON contacts (tenant_id, (extract(month FROM birthdate)), (extract(day FROM birthdate)))
    WHERE deleted_at IS NULL AND birthdate IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. LEADS alan eklemeleri (§3: Eylül qualification + Calendly + araştırma)
--    Not: mevcut `score` = qualification_score olarak kullanılır (0-100).
-- ---------------------------------------------------------------------
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS qualification_data jsonb NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS calendly_booked    boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS calendly_event_at  timestamptz,
    ADD COLUMN IF NOT EXISTS research_data      jsonb NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS target_market_code text REFERENCES markets(code),
    ADD COLUMN IF NOT EXISTS investment_purpose text,
    ADD COLUMN IF NOT EXISTS timeline           text;
COMMENT ON COLUMN leads.qualification_data IS 'Eylül''ün skorlama ayrıntısı (kriter kırılımı). score kolonu = 0-100 qualification skoru.';
COMMENT ON COLUMN leads.target_market_code IS 'K-6: lead''in hedef satış pazarı (markets FK).';

CREATE INDEX IF NOT EXISTS idx_leads_target_market ON leads (tenant_id, target_market_code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 4. PROPERTIES alan eklemeleri (§3: PM + geliştirici + pazar)
-- ---------------------------------------------------------------------
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS pm_fee_gross_pct numeric(5,2),
    ADD COLUMN IF NOT EXISTS pm_fee_net_pct   numeric(5,2),
    ADD COLUMN IF NOT EXISTS monthly_rent_eur numeric(15,2),
    ADD COLUMN IF NOT EXISTS developer_id     uuid REFERENCES organizations(id),
    ADD COLUMN IF NOT EXISTS market_code      text REFERENCES markets(code);

CREATE INDEX IF NOT EXISTS idx_properties_developer ON properties (tenant_id, developer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_market ON properties (tenant_id, market_code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 5. CONVERSATION_SESSIONS (Faz 2: Eylül WhatsApp oturumları)
--    Agent yazar → created_by nullable (servis-principal API'den gelir).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    contact_id          uuid REFERENCES contacts(id),
    lead_id             uuid REFERENCES leads(id) ON DELETE SET NULL,
    channel             comm_channel NOT NULL DEFAULT 'whatsapp',
    external_session_id text,                 -- WhatsApp/Cloud API oturum kimliği
    status              text NOT NULL DEFAULT 'open',  -- open | handover | closed
    handover_at         timestamptz,          -- insan devrine geçildiği an (OV-5)
    started_at          timestamptz NOT NULL DEFAULT now(),
    ended_at            timestamptz,
    message_count       integer NOT NULL DEFAULT 0,
    metadata            jsonb NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid
);
CREATE INDEX IF NOT EXISTS idx_conv_sessions_contact ON conversation_sessions (tenant_id, contact_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_sessions_lead ON conversation_sessions (tenant_id, lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_sessions_external
    ON conversation_sessions (tenant_id, channel, external_session_id)
    WHERE external_session_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6. FINANCIALS (Faz 1: Financials modülü gerçek veri kaynağı)
--    Komisyon gizliliği (K-4): is_confidential=true satırlar 002b RLS'te
--    yalnız super_admin + finance_manager'a açılır.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financials (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id),
    deal_id        uuid REFERENCES deals(id),
    contact_id     uuid REFERENCES contacts(id),
    type           text NOT NULL,            -- 'income' | 'commission' | 'expense' | 'refund'
    is_confidential boolean NOT NULL DEFAULT false,  -- CBI komisyon dağılımı
    amount         numeric(15,2) NOT NULL,
    currency       text NOT NULL DEFAULT 'EUR',
    status         text NOT NULL DEFAULT 'pending',  -- pending | paid | overdue | cancelled
    due_date       date,
    paid_at        timestamptz,
    description    text,
    metadata       jsonb NOT NULL DEFAULT '{}',
    version        integer NOT NULL DEFAULT 1,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    created_by     uuid,
    updated_by     uuid,
    deleted_at     timestamptz
);
COMMENT ON COLUMN financials.is_confidential IS 'K-4: CBI komisyon dağılımı. 002b RLS yalnız super_admin+finance_manager''a açar; AI servis-principal''ları göremez.';
CREATE INDEX IF NOT EXISTS idx_financials_deal ON financials (tenant_id, deal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_financials_status_due ON financials (tenant_id, status, due_date) WHERE deleted_at IS NULL;
-- Gecikmiş ödeme taraması (Faz 4): overdue_payments view'ının hızlı yolu
CREATE INDEX IF NOT EXISTS idx_financials_overdue ON financials (tenant_id, due_date)
    WHERE deleted_at IS NULL AND status = 'pending';

-- ---------------------------------------------------------------------
-- 7. MEETING_NOTES (Faz 3: toplantı notu hattı — metin/ses/PDF extraction)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_notes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id),
    lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,
    contact_id   uuid REFERENCES contacts(id),
    deal_id      uuid REFERENCES deals(id),
    source_type  text NOT NULL DEFAULT 'text',  -- text | audio | pdf
    raw_content  text,
    summary      text,
    extracted    jsonb NOT NULL DEFAULT '{}',    -- GPT extraction (aksiyonlar, kararlar)
    meeting_at   timestamptz,
    metadata     jsonb NOT NULL DEFAULT '{}',
    version      integer NOT NULL DEFAULT 1,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    created_by   uuid,
    updated_by   uuid,
    deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_lead ON meeting_notes (tenant_id, lead_id, meeting_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_notes_contact ON meeting_notes (tenant_id, contact_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 8. CONTRACTS (Faz 4: sözleşme lifecycle + koruma pencereleri)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES tenants(id),
    deal_id                uuid REFERENCES deals(id),
    contact_id             uuid REFERENCES contacts(id),
    property_id            uuid REFERENCES properties(id),
    contract_type          text NOT NULL,       -- 'sale' | 'rental' | 'pm' | 'reservation'
    status                 text NOT NULL DEFAULT 'draft',  -- draft|active|expired|terminated|renewed
    start_date             date,
    end_date               date,
    renewal_date           date,                -- contract_renewal_alerts view bunu tarar
    protection_window_days integer,             -- koruma penceresi (komisyon koruması)
    amount                 numeric(15,2),
    currency               text NOT NULL DEFAULT 'EUR',
    document_url           text,                -- Supabase Storage signed URL kaynağı
    metadata               jsonb NOT NULL DEFAULT '{}',
    version                integer NOT NULL DEFAULT 1,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    created_by             uuid,
    updated_by             uuid,
    deleted_at             timestamptz,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_contracts_deal ON contracts (tenant_id, deal_id) WHERE deleted_at IS NULL;
-- Yenileme uyarısı taraması (Faz 4): günlük 08:00 cron
CREATE INDEX IF NOT EXISTS idx_contracts_renewal ON contracts (tenant_id, renewal_date)
    WHERE deleted_at IS NULL AND status = 'active' AND renewal_date IS NOT NULL;

-- ---------------------------------------------------------------------
-- 9. LEAD_ATTRIBUTIONS (Faz 2'den itibaren CTWA atıf — K-5 temeli)
--    Faz 2 webhook buraya yazar; Faz 5 ROI hesabının ham verisi.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_attributions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id),
    lead_id      uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    source_type  text NOT NULL,               -- 'ad' | 'organic' | 'referral'
    ad_id        text,
    adset_id     text,
    campaign_id  text,
    headline     text,
    referral_raw jsonb NOT NULL DEFAULT '{}',  -- CTWA referral payload (ham)
    captured_at  timestamptz NOT NULL DEFAULT now(),
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   uuid
);
CREATE INDEX IF NOT EXISTS idx_lead_attr_lead ON lead_attributions (tenant_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_attr_campaign ON lead_attributions (tenant_id, campaign_id) WHERE campaign_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 10. updated_at trigger'ları (yeni tablolar için — 001'deki set_updated_at)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['conversation_sessions','financials','meeting_notes','contracts']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || t || '_updated') THEN
            EXECUTE format(
              'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s
               FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
        END IF;
    END LOOP;
END $$;
