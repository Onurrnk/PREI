-- =====================================================================
-- PREI | Smart Suites — Migration 002c: Events outbox + FX + Views
-- Kapsam:
--   * events (B-6 / Blueprint ADR-004): transactional outbox. NestJS
--     mutasyonları Faz 0'dan itibaren buraya event yazar; Faz 6 KPI
--     read-model'leri ve audit beslemesi buradan geriye dönük üretir.
--   * fx_rates (B-7): günlük kur, EUR baz. nil-path (F7): tarihte kur
--     yoksa son bilinen kur + bayatlık göstergesi.
--   * 3 view (Faz 4 otomasyonları): upcoming_birthdays, overdue_payments,
--     contract_renewal_alerts. security_invoker=true → sorgulayanın RLS'i geçerli.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EVENTS — transactional outbox (append-only akım)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id),
    aggregate_type text NOT NULL,          -- 'lead','deal','contact','contract',...
    aggregate_id   uuid NOT NULL,
    event_type     text NOT NULL,          -- 'lead.created','lead.stage_changed',...
    payload        jsonb NOT NULL DEFAULT '{}',
    correlation_id uuid,                    -- request_id ile audit_log'a bağlanır (F10)
    occurred_at    timestamptz NOT NULL DEFAULT now(),
    processed_at   timestamptz,            -- NULL = henüz işlenmedi (projeksiyon/relay)
    created_by     uuid
);
-- Relay/projeksiyon kuyruğu: işlenmemiş event'ler zaman sırasıyla
CREATE INDEX IF NOT EXISTS idx_events_unprocessed
    ON events (tenant_id, occurred_at)
    WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_aggregate
    ON events (tenant_id, aggregate_type, aggregate_id, occurred_at DESC);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_tenant ON events;
CREATE POLICY events_tenant ON events FOR ALL
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());

-- ---------------------------------------------------------------------
-- 2. FX_RATES — günlük kur, EUR baz (B-7). Kayıt orijinal birimde saklanır;
--    rapor/KPI katmanı EUR'a normalize eder.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_rates (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency  text NOT NULL DEFAULT 'EUR',
    quote_currency text NOT NULL,          -- TRY, AED, GBP, THB, USD...
    rate           numeric(18,8) NOT NULL, -- 1 EUR = rate * quote_currency
    rate_date      date NOT NULL,
    source         text,                   -- 'ecb','n8n_sync',...
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (base_currency, quote_currency, rate_date)
);
CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup
    ON fx_rates (quote_currency, rate_date DESC);

-- Global referans (tenant-bağımsız): RLS aç, okuma serbest, yazma service_role
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fx_rates_read ON fx_rates;
CREATE POLICY fx_rates_read ON fx_rates FOR SELECT USING (true);

-- nil-path helper (F7): verilen para birimini EUR'a çevirir.
-- Tarihte kur yoksa SON BİLİNEN kuru kullanır; kaç gün bayat olduğunu döndürür.
-- days_stale >= 3 → E1 paneli alarm verir (raporlama katmanı kontrol eder).
CREATE OR REPLACE FUNCTION fx_to_eur(p_amount numeric, p_currency text, p_on_date date DEFAULT current_date)
  RETURNS TABLE(amount_eur numeric, rate_used numeric, effective_date date, days_stale integer)
  LANGUAGE plpgsql STABLE SET search_path = public, pg_temp
AS $$
DECLARE
  v_rate numeric; v_date date;
BEGIN
  IF p_currency IS NULL OR upper(p_currency) = 'EUR' THEN
    RETURN QUERY SELECT p_amount, 1::numeric, p_on_date, 0; RETURN;
  END IF;
  SELECT f.rate, f.rate_date INTO v_rate, v_date
  FROM fx_rates f
  WHERE f.base_currency = 'EUR' AND f.quote_currency = upper(p_currency)
    AND f.rate_date <= p_on_date
  ORDER BY f.rate_date DESC
  LIMIT 1;
  IF v_rate IS NULL THEN
    -- Hiç kur yok: NULL EUR + -1 bayatlık işareti (rapor "≈?" gösterir, sessizce yanlış toplamaz)
    RETURN QUERY SELECT NULL::numeric, NULL::numeric, NULL::date, -1; RETURN;
  END IF;
  RETURN QUERY SELECT round(p_amount / v_rate, 2), v_rate, v_date, (p_on_date - v_date)::integer;
END;
$$;
COMMENT ON FUNCTION fx_to_eur IS 'F7 nil-path: EUR''a çevirir, son bilinen kuru kullanır, days_stale döndürür (>=3 → E1 alarmı; -1 → hiç kur yok).';

-- ---------------------------------------------------------------------
-- 3. VIEW'lar (security_invoker → sorgulayanın RLS'i geçerli)
-- ---------------------------------------------------------------------

-- 3.1 Yaklaşan doğum günleri (Faz 4: 09:00 doğum günü otomasyonu)
CREATE OR REPLACE VIEW upcoming_birthdays
  WITH (security_invoker = true) AS
SELECT
  c.id AS contact_id,
  c.tenant_id,
  c.first_name,
  c.last_name,
  c.birthdate,
  c.whatsapp,
  c.is_pm_client,
  -- bu yılki (veya geçtiyse gelecek yılki) doğum gününe kalan gün
  ( (date_trunc('year', current_date)
      + make_interval(months => extract(month FROM c.birthdate)::int - 1,
                      days   => extract(day   FROM c.birthdate)::int - 1))::date
    + CASE WHEN (extract(month FROM c.birthdate), extract(day FROM c.birthdate))
                < (extract(month FROM current_date), extract(day FROM current_date))
           THEN interval '1 year' ELSE interval '0' END )::date AS next_birthday,
  ( ( (date_trunc('year', current_date)
        + make_interval(months => extract(month FROM c.birthdate)::int - 1,
                        days   => extract(day   FROM c.birthdate)::int - 1))::date
      + CASE WHEN (extract(month FROM c.birthdate), extract(day FROM c.birthdate))
                  < (extract(month FROM current_date), extract(day FROM current_date))
             THEN interval '1 year' ELSE interval '0' END )::date - current_date ) AS days_until
FROM contacts c
WHERE c.deleted_at IS NULL AND c.birthdate IS NOT NULL;

-- 3.2 Gecikmiş ödemeler (Faz 4: 08:00 sözleşme/ödeme taraması)
CREATE OR REPLACE VIEW overdue_payments
  WITH (security_invoker = true) AS
SELECT
  f.id AS financial_id,
  f.tenant_id,
  f.deal_id,
  f.contact_id,
  f.amount,
  f.currency,
  f.due_date,
  (current_date - f.due_date) AS days_overdue
FROM financials f
WHERE f.deleted_at IS NULL
  AND f.status = 'pending'
  AND f.due_date IS NOT NULL
  AND f.due_date < current_date;

-- 3.3 Sözleşme yenileme uyarıları (Faz 4: koruma penceresi takibi)
CREATE OR REPLACE VIEW contract_renewal_alerts
  WITH (security_invoker = true) AS
SELECT
  ct.id AS contract_id,
  ct.tenant_id,
  ct.deal_id,
  ct.contact_id,
  ct.property_id,
  ct.contract_type,
  ct.renewal_date,
  ct.protection_window_days,
  (ct.renewal_date - current_date) AS days_until_renewal
FROM contracts ct
WHERE ct.deleted_at IS NULL
  AND ct.status = 'active'
  AND ct.renewal_date IS NOT NULL;
