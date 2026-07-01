# PREI | Smart Suites — Enterprise Architecture Blueprint

**Status:** v1.0 (foundational) · **Owner:** Lead Enterprise Software Architect · **Date:** 2026-06-19
**Scope:** AI-ready, multi-tenant operating system for real estate investment, property intelligence, CRM, project & document management, workflow automation, and business operations.

> This document is the anchor artifact. The database schema, module designs, and code scaffolding all derive from the decisions recorded here. Changes to module boundaries, the tenancy model, or the event contract are **architecturally significant** and require a revision of this blueprint before implementation.

---

## 1. Architectural Drivers (what the design must satisfy)

| Driver | Target | Architectural consequence |
|---|---|---|
| Scale | Millions of records/tenant, thousands of concurrent users | Stateless services, connection pooling, partitionable tables, read replicas, async projections |
| Multi-tenancy | Many business units / client orgs on shared infra | `tenant_id` on every row, enforced isolation at DB + service layer |
| Security | Backend is source of truth; zero trust of frontend | AuthN/AuthZ at service layer, RLS as defense-in-depth, secrets isolation |
| Auditability | Every state change reconstructable | Append-only audit log + entity versioning + outbox events |
| AI-readiness | Future agents & RAG over tenant data | Clean normalized models, stable IDs, embeddings store, event stream as feature source |
| Maintainability | Long-lived, multi-team codebase | DDD bounded contexts, hexagonal layering, contract-first APIs |
| Extensibility | Workflow automation & integrations | Event-driven core, webhook infra, plugin-style integration adapters |

These are ranked: **security and auditability outrank developer convenience and speed of delivery**, per project mandate.

---

## 2. Layered Architecture (Hexagonal / Clean)

Each bounded context is internally structured into four layers with a strict, one-directional dependency rule: **API → Application → Domain ← Infrastructure**. The Domain layer depends on nothing; Infrastructure implements ports the Domain/Application define.

```
┌──────────────────────────────────────────────────────────────┐
│ API LAYER  (thin)                                              │
│  HTTP controllers, GraphQL resolvers, request/response DTOs,   │
│  versioning, input validation, output sanitization, auth guard │
├──────────────────────────────────────────────────────────────┤
│ APPLICATION LAYER                                              │
│  Use-case services, command/query handlers, orchestration,     │
│  transaction boundaries, permission checks, event publication  │
├──────────────────────────────────────────────────────────────┤
│ DOMAIN LAYER  (pure, no I/O)                                   │
│  Entities, value objects, aggregates, domain events,           │
│  invariants, domain services, repository INTERFACES (ports)    │
├──────────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE LAYER                                          │
│  Repository impls (Postgres), event bus, cache, blob storage,  │
│  external API adapters, auth provider, search index, mailer    │
└──────────────────────────────────────────────────────────────┘
```

**Hard rules**

- Business logic lives in the Domain/Application layers — **never in controllers**. Controllers translate HTTP ↔ application commands and nothing more.
- Internal domain/database models are **never** serialized to clients. Every boundary crosses an explicit DTO (Request DTO, Response DTO).
- Dependencies are injected via interfaces (ports). No layer constructs its own concrete infrastructure.
- SOLID throughout; favor composition. A service that needs five collaborators is a smell — re-examine the aggregate boundary.

**DTO ↔ model separation (four distinct shapes):**

```
Request DTO  ──(validate, map)──▶  Domain Command  ──▶  Domain Model/Aggregate
                                                              │
Database Model  ◀──(persistence mapping)───────────────────┘
Domain Model  ──(map)──▶  Response DTO  ──▶  client
```

---

## 3. Recommended Technology Stack

The architecture is provider-agnostic, but to avoid analysis paralysis the recommended concrete stack — aligned with the team's existing Supabase/n8n footprint — is:

| Concern | Recommendation | Rationale |
|---|---|---|
| Primary DB | **PostgreSQL** (Supabase-managed) | Mandated; mature RLS, JSONB, partitioning, `pgvector` for AI |
| API runtime | **NestJS (TypeScript)** | First-class DI, modular boundaries, guards/interceptors map cleanly to the layered model; OpenAPI generation |
| API style | **REST (OpenAPI-first)** + selective GraphQL for read-heavy aggregation | Contract-first; versioned `/api/v1` |
| AuthN | JWT (access) + rotating refresh tokens; provider-backed (Supabase Auth or self-issued) | Stateless verification, revocable sessions |
| Event bus | Transactional **outbox** → broker (NATS/Kafka/Postgres LISTEN-NOTIFY for v1) | Reliable, ordered, replayable |
| Cache | Redis | Sessions, rate limiting, hot reads, idempotency keys |
| Blob/docs | S3-compatible object storage | Document management, signed URLs |
| Search | Postgres FTS for v1 → OpenSearch/Meilisearch at scale | Global search capability |
| Vector/AI | `pgvector` (v1) → dedicated vector DB if needed | RAG over tenant documents |
| Automation | **n8n** as orchestration plane via webhook + event triggers | Reuses existing investment, keeps engine swappable |
| Observability | OpenTelemetry → traces/metrics/logs | Full observability mandate |

> **Decision note (technical debt flag):** Using Postgres LISTEN/NOTIFY or a Postgres-backed queue for the v1 event bus is a deliberate simplification. It is acceptable to ~tens of events/sec but will not survive high fan-out. The outbox pattern isolates this: swapping to Kafka/NATS later changes only the infrastructure adapter, not domain or application code. **Tracked as DEBT-001.**

---

## 4. Multi-Tenancy Model

**Chosen model: shared database, shared schema, row-level `tenant_id` isolation** — with a migration path to schema-per-tenant or DB-per-tenant for high-value enterprise clients.

| Approach | Isolation | Cost | Verdict |
|---|---|---|---|
| Shared DB, shared schema (`tenant_id` column) | Logical | Lowest | **Default** — best density, simplest ops |
| Schema-per-tenant | Stronger | Medium | Reserved for regulated/large tenants |
| DB-per-tenant | Strongest | Highest | Reserved for sovereignty/contractual needs |

**Enforcement — defense in depth (three layers, never one):**

1. **Application layer (primary source of truth):** every repository query is scoped by `tenant_id` resolved from the authenticated principal's context, not from the request body. A `TenantContext` is established in middleware and propagated; repositories refuse unscoped queries.
2. **Database RLS (defense in depth):** Postgres Row-Level Security policies keyed on a session-set `app.current_tenant` GUC, so even a leaked query cannot cross tenants.
3. **Connection/role discipline:** the app role cannot bypass RLS; migrations run under a separate privileged role.

**Critical rule:** `tenant_id` is *never* accepted from the client for authorization decisions. It is derived from the verified token. A request that references a resource in another tenant returns `404` (not `403`) to avoid existence disclosure.

---

## 5. Bounded Context / Module Map

Domain-Driven Design decomposition. Each context owns its data, exposes a contract, and communicates with others **only** via published events or explicit API calls — never by reaching into another context's tables.

```
                         ┌─────────────────────────┐
                         │   PLATFORM CORE          │
                         │  (shared kernel)         │
                         │  Tenancy · Identity      │
                         │  RBAC/ABAC · Audit       │
                         │  Events · Notifications  │
                         │  Search · Files · KPI    │
                         └────────────┬────────────┘
        ┌─────────────┬──────────────┼──────────────┬─────────────┐
        ▼             ▼              ▼              ▼             ▼
  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐
  │   CRM    │  │ INVESTMENT │  │ PROPERTY  │  │ DOCUMENT │  │ WORKFLOW │
  │          │  │ MANAGEMENT │  │INTELLIGENCE│  │   MGMT   │  │  ENGINE  │
  └──────────┘  └───────────┘  └───────────┘  └──────────┘  └──────────┘
        │             │              │              │             │
        └─────────────┴──────────────┴──────────────┴─────────────┘
                         events flow up to KPI/Audit/Search
```

### Core contexts

| Context | Owns | Key aggregates | Publishes (examples) |
|---|---|---|---|
| **Platform Core (shared kernel)** | Tenants, users, roles, permissions, audit, events, notifications, API keys, files metadata, search index, KPI projections | Tenant, User, Role, AuditEntry, ApiKey | `tenant.created`, `user.invited` |
| **CRM** | Contacts, organizations, leads, deals/pipeline, activities | Contact, Organization, Deal, Activity | `deal.stage_changed`, `lead.qualified` |
| **Investment Management** | Funds, assets, positions, transactions, valuations, distributions, investors | Fund, Investment, Position, Transaction | `investment.committed`, `valuation.recorded` |
| **Property Intelligence** | Properties, units, market data, comparables, scoring, geospatial | Property, Unit, MarketSnapshot | `property.scored`, `comparable.added` |
| **Document Management** | Documents, versions, folders, sharing, e-sign status, OCR/extraction | Document, DocumentVersion | `document.uploaded`, `document.signed` |
| **Workflow Engine** | Workflow definitions, instances, tasks, triggers, SLAs | WorkflowDefinition, WorkflowInstance, WorkflowTask | `workflow.completed`, `task.assigned` |
| **Operations & Reporting** | KPIs, dashboards, reports, activity feeds (read-side projections) | KpiProjection, Report | — (consumer) |

### Relationship patterns (Context Map)

- **Shared Kernel:** Platform Core (identity, tenancy, audit, events). Every context depends on it; it depends on none.
- **Customer/Supplier:** Investment Management consumes Property Intelligence scores; Property is upstream supplier.
- **Conformist / Published Language:** all inter-context communication uses versioned domain events (the published language). No shared mutable tables.
- **Anti-Corruption Layer:** external integrations (market data feeds, e-sign providers, n8n) enter through ACL adapters in Infrastructure so external schema drift never leaks into the domain.

---

## 6. Mandatory Data Rules

Every persisted entity carries a standard envelope. This is non-negotiable and enforced by a base entity/mixin + migration lint.

**Always present:**

```
id           UUID  PK (v7 preferred for index locality)
tenant_id    UUID  NOT NULL, FK → tenants(id), indexed, in every WHERE
created_at   timestamptz NOT NULL default now()
updated_at   timestamptz NOT NULL
created_by   UUID  NOT NULL  (user or service principal)
updated_by   UUID  NOT NULL
```

**Where appropriate:**

```
deleted_at   timestamptz NULL      -- soft delete; partial indexes exclude non-null
version      integer NOT NULL def 1 -- optimistic concurrency + entity versioning
status       text / enum            -- lifecycle state
metadata     jsonb default '{}'     -- extensibility without migrations (GIN-indexed)
```

**Rules**

- **No hard deletes** unless explicitly justified (e.g. GDPR erasure, which is logged as a privileged operation). Default delete = set `deleted_at`, emit `*.deleted` event.
- **Optimistic concurrency:** writes carry the expected `version`; mismatch → `409 Conflict`. Prevents lost updates under concurrency.
- **Normalize first.** Denormalization is allowed only on the read side (KPI/search projections) and must be justified against a measured performance need — never in the write model.
- **Index discipline:** `tenant_id` leads every composite index on multi-tenant tables; add covering indexes for hot query paths; document each index's query justification.

---

## 7. Cross-Cutting Capabilities

### 7.1 Authorization — RBAC + ABAC (layered)

- **RBAC** for coarse grants: roles (`tenant_admin`, `investment_manager`, `analyst`, `viewer`, …) → permission sets (`investment:read`, `deal:write`, …).
- **ABAC** for fine, contextual decisions evaluated at the service layer: attributes of the **subject** (role, business unit), **resource** (owner, status, sensitivity), **action**, and **environment** (time, IP). Example: an analyst may `investment:read` only assets within their assigned business unit and only when the asset isn't in `confidential` status.
- **Permission checks happen in the Application layer**, before the domain mutates. The frontend's view of permissions is advisory only. RLS is the last line, not the only line.
- Decisions are **deny-by-default** and **logged** (who, what, allow/deny, why) for audit.

### 7.2 Audit, Activity, Notifications, KPIs — four separate concerns

These are deliberately **not** the same pipeline (project mandate: no duplicated responsibilities). All are fed from the **same event stream** but serve different purposes:

| Concern | Purpose | Shape | Retention |
|---|---|---|---|
| **Audit log** | Compliance / forensics; immutable record of *what changed* | Append-only, signed, includes before/after diff | Long, tamper-evident |
| **Activity feed** | Human-readable "what happened" UX per entity/user | Denormalized projection | Medium |
| **Notifications** | Deliver actionable alerts to users/channels | Transient + preference-aware | Short |
| **KPI projections** | Aggregated metrics for dashboards/reports | Materialized read models | Rolling windows |

### 7.3 Event System

- Events are **typed, versioned, and traceable.** Envelope: `event_id`, `event_type`, `event_version`, `tenant_id`, `aggregate_id`, `occurred_at`, `actor`, `correlation_id`, `causation_id`, `payload`.
- **Transactional outbox:** domain mutation and event insert commit in the same DB transaction; a relay publishes to the bus. Guarantees no lost events and at-least-once delivery; consumers are **idempotent** (dedupe on `event_id`).
- Schema evolution: additive changes bump minor; breaking changes introduce a new `event_version` and run old/new in parallel during migration.

### 7.4 Other platform services

- **Global search:** index projection updated from events; tenant-scoped at query time; FTS → external engine at scale.
- **API key management:** hashed-at-rest keys, scoped permissions, rotation, per-key rate limits, full request attribution into audit.
- **Webhook infrastructure:** outbound subscriptions with HMAC signatures, retries with backoff, dead-letter queue, delivery log.
- **Document management:** metadata in Postgres, bytes in object storage, signed time-limited URLs, version chain, virus scan hook, optional OCR/extraction feeding search + AI.
- **Observability:** OpenTelemetry tracing with `correlation_id` propagated from API through events; structured logs; RED/USE metrics; per-tenant dashboards.

### 7.5 Security baseline

JWT auth · refresh-token rotation (one-time-use, reuse detection revokes the family) · session revocation list · rate limiting (per IP, per user, per API key) · strict input validation at the API edge (schema + semantic) · output sanitization/serialization through DTOs only · secrets in a vault, never in code or DB · TLS everywhere · principle of least privilege on DB roles.

---

## 8. AI-Readiness

- **Stable, clean IDs and normalized models** make the data trustworthy as a feature source — no scraping denormalized blobs.
- **Event stream doubles as a feature/inference log** for future agents (every meaningful state change is already captured, ordered, and tenant-tagged).
- **RAG substrate:** document text + structured entities → embeddings in `pgvector`, tenant-scoped, with the same RLS guarantees so an AI agent cannot retrieve across tenants.
- **Tool surface for agents:** the same Application-layer use-case services (with permission checks) are what future AI agents call — agents get no privileged backdoor; they act as principals with scoped permissions and full audit.
- **Workflow engine + n8n** give agents a safe place to trigger automations under explicit, revocable authority.

---

## 9. Phased Delivery Roadmap

Built foundation-first; each phase is independently shippable and leaves the system in a coherent state.

**Phase 0 — Foundations (the platform spine).**
Repo + module scaffolding (NestJS modules per bounded context), base entity envelope, migration tooling + lint enforcing data rules, tenancy middleware + `TenantContext`, Postgres RLS baseline, JWT auth + refresh rotation + session revocation, DI/service skeleton, OpenAPI pipeline, OTel wiring. *Exit:* a tenant can be created, a user can authenticate, and one trivial entity round-trips through all four layers with audit + event emitted.

**Phase 1 — Core platform services.**
RBAC/ABAC engine, audit log, transactional outbox + event bus, notifications, API key management, global search skeleton, document management (upload/version/sign-status). *Exit:* cross-cutting capabilities usable by any feature module.

**Phase 2 — First business context: CRM.**
Contacts, organizations, deals/pipeline, activities. Proves the full pattern end-to-end on real domain. *Exit:* CRM live, emitting events consumed by KPI/activity/search.

**Phase 3 — Investment Management + Property Intelligence.**
The revenue-core domains, leveraging the proven patterns and the CRM↔Investment event links. *Exit:* investments and property scoring operational.

**Phase 4 — Workflow Engine + Operations/Reporting.**
Workflow definitions/instances/tasks, KPI dashboards, reporting, webhook subscriptions, n8n integration. *Exit:* automation and analytics layer live.

**Phase 5 — AI layer.**
Embeddings/RAG over tenant documents, agent tool surface over Application services, observability for agent actions. *Exit:* scoped, audited AI agents.

---

## 10. Architectural Decision Records (seed)

| ID | Decision | Status |
|---|---|---|
| ADR-001 | PostgreSQL as primary DB; normalized write model | Accepted |
| ADR-002 | Shared-DB/shared-schema multi-tenancy with `tenant_id` + RLS | Accepted |
| ADR-003 | Hexagonal layering; business logic out of controllers | Accepted |
| ADR-004 | Transactional outbox for event delivery | Accepted |
| ADR-005 | RBAC + ABAC, enforced at Application layer; RLS as defense-in-depth | Accepted |
| ADR-006 | Soft deletes + entity versioning by default | Accepted |
| ADR-007 | Audit / Activity / Notifications / KPI are separate consumers of one event stream | Accepted |
| DEBT-001 | Postgres-backed event transport in v1; swap to Kafka/NATS at scale | Accepted (time-boxed) |

---

## 11. Open Decisions (need product/business input before deeper design)

1. **Tenancy granularity:** are "business units" sub-tenants within one org, or fully separate tenants? Affects the RBAC scope model and data partition keys.
2. **Residency/compliance:** any data-sovereignty or regulatory regime (GDPR, regional hosting) that forces schema- or DB-per-tenant for some clients?
3. **API consumers:** internal SPA only, or third-party developers too? Determines how much webhook/API-key/versioning rigor is needed in Phase 1 vs later.
4. **Identity:** self-issued JWT vs Supabase Auth vs external IdP (SSO/SAML for enterprise)? Affects Phase 0.

---

*Next deliverables (recommended order): (a) PostgreSQL schema for Platform Core + one business context, (b) NestJS module scaffolding implementing the base entity envelope and tenancy middleware, (c) the canonical event contract.*
