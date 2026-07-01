-- =====================================================================
-- PREI | Smart Suites — CRM Core Schema
-- Migration: 001_crm_core
-- Target: PostgreSQL 15+ (Supabase-compatible)
-- Scope: Lead & CRM core for ProDuality (single-tenant operation,
--        multi-tenant SEAM preserved; record-level ownership via RBAC/ABAC)
-- =====================================================================
-- Conventions enforced in this migration:
--   * Every business table carries the mandatory envelope:
--       id, tenant_id, created_at, updated_at, created_by, updated_by
--   * Where applicable: deleted_at (soft delete), version (optimistic lock),
--     status, metadata (jsonb)
--   * No hard deletes by default (soft-delete via deleted_at)
--   * tenant_id leads every composite index on tenant-scoped tables
--   * Naming: snake_case, plural tables, *_id FKs
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy search on names/phones
-- NOTE: Prefer UUID v7 for index locality when available. Until uuidv7()
-- is standard in your PG build, gen_random_uuid() (v4) is used for
-- portability. Swapping the default later does not change relationships.

-- ---------------------------------------------------------------------
-- 1. Enumerated types (controlled vocabularies)
--    Rationale: enums keep referential simple values normalized & fast.
--    For values likely to change per-business (pipeline stages, sources)
--    we use LOOKUP TABLES instead so admins can edit without migrations.
-- ---------------------------------------------------------------------
CREATE TYPE lead_status         AS ENUM ('new','contacted','qualified','unqualified','nurturing','converted','lost');
CREATE TYPE lead_interest_type  AS ENUM ('buy','rent','sell','invest');
CREATE TYPE property_type       AS ENUM ('apartment','villa','office','land','commercial','warehouse','other');
CREATE TYPE listing_status      AS ENUM ('available','reserved','under_contract','sold','rented','off_market');
CREATE TYPE deal_status         AS ENUM ('open','won','lost');
CREATE TYPE activity_type       AS ENUM ('call','meeting','email','whatsapp','sms','note','task','viewing');
CREATE TYPE activity_status     AS ENUM ('pending','completed','cancelled');
CREATE TYPE comm_channel        AS ENUM ('whatsapp','email','phone','sms');
CREATE TYPE comm_direction      AS ENUM ('inbound','outbound');
CREATE TYPE priority_level      AS ENUM ('low','medium','high','urgent');

-- =====================================================================
-- 2. PLATFORM CORE (minimal slice needed by CRM)
--    Full identity/RBAC lives in the Platform Core module; defined here
--    only to the extent the CRM foreign-keys into it.
-- =====================================================================

-- 2.1 Tenants — the multi-tenant seam. ProDuality operates a single row.
CREATE TABLE tenants (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    slug        text NOT NULL UNIQUE,
    status      text NOT NULL DEFAULT 'active',
    metadata    jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz
);
COMMENT ON TABLE tenants IS 'Multi-tenant seam. Single operational tenant today; column kept to enable future business-unit/brand isolation without re-architecture.';

-- 2.2 Users — app users (sales consultants, managers, admin).
-- In Supabase this can mirror auth.users (id = auth uid). Kept standalone
-- for portability; integrate by setting id = auth.uid() on insert.
CREATE TABLE users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    email       text NOT NULL,
    full_name   text NOT NULL,
    phone       text,
    is_active   boolean NOT NULL DEFAULT true,
    metadata    jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz
    -- uniqueness enforced via partial index (excludes soft-deleted rows)
);

-- 2.3 Roles & assignment (RBAC). Permissions themselves are evaluated at
-- the service layer + ABAC; this stores the coarse role grants.
CREATE TABLE roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    key         text NOT NULL,            -- 'super_admin','sales_consultant','team_lead','marketing_manager','finance_manager'
    name        text NOT NULL,
    description text,
    metadata    jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key)
);

CREATE TABLE user_roles (
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    user_id     uuid NOT NULL REFERENCES users(id),
    role_id     uuid NOT NULL REFERENCES roles(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid,
    PRIMARY KEY (user_id, role_id)
);
COMMENT ON TABLE user_roles IS 'A user may hold multiple roles. Effective permissions = union, evaluated at service layer.';

-- 2.4 Teams (for future Team Lead visibility scoping). Optional now.
CREATE TABLE teams (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    name        text NOT NULL,
    lead_user_id uuid REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz
);

CREATE TABLE team_members (
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    team_id     uuid NOT NULL REFERENCES teams(id),
    user_id     uuid NOT NULL REFERENCES users(id),
    PRIMARY KEY (team_id, user_id)
);

-- =====================================================================
-- 3. CRM REFERENCE / LOOKUP TABLES
--    Editable by admins at runtime → modeled as tables, not enums.
-- =====================================================================

-- 3.1 Lead sources (web form, Instagram, referral, sahibinden, walk-in...)
CREATE TABLE lead_sources (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    name        text NOT NULL,
    channel     text,                     -- 'web','social','portal','referral','offline'
    is_active   boolean NOT NULL DEFAULT true,
    metadata    jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

-- 3.2 Pipelines & stages (configurable). Supports multiple pipelines
-- (e.g. Sales pipeline vs Rental pipeline) each with ordered stages.
CREATE TABLE pipelines (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    name        text NOT NULL,
    is_default  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz
    -- uniqueness enforced via partial index (excludes soft-deleted rows)
);

CREATE TABLE pipeline_stages (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id),
    pipeline_id  uuid NOT NULL REFERENCES pipelines(id),
    name         text NOT NULL,
    sort_order   integer NOT NULL,
    is_won       boolean NOT NULL DEFAULT false,  -- terminal "won" stage
    is_lost      boolean NOT NULL DEFAULT false,  -- terminal "lost" stage
    probability  numeric(5,2) NOT NULL DEFAULT 0, -- weighted forecast %
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (pipeline_id, name),
    UNIQUE (pipeline_id, sort_order)
);

-- 3.3 Tags (free-form labeling across entities)
CREATE TABLE tags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    name        text NOT NULL,
    color       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

-- =====================================================================
-- 4. CRM CORE ENTITIES
-- =====================================================================

-- 4.1 Contacts — a person (lead's human identity). Separated from "lead"
-- because one person may generate multiple leads over time (re-engagement,
-- different properties). Relationship: contact 1..* leads.
CREATE TABLE contacts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),
    first_name    text NOT NULL,
    last_name     text,
    email         text,
    phone         text,                   -- E.164 recommended
    -- normalized_phone: digits-only, auto-derived, used as the dedup key
    normalized_phone text GENERATED ALWAYS AS (regexp_replace(coalesce(phone,''),'[^0-9]','','g')) STORED,
    whatsapp      text,
    preferred_lang text DEFAULT 'tr',
    -- KVKK / consent (required before automated WhatsApp/email outreach)
    marketing_consent boolean NOT NULL DEFAULT false,
    consent_source text,                  -- 'web_form','signature','verbal',...
    consent_at    timestamptz,
    -- contact deduplication: when this record is merged into another, point to survivor
    merged_into_id uuid REFERENCES contacts(id),
    notes         text,
    status        text NOT NULL DEFAULT 'active',
    metadata      jsonb NOT NULL DEFAULT '{}',
    version       integer NOT NULL DEFAULT 1,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid NOT NULL,
    updated_by    uuid NOT NULL,
    deleted_at    timestamptz
);
COMMENT ON TABLE contacts IS 'Person master record. One contact can have many leads (lifecycle re-engagement).';

-- 4.2 Organizations — optional B2B counterpart (developer, corporate buyer).
CREATE TABLE organizations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    name        text NOT NULL,
    org_type    text,                     -- 'developer','corporate','agency'
    phone       text,
    email       text,
    metadata    jsonb NOT NULL DEFAULT '{}',
    version     integer NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid NOT NULL,
    updated_by  uuid NOT NULL,
    deleted_at  timestamptz
);

-- 4.3 Properties / portfolio listings. The inventory leads are matched to.
CREATE TABLE properties (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    reference_code  text,                 -- internal portfolio code
    title           text NOT NULL,
    property_type   property_type NOT NULL,
    listing_status  listing_status NOT NULL DEFAULT 'available',
    -- location
    country         text DEFAULT 'TR',
    city            text,
    district        text,
    address         text,
    latitude        numeric(9,6),
    longitude       numeric(9,6),
    -- specs
    price           numeric(15,2),
    currency        text NOT NULL DEFAULT 'TRY',
    area_gross      numeric(10,2),        -- m2
    area_net        numeric(10,2),
    rooms           text,                 -- '3+1' style
    -- ownership of the listing within the firm
    listing_agent_id uuid REFERENCES users(id),
    description     text,
    metadata        jsonb NOT NULL DEFAULT '{}',
    version         integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid NOT NULL,
    updated_by      uuid NOT NULL,
    deleted_at      timestamptz
    -- uniqueness enforced via partial index (excludes soft-deleted rows)
);

-- 4.4 LEADS — the central CRM entity.
-- Ownership: owner_id = the responsible sales consultant (drives ABAC).
CREATE TABLE leads (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    contact_id      uuid NOT NULL REFERENCES contacts(id),
    organization_id uuid REFERENCES organizations(id),
    source_id       uuid REFERENCES lead_sources(id),
    owner_id        uuid REFERENCES users(id),    -- assigned consultant (ABAC key)
    team_id         uuid REFERENCES teams(id),

    -- LEAD-CENTRIC PIPELINE: the daily Kanban runs on the lead itself.
    -- status = coarse lifecycle vocabulary; stage_id = exact board position.
    pipeline_id     uuid REFERENCES pipelines(id),
    stage_id        uuid REFERENCES pipeline_stages(id),
    stage_changed_at timestamptz,

    status          lead_status NOT NULL DEFAULT 'new',
    interest_type   lead_interest_type NOT NULL DEFAULT 'buy',
    priority        priority_level NOT NULL DEFAULT 'medium',

    -- buyer/renter preferences (drives property matching & AI later)
    budget_min      numeric(15,2),
    budget_max      numeric(15,2),
    currency        text NOT NULL DEFAULT 'TRY',
    pref_property_type property_type,
    pref_city       text,
    pref_district   text,
    pref_rooms      text,

    -- qualification / scoring
    score           integer,             -- 0..100, set by rules/AI
    lost_reason     text,
    last_activity_at timestamptz,
    next_action_at  timestamptz,         -- drives follow-up automation

    notes           text,
    metadata        jsonb NOT NULL DEFAULT '{}',
    version         integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid NOT NULL,
    updated_by      uuid NOT NULL,
    deleted_at      timestamptz,
    CHECK (budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min)
);
COMMENT ON COLUMN leads.owner_id IS 'Assigned sales consultant. Record-level ABAC: consultants see leads they own; managers/admin see all.';
COMMENT ON COLUMN leads.next_action_at IS 'Scheduled follow-up time; queried by the automation engine (n8n) to fire reminders.';

-- 4.5 Lead ↔ Property interest (many-to-many). A lead may be interested in
-- several specific listings; a listing may interest several leads.
CREATE TABLE lead_property_interests (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES properties(id),
    interest_level priority_level NOT NULL DEFAULT 'medium',
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid NOT NULL,
    UNIQUE (lead_id, property_id)
);

-- 4.6 Lead assignment history — auditability of ownership changes.
-- Separate from the lead row so we never lose who-owned-what-when.
CREATE TABLE lead_assignment_history (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id),
    lead_id      uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    from_user_id uuid REFERENCES users(id),
    to_user_id   uuid REFERENCES users(id),
    reason       text,
    assigned_at  timestamptz NOT NULL DEFAULT now(),
    assigned_by  uuid NOT NULL
);

-- 4.6b Lead stage history — every pipeline move, for funnel & velocity KPIs
-- (time-in-stage, conversion rates). Written by the app/service on each move
-- (or a trigger). Without this, funnel analytics are impossible to reconstruct.
CREATE TABLE lead_stage_history (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),
    lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    from_stage_id uuid REFERENCES pipeline_stages(id),
    to_stage_id   uuid NOT NULL REFERENCES pipeline_stages(id),
    changed_at    timestamptz NOT NULL DEFAULT now(),
    changed_by    uuid NOT NULL,
    duration_secs bigint        -- time spent in from_stage; computed on transition
);

-- 4.7 DEALS / opportunities — created when a lead progresses to active
-- negotiation on a specific property. lead 1..* deals; deal -> pipeline stage.
CREATE TABLE deals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    lead_id         uuid NOT NULL REFERENCES leads(id),
    property_id     uuid REFERENCES properties(id),
    owner_id        uuid REFERENCES users(id),
    -- In the lead-centric model the pipeline lives on the lead; a deal is the
    -- WON outcome / financial record (amount, commission). Pipeline refs are
    -- optional, kept for teams that also want a dedicated closing pipeline.
    pipeline_id     uuid REFERENCES pipelines(id),
    stage_id        uuid REFERENCES pipeline_stages(id),

    title           text NOT NULL,
    status          deal_status NOT NULL DEFAULT 'open',
    amount          numeric(15,2),
    currency        text NOT NULL DEFAULT 'TRY',
    commission_amount numeric(15,2),
    expected_close_date date,
    closed_at       timestamptz,
    lost_reason     text,

    metadata        jsonb NOT NULL DEFAULT '{}',
    version         integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid NOT NULL,
    updated_by      uuid NOT NULL,
    deleted_at      timestamptz
);

-- 4.8 ACTIVITIES — calls, meetings, viewings, notes, tasks. Polymorphic
-- association to lead/deal/contact via nullable FKs (kept explicit rather
-- than a generic type+id pair, so the DB enforces referential integrity).
CREATE TABLE activities (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),
    lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
    deal_id       uuid REFERENCES deals(id) ON DELETE CASCADE,
    contact_id    uuid REFERENCES contacts(id),
    property_id   uuid REFERENCES properties(id),

    activity_type activity_type NOT NULL,
    status        activity_status NOT NULL DEFAULT 'pending',
    subject       text NOT NULL,
    body          text,
    due_at        timestamptz,
    completed_at  timestamptz,
    assigned_to   uuid REFERENCES users(id),

    metadata      jsonb NOT NULL DEFAULT '{}',
    version       integer NOT NULL DEFAULT 1,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid NOT NULL,
    updated_by    uuid NOT NULL,
    deleted_at    timestamptz,
    CHECK (lead_id IS NOT NULL OR deal_id IS NOT NULL OR contact_id IS NOT NULL)
);

-- 4.9 COMMUNICATIONS — message log (WhatsApp/email/SMS/call). Append-only
-- in spirit; feeds activity feed + automation.
CREATE TABLE communications (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),
    lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
    contact_id    uuid REFERENCES contacts(id),
    channel       comm_channel NOT NULL,
    direction     comm_direction NOT NULL,
    subject       text,
    body          text,
    external_id   text,                  -- provider message id (idempotency)
    sent_at       timestamptz,
    delivered_at  timestamptz,
    read_at       timestamptz,
    handled_by    uuid REFERENCES users(id),
    metadata      jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid
);

-- 4.10 Entity tags (join). Generic tagging for leads & properties.
CREATE TABLE lead_tags (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    lead_id   uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tag_id    uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (lead_id, tag_id)
);

-- =====================================================================
-- 5. AUDIT LOG (platform-core slice; append-only)
--    Separate concern from activity feed. Immutable record of changes.
-- =====================================================================
CREATE TABLE audit_log (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),
    actor_id      uuid,                  -- user or service principal
    action        text NOT NULL,         -- 'lead.created','lead.reassigned',...
    entity_type   text NOT NULL,
    entity_id     uuid NOT NULL,
    diff          jsonb,                 -- before/after
    correlation_id uuid,
    occurred_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE audit_log IS 'Append-only. No UPDATE/DELETE granted to app role. Fed from the same event stream as activity/notifications/KPIs but serves compliance/forensics only.';
-- SCALE NOTE: at millions of rows, recreate audit_log as RANGE PARTITIONED on
-- occurred_at (monthly partitions) for cheap retention pruning and fast time
-- scans. Left non-partitioned in v1 to keep bootstrap simple; convert before
-- audit volume grows. Tracked as DEBT-002.

-- =====================================================================
-- 6. INDEXES (with justification)
--    Rule: tenant_id leads composite indexes; add covering indexes for
--    the hot query paths the CRM UI actually runs.
-- =====================================================================

-- Partial UNIQUE indexes (soft-delete aware): a deleted row must not block
-- re-creating the same natural key.
CREATE UNIQUE INDEX uq_users_email   ON users (tenant_id, email)          WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_pipelines_name ON pipelines (tenant_id, name)       WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_properties_ref ON properties (tenant_id, reference_code)
    WHERE deleted_at IS NULL AND reference_code IS NOT NULL;
-- Contact dedup: one active contact per phone (ignores merged & deleted rows)
CREATE UNIQUE INDEX uq_contacts_phone ON contacts (tenant_id, normalized_phone)
    WHERE deleted_at IS NULL AND merged_into_id IS NULL AND normalized_phone <> '';

-- Lead-centric pipeline board (group by stage)
CREATE INDEX idx_leads_pipeline_stage ON leads (tenant_id, pipeline_id, stage_id)
    WHERE deleted_at IS NULL;
-- Funnel/velocity analytics
CREATE INDEX idx_lead_stage_history_lead ON lead_stage_history (tenant_id, lead_id, changed_at);

-- Hot path: "my leads, by status, freshest first" (consultant dashboard)
CREATE INDEX idx_leads_tenant_owner_status ON leads (tenant_id, owner_id, status)
    WHERE deleted_at IS NULL;
-- Hot path: pipeline/kanban board grouping
CREATE INDEX idx_leads_tenant_status_updated ON leads (tenant_id, status, updated_at DESC)
    WHERE deleted_at IS NULL;
-- Automation: "leads whose follow-up is due" (n8n poller)
CREATE INDEX idx_leads_next_action ON leads (tenant_id, next_action_at)
    WHERE deleted_at IS NULL AND next_action_at IS NOT NULL;
-- Lookup by contact
CREATE INDEX idx_leads_contact ON leads (tenant_id, contact_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_source ON leads (tenant_id, source_id) WHERE deleted_at IS NULL;

-- Contacts: dedupe & search by phone/email (trigram for partial match)
CREATE INDEX idx_contacts_tenant_phone ON contacts (tenant_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_tenant_email ON contacts (tenant_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_name_trgm ON contacts USING gin (lower(first_name || ' ' || coalesce(last_name,'')) gin_trgm_ops);

-- Properties: filter board (type/status/city) + agent's listings
CREATE INDEX idx_properties_tenant_status_type ON properties (tenant_id, listing_status, property_type)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_agent ON properties (tenant_id, listing_agent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_city_district ON properties (tenant_id, city, district) WHERE deleted_at IS NULL;

-- Deals: pipeline board + forecast + owner's open deals
CREATE INDEX idx_deals_tenant_pipeline_stage ON deals (tenant_id, pipeline_id, stage_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_tenant_owner_status ON deals (tenant_id, owner_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_close_date ON deals (tenant_id, expected_close_date) WHERE deleted_at IS NULL AND status = 'open';

-- Activities: "my open tasks/due today" + per-entity timeline
CREATE INDEX idx_activities_assignee_due ON activities (tenant_id, assigned_to, due_at)
    WHERE deleted_at IS NULL AND status = 'pending';
CREATE INDEX idx_activities_lead ON activities (tenant_id, lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_deal ON activities (tenant_id, deal_id) WHERE deleted_at IS NULL;

-- Communications: per-lead timeline + idempotency on provider id
CREATE INDEX idx_comms_lead ON communications (tenant_id, lead_id, created_at DESC);
CREATE UNIQUE INDEX idx_comms_external ON communications (tenant_id, channel, external_id)
    WHERE external_id IS NOT NULL;

-- Audit: entity history lookup + time scans
CREATE INDEX idx_audit_entity ON audit_log (tenant_id, entity_type, entity_id, occurred_at DESC);

-- =====================================================================
-- 7. updated_at trigger (keeps the envelope honest)
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    -- optimistic-lock bump when a version column exists
    -- (to_jsonb returns jsonb so the ? key-existence operator is valid)
    IF TG_OP = 'UPDATE' AND to_jsonb(NEW) ? 'version' THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['contacts','organizations','properties','leads','deals','activities']
    LOOP
        EXECUTE format(
          'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s
           FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
    END LOOP;
END $$;

-- =====================================================================
-- 8. ROW-LEVEL SECURITY (defense in depth)
--    Primary authorization is the SERVICE layer. RLS is the safety net.
--    Depends on the app setting GUCs per request/session:
--      SET app.tenant_id = '<uuid>';
--      SET app.user_id   = '<uuid>';
--      SET app.role      = 'sales_consultant' | 'team_lead' | 'manager' | 'super_admin';
-- =====================================================================
CREATE OR REPLACE FUNCTION app_tenant() RETURNS uuid
  LANGUAGE sql STABLE AS $fn$ SELECT nullif(current_setting('app.tenant_id', true),'')::uuid $fn$;
CREATE OR REPLACE FUNCTION app_user() RETURNS uuid
  LANGUAGE sql STABLE AS $fn$ SELECT nullif(current_setting('app.user_id', true),'')::uuid $fn$;
CREATE OR REPLACE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE AS $fn$ SELECT coalesce(nullif(current_setting('app.role', true),''),'') $fn$;
-- Managers/admin see all tenant data; consultants are restricted to owned rows.
CREATE OR REPLACE FUNCTION app_is_privileged() RETURNS boolean
  LANGUAGE sql STABLE AS $fn$ SELECT app_role() IN ('super_admin','manager','marketing_manager','finance_manager') $fn$;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Tenant isolation + record-level ownership for leads.
CREATE POLICY leads_tenant_isolation ON leads
    USING (tenant_id = app_tenant())
    WITH CHECK (tenant_id = app_tenant());
CREATE POLICY leads_ownership_read ON leads FOR SELECT
    USING (tenant_id = app_tenant() AND (app_is_privileged() OR owner_id = app_user()));

-- Deals follow the same ownership rule.
CREATE POLICY deals_tenant_isolation ON deals
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());
CREATE POLICY deals_ownership_read ON deals FOR SELECT
    USING (tenant_id = app_tenant() AND (app_is_privileged() OR owner_id = app_user()));

-- Activities visible if assigned to the user or privileged.
CREATE POLICY activities_tenant_isolation ON activities
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());
CREATE POLICY activities_scope ON activities FOR SELECT
    USING (tenant_id = app_tenant() AND (app_is_privileged() OR assigned_to = app_user() OR created_by = app_user()));

-- Contacts: tenant-scoped (shared book; tighten later if needed).
CREATE POLICY contacts_tenant_isolation ON contacts
    USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());

COMMIT;

-- =====================================================================
-- 9. SEED (run once for ProDuality). Commented; uncomment to bootstrap.
-- =====================================================================
-- INSERT INTO tenants (name, slug) VALUES ('ProDuality','produality');
-- -- roles: super_admin, sales_consultant, team_lead, marketing_manager, finance_manager
-- -- default pipeline + stages:
-- --   new -> contacted -> qualified -> viewing -> offer -> negotiation -> won / lost
