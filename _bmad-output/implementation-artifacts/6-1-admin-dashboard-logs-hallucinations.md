# Story 6.1: Admin Dashboard (Logs & Hallucinations) — Parent Overview

Status: superseded-by-split
Split from: original 6.1 (164 subtasks, exceeded Lesson #23 threshold)
Adversarial review: 2026-04-18 (Winston, Amelia, Murat, Dr. Quinn — consensus on 12 positions)
Validated: 2026-04-18 (all 4 critical + 5 enhancement + 3 optimization fixes applied)

> **This story has been split into two files for clean dev-agent execution:**
> - **`6-1a-audit-infrastructure-write-path.md`** — Backend: data model, audit pipeline, admin auth, API endpoints, engine integration, tests (ready-for-dev)
> - **`6-1b-frontend-admin-observability.md`** — Frontend: admin pages, bundle isolation, frontend tests, observability (backlog, depends on 6.1a)

## Story

As a Compliance Officer,
I want to view a table of all debates and flag hallucinations,
So that we can improve the system and remove dangerous content.

## Acceptance Criteria

1. **Given** a staff user
   **When** loading `/admin/debates`
   **Then** I see a paginated table of recent debates with "Risk Score" columns

2. **Given** a specific debate
   **When** I flag a message as "Hallucination"
   **Then** it is marked in the DB (Journey-Req-3) and added to the "Negative Examples" dataset

---

## Story Split

This story is split into **6.1a** (backend audit infrastructure) and **6.1b** (integration + frontend + observability). Ship 6.1a first — it is the highest-risk, highest-value piece. 6.1b depends on 6.1a's schema and write path.

---

## Story 6.1a — Audit Infrastructure + Write Path

### Phase 1: Data Model & Migration

- [ ] 1. Create `AuditEvent` SQLAlchemy model in `app/models.py` (AC: #1, NFR-09)
  - [ ] 1.1 Fields: `id` (UUID PK, default `uuid.uuid4`), `debate_id` (FK→debates, CASCADE), `sequence_number` (BigInteger, NOT NULL), `event_type` (String 50, NOT NULL — values: `SANITIZATION`, `GUARDIAN_ANALYSIS`, `VOTE`, `DEBATE_STARTED`, `DEBATE_COMPLETED`), `actor` (String 20, NOT NULL — values: `bull`, `bear`, `guardian`, `system`, `voter`), `payload` (JSONB, NOT NULL, default `{}`), `created_at` (DateTime TZ, server_default `func.now()`)
  - [ ] 1.2 Constraints: `UniqueConstraint("debate_id", "sequence_number")`, `Index("ix_audit_events_debate_created", "debate_id", "created_at")`
  - [ ] 1.3 GIN index on `payload` JSONB column for containment queries: `Index("ix_audit_events_payload", "payload", postgresql_using="gin")`
  - [ ] 1.4 Add back-populate on `Debate` model: `audit_events` (cascade="all, delete-orphan")

- [ ] 2. Create `HallucinationFlag` SQLAlchemy model in `app/models.py` (AC: #2, Journey-Req-3)
  - [ ] 2.1 Fields: `id` (UUID PK), `debate_id` (FK→debates), `audit_event_id` (FK→audit_events, nullable — links to the specific audit event being flagged), `turn` (Integer), `agent` (String 10), `message_snippet` (Text), `flagged_by` (FK→users, nullable), `status` (String 20, default `"pending"` — values: `pending`, `confirmed`, `dismissed`), `notes` (Text, nullable), `created_at`/`updated_at` (DateTime TZ)
  - [ ] 2.2 Add back-populate on `Debate` model: `hallucination_flags`
  - [ ] 2.3 Index on `status` for dashboard filtering

- [ ] 3. Create Alembic migration (AC: #1)
  - [ ] 3.1 Generate migration branching from `f1a2b3c4d5e6` (latest: add_vote_debate_choice_idx)
  - [ ] 3.2 `upgrade()`: create `audit_events` and `hallucination_flags` tables
  - [ ] 3.3 Create GIN index on `audit_events.payload` using `CREATE INDEX CONCURRENTLY` via `op.execute()` with autocommit block — do NOT use `op.create_index()` (it wraps in transaction, which fails with CONCURRENTLY)
  - [ ] 3.4 Create composite index `ix_audit_events_debate_created` on `(debate_id, created_at)` CONCURRENTLY
  - [ ] 3.5 Insert legacy marker for existing debates: `INSERT INTO audit_events (debate_id, sequence_number, event_type, actor, payload) SELECT id, 0, 'LEGACY_DEBATE_MIGRATION', 'system', '{"note": "pre-audit"}' FROM debates WHERE id NOT IN (SELECT DISTINCT debate_id FROM audit_events)`
  - [ ] 3.6 `downgrade()`: drop tables in reverse order (flags → events)
  - [ ] 3.7 Run migration against test DB to verify

### Phase 2: AuditWriter — Async Write Pipeline

- [ ] 4. Create `AuditWriter` abstraction in `app/services/audit/writer.py` (AC: #1, NFR-09)
  - [ ] 4.1 Define `AuditWriter` protocol with methods: `async write(event) -> None`, `async flush() -> None`, `async close() -> None`
  - [ ] 4.2 Implement `QueuedAuditWriter` — wraps `asyncio.Queue(maxsize=1000)` with background consumer task. Consumer batches events and bulk INSERTs. On queue full, falls through to `DirectAuditWriter` (DLQ path)
  - [ ] 4.3 Implement `DirectAuditWriter` — synchronous DB insert for DLQ fallback and reconciliation. Uses its own session factory (separate from business logic sessions)
  - [ ] 4.4 `sequence_number` assignment: `INSERT INTO audit_events (..., sequence_number) VALUES (..., (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM audit_events WHERE debate_id = :debate_id)) RETURNING sequence_number` — atomic subquery, single-writer-per-debate guaranteed by queue serialization. `UNIQUE(debate_id, sequence_number)` constraint is the safety net
  - [ ] 4.5 Graceful shutdown: register `on_event("shutdown")` handler that drains remaining queue before process exits. Log count of drained events
  - [ ] 4.6 Feature flag: `AUDIT_ENABLED` (default `False`). Engine checks flag before emitting. Deploy code with flag off → run migration → flip flag on. Zero-downtime for in-progress debates

- [ ] 5. Create Dead Letter Queue in `app/services/audit/dlq.py` (AC: #1, NFR-09)
  - [ ] 5.1 `audit_dlq` table: `id` (UUID PK), `original_event` (JSONB), `error_message` (Text), `retry_count` (Integer, default 0), `created_at` (DateTime TZ)
  - [ ] 5.2 When `QueuedAuditWriter` fails after 3 retries, event lands in DLQ via `DirectAuditWriter` (synchronous, separate session — this is the fallback, not the hot path)
  - [ ] 5.3 `GET /api/admin/audit/dlq` — list DLQ entries (admin-only)
  - [ ] 5.4 `POST /api/admin/audit/dlq/{event_id}/replay` — replay a DLQ entry using `DirectAuditWriter`

- [ ] 6. Create reconciliation job in `app/services/audit/reconciliation.py` (AC: #1, NFR-09)
  - [ ] 6.1 Runs via FastAPI lifespan startup + configurable interval (`AUDIT_RECONCILIATION_INTERVAL_SECONDS`). Not Celery — in-process for v1
  - [ ] 6.2 Gap detection: `SELECT sequence_number FROM audit_events WHERE debate_id = :id ORDER BY sequence_number` — walk list, flag any `current != prev + 1`. Skip debates with `event_type = 'LEGACY_DEBATE_MIGRATION'` at seq 0 (pre-audit)
  - [ ] 6.3 Idempotent: uses `event_type = 'RECONCILIATION_GAP_FILL'` marker so re-runs don't duplicate
  - [ ] 6.4 DLQ replay: pick up DLQ entries with `retry_count < 3`, replay via `DirectAuditWriter`, increment retry_count

### Phase 3: Admin Auth

- [ ] 7. Add superuser dependency and admin router (AC: #1)
  - [ ] 7.1 In `app/users.py` — add `current_superuser = fastapi_users.current_user(active=True, superuser=True)` (fastapi-users built-in)
  - [ ] 7.2 Create `app/routes/admin.py` with `APIRouter(prefix="/api/admin", tags=["admin"])`
  - [ ] 7.3 All admin endpoints use `Depends(current_superuser)` at router level — returns 403 for non-superusers
  - [ ] 7.4 Register admin router in `app/main.py`: `app.include_router(admin_router)`
  - [ ] 7.5 Update `seed_test_user.py` — add admin user: `admin@trade.dev` / `AdminPass1!` with `is_superuser=True`
  - [ ] 7.6 Add `/api/admin/me` endpoint — returns current admin user info (for frontend auth check)

### Phase 4: Admin API Endpoints

- [ ] 8. Create admin API endpoints for debates listing (AC: #1)
  - [ ] 8.1 `GET /api/admin/debates` — paginated list of all debates. Include derived columns: `audit_event_count` (subquery on audit_events), `risk_score` (highest risk_level from audit_events WHERE event_type='GUARDIAN_ANALYSIS' AND payload->>'risk_level' IN ('high','critical'))
  - [ ] 8.2 Create Pydantic schemas in `app/services/debate/admin_schemas.py`:
    - `AdminDebateListResponse` with `alias_generator=camelize` + `populate_by_name=True`
    - `AdminDebateItem` with all listing columns
    - `AdminDebateDetailResponse` with full debate data + audit events
  - [ ] 8.3 Support query params: `page`, `page_size`, `sort_by` (created_at, risk_score), `sort_order` (asc/desc), `status` filter, `risk_level` filter (queries `audit_events.payload->>'risk_level'`)
  - [ ] 8.4 Use standard response envelope: `{ "data": ..., "error": null, "meta": { "latency_ms": ..., "page": ..., "total": ... } }`
  - [ ] 8.5 Use `fastapi-pagination` (`add_pagination` already in main.py) for pagination

- [ ] 9. Create admin API endpoints for audit log queries (AC: #1)
  - [ ] 9.1 `GET /api/admin/debates/{debate_id}/audit-events` — paginated list of audit events for a debate, ordered by `sequence_number ASC`. Filter by `event_type`, `actor`
  - [ ] 9.2 `GET /api/admin/audit-events` — global audit event log. Filter by `event_type`, `actor`, `debate_id`, date range (`created_after`, `created_before`). Validate `created_after < created_before`
  - [ ] 9.3 `GET /api/admin/debates/{debate_id}/detail` — full debate detail with all audit events

- [ ] 10. Create hallucination flagging endpoint (AC: #2, Journey-Req-3)
  - [ ] 10.1 `POST /api/admin/debates/{debate_id}/hallucination-flags` — create flag. Body: `turn`, `agent`, `message_snippet`, `notes`. Validate `debate_id` is valid UUID. Return 404 if debate doesn't exist
  - [ ] 10.2 `GET /api/admin/hallucination-flags` — list all flags with filtering by `status` (pending/confirmed/dismissed)
  - [ ] 10.3 `PATCH /api/admin/hallucination-flags/{flag_id}` — update flag status (confirm/dismiss) + notes. Validate state transitions
  - [ ] 10.4 Create Pydantic schemas: `HallucinationFlagCreate`, `HallucinationFlagUpdate`, `HallucinationFlagResponse`
  - [ ] 10.5 When flag status is "confirmed", emit `HALLUCINATION_FLAGGED` audit event for Negative Examples dataset (NFR-09)

### Phase 5: Engine Integration

- [ ] 11. Wire audit emission into debate engine (AC: #1, NFR-09)
  - [ ] 11.1 Inject `AuditWriter` into `stream_debate()` signature. Router injects via `Depends(get_audit_writer)`. Engine calls `writer.write(event)` — decoupled from persistence implementation
  - [ ] 11.2 In `bull_agent_node()`/`bear_agent_node()` — after sanitization: if `SanitizationResult.is_redacted`, emit audit event with `event_type='SANITIZATION'`, `actor=current_agent`, `payload={'redacted_phrases': [...], 'redaction_ratio': 0.5, 'original_length': 1200, 'turn': N}`
  - [ ] 11.3 After `guardian.analyze()` — emit audit event with `event_type='GUARDIAN_ANALYSIS'`, `actor='guardian'`, `payload={'should_interrupt': bool, 'risk_level': str, 'fallacy_type': str|None, 'reason': str, 'summary_verdict': str, 'safe': bool, 'detailed_reasoning': str, 'turn': N}`. Field names per AGENTS.md Lesson #4: `should_interrupt` (NOT `intervention_needed`), `reason` (NOT `reasoning`)
  - [ ] 11.4 At debate start — emit `DEBATE_STARTED` event
  - [ ] 11.5 At debate completion — emit `DEBATE_COMPLETED` event
  - [ ] 11.6 Feature flag guard: `if settings.AUDIT_ENABLED: await audit_writer.write(event)`. Before migration, flag is off — current behavior unchanged

### Phase 6: Backend Tests

- [ ] 12. Unit tests for AuditWriter pipeline (AC: #1, NFR-09)
  - [ ] 12.1 `tests/services/audit/test_writer.py` — test `AuditWriter.write()` serializes event with correct `sequence_number` increment
  - [ ] 12.2 Test `AuditWriter.write()` raises on missing required fields (debate_id, event_type)
  - [ ] 12.3 Test `AuditWriter.write()` embeds payload as valid JSONB-compatible dict
  - [ ] 12.4 DLQ handler marks event as `dead` with failure reason

- [ ] 13. Unit tests for reconciliation service (AC: #1, NFR-09)
  - [ ] 13.1 Reconciliation detects gap in `sequence_number` for a given `debate_id` (e.g., [1, 2, 4, 5] → gap at 3)
  - [ ] 13.2 Reconciliation reports no gaps for complete sequence [1, 2, 3, 4, 5]
  - [ ] 13.3 Reconciliation handles debate with zero events gracefully
  - [ ] 13.4 Reconciliation skips debates with `LEGACY_DEBATE_MIGRATION` at seq 0

- [ ] 14. Integration tests for audit pipeline (AC: #1, NFR-09)
  - [ ] 14.1 Queue consumer deserializes event, writes to `audit_events`, confirms sequence continuity (PostgreSQL only — Lesson #7)
  - [ ] 14.2 Queue consumer on duplicate `sequence_number` routes to DLQ (not crash)
  - [ ] 14.3 Queue consumer on DB connection error retries with backoff
  - [ ] 14.4 Queue consumer after 3 retries routes to DLQ
  - [ ] 14.5 `stream_debate()` emits `DEBATE_STARTED` event on first turn
  - [ ] 14.6 `stream_debate()` emits `GUARDIAN_ANALYSIS` event per guardian invocation with risk metadata
  - [ ] 14.7 Debate continues even if audit write fails (engine never blocks on audit)
  - [ ] 14.8 Only `is_redacted=True` sanitization results produce `SANITIZATION` events

- [ ] 15. Backend tests for admin auth (AC: #1)
  - [ ] 15.1 Create `authenticated_admin_user` fixture in `tests/conftest.py` — creates user with `is_superuser=True`, returns JWT headers
  - [ ] 15.2 Test non-admin user gets 403 on `/api/admin/*`
  - [ ] 15.3 Test unauthenticated user gets 401 on `/api/admin/*`
  - [ ] 15.4 Test expired token gets 401 (not 403)
  - [ ] 15.5 Test admin user gets 200 on `/api/admin/me`

- [ ] 16. Backend tests for admin API endpoints (AC: #1, #2)
  - [ ] 16.1 `tests/routes/test_admin.py` — test all admin endpoints
  - [ ] 16.2 Test `GET /api/admin/debates` pagination, sorting, filtering
  - [ ] 16.3 Test `GET /api/admin/audit-events` with `event_type`, `actor`, date range filters
  - [ ] 16.4 Test `GET /api/admin/audit-events` with `created_after > created_before` returns 400
  - [ ] 16.5 Test `POST /api/admin/debates/{id}/hallucination-flags` creation (including 404 for missing debate, UUID validation)
  - [ ] 16.6 Test `PATCH /api/admin/hallucination-flags/{id}` status update (state transitions)
  - [ ] 16.7 Test duplicate hallucination flag returns 409 or idempotent 200
  - [ ] 16.8 Test all responses use standard envelope format `{ data, error, meta }`
  - [ ] 16.9 Test pagination boundary: request page beyond available data returns empty array

- [ ] 17. Data model and migration tests (AC: #1)
  - [ ] 17.1 `tests/test_audit_models.py` — test `AuditEvent`, `HallucinationFlag` CRUD with PostgreSQL (Lesson #7)
  - [ ] 17.2 Test cascade delete: deleting a debate removes all audit_events and hallucination_flags
  - [ ] 17.3 Test `UNIQUE(debate_id, sequence_number)` constraint enforcement
  - [ ] 17.4 Migration smoke test: verify migration uses `CONCURRENTLY` and `audit_enabled` flag defaults to `False`
  - [ ] 17.5 Legacy marker test: existing debates get seq 0 `LEGACY_DEBATE_MIGRATION` event

- [ ] 18. JSONB query correctness tests
  - [ ] 18.1 Insert 500+ rows with varied payloads, query `WHERE payload @> '{"event_type": "GUARDIAN_ANALYSIS", "risk_level": "high"}'`, assert query plan uses GIN index
  - [ ] 18.2 Query `WHERE payload->>'risk_level' = 'high'` ordered by `sequence_number`, assert correct chronological ordering

### Phase 7: Quality Gates (6.1a)

- [ ] 19. Run all quality gates before marking 6.1a complete
  - [ ] 19.1 `ruff check .` — fix all errors (Lesson #9: remove unused imports)
  - [ ] 19.2 `ruff format .` — ensure formatting
  - [ ] 19.3 `.venv/bin/python -m pytest` — all backend tests pass (25 tests: 6 unit + 8 integration + 5 API + 3 reconciliation + 1 migration + 2 JSONB query)
  - [ ] 19.4 Manual verification: run migration against test DB with feature flag off → flip flag on → run a debate → verify `audit_events` table populated

---

## Story 6.1b — Frontend Admin Dashboard + Observability

*Depends on 6.1a being shipped and validated.*

### Phase 8: Frontend — Admin Pages

- [ ] 20. Create admin route protection (AC: #1)
  - [ ] 20.1 Create `nextjs-frontend/middleware.ts` — redirect unauthenticated users from `/admin/*` to `/login`. Matcher: `["/admin/:path*"]`. Note: this is UX-only protection; real enforcement is backend `current_superuser` dependency
  - [ ] 20.2 Create `nextjs-frontend/app/admin/layout.tsx` — Server Component that calls `GET /api/admin/me` using `cookies()` from `next/headers` to forward session cookie (FastAPI session cookie does NOT auto-forward from Server Components). If 403, redirect to `/dashboard`. If 200, render admin layout with sidebar

- [ ] 21. Create admin debates list page (AC: #1)
  - [ ] 21.1 Create `nextjs-frontend/app/admin/debates/page.tsx` — paginated data table of debates
  - [ ] 21.2 Table columns: Asset, Status, Created, Guardian Verdict, Audit Events, Risk Score (derived), Actions
  - [ ] 21.3 Risk score badge: icon + text (dual-coding, not color alone) — green=low, yellow=medium, orange=high, red=critical. Use `text-slate-400` minimum, `border-white/15` minimum (Lesson #24)
  - [ ] 21.4 Sorting: click column headers. Default sort by created_at DESC
  - [ ] 21.5 Filtering: status dropdown, risk_level dropdown
  - [ ] 21.6 Pagination: page controls with configurable page_size. Named constant: `export const ADMIN_DEBATES_PAGE_SIZE = 20`
  - [ ] 21.7 Row click → navigate to `/admin/debates/[id]`

- [ ] 22. Create admin debate detail page (AC: #1, #2)
  - [ ] 22.1 Create `nextjs-frontend/app/admin/debates/[id]/page.tsx` — Server Component that fetches debate detail + audit events. Pass as props to Client Component tabs
  - [ ] 22.2 Tab 1: Debate Overview — metadata, transcript summary, guardian verdict, trading analysis
  - [ ] 22.3 Tab 2: Audit Events — chronological list of all audit events by `sequence_number`, with event-type-specific rendering (sanitization shows redacted phrases, guardian shows risk level + fallacy)
  - [ ] 22.4 Tab 3: Hallucination Flags — existing flags + "Flag as Hallucination" button per argument
  - [ ] 22.5 Component must stay under 300 lines (Lesson #14). Extract tab content into separate components

- [ ] 23. Create hallucination flagging UI (AC: #2, Journey-Req-3)
  - [ ] 23.1 "Flag as Hallucination" action on each argument in the transcript view (Tab 3)
  - [ ] 23.2 Clicking flag opens Shadcn `Dialog` with `onInteractOutside` prevented. Fields: message_snippet (pre-filled), notes textarea, confirm/cancel
  - [ ] 23.3 On confirm: `POST /api/admin/debates/{id}/hallucination-flags` → success toast (`aria-live="polite"`)
  - [ ] 23.4 Flagged messages show red "Flagged" badge (icon + text)
  - [ ] 23.5 Flags list page at `/admin/flags` — table with status, debate link, actions (confirm/dismiss)

- [ ] 24. Create admin audit log page (AC: #1)
  - [ ] 24.1 Create `nextjs-frontend/app/admin/logs/page.tsx` — global audit event log viewer
  - [ ] 24.2 Filter by event_type, actor, date range
  - [ ] 24.3 Summary cards: Total Debates, High/Critical Guardian Analyses, Total Sanitization Events, DLQ Entries

### Phase 9: Frontend — Bundle Isolation

- [ ] 25. Enforce bundle isolation for admin features
  - [ ] 25.1 Admin components live in `features/admin/` — MUST NOT import from `features/debate/` components that transitively depend on React Query debate caches, WebSocket hooks, Zustand stores, or `@xyflow/react` (Lesson #21)
  - [ ] 25.2 Admin pages use their own query keys: `features/admin/hooks/queryKeys.ts` (Lesson #12)
  - [ ] 25.3 Admin API client in `features/admin/api.ts` — separate from debate API client

### Phase 10: Frontend Tests

- [ ] 26. Frontend tests for admin pages (AC: #1, #2)
  - [ ] 26.1 Unit tests for admin API client functions (`features/admin/api.ts`)
  - [ ] 26.2 Unit tests for admin data table component with MSW mock handlers
  - [ ] 26.3 Unit tests for hallucination flag dialog (open → fill → submit → success toast; cancel → no API call; validation errors)
  - [ ] 26.4 Use `renderWithProviders()` from shared test utility (Epic 5 retro AI-2). If not yet created, create it first
  - [ ] 26.5 Use shared `queryKeys` factory in tests — never inline keys (Lesson #12)

### Phase 11: Observability

- [ ] 27. Add observability for audit pipeline (AC: #1, NFR-09)
  - [ ] 27.1 Structured logging: `audit.event_written` at INFO, `audit.dlq_capture` at WARNING, `audit.reconciliation_complete` at INFO
  - [ ] 27.2 Prometheus counters: `audit_events_written_total` (by event_type), `audit_dlq_entries_total`, `audit_reconciliation_gaps_found_total`
  - [ ] 27.3 Histogram: `audit_write_latency_seconds` (track async queue write latency)
  - [ ] 27.4 Admin-visible health check: `GET /api/admin/audit/health` — returns `{"last_event_at": "...", "queue_depth": N, "dlq_pending": N}`. If `last_event_at` is stale (> 5 min during active debates), flag as degraded

### Phase 12: Quality Gates (6.1b)

- [ ] 28. Run all quality gates before marking 6.1b complete
  - [ ] 28.1 `ruff check .` — fix all errors
  - [ ] 28.2 `ruff format .` — ensure formatting
  - [ ] 28.3 `.venv/bin/python -m pytest` — all backend tests pass
  - [ ] 28.4 `npm run lint && npx tsc --noEmit` — frontend lint and typecheck
  - [ ] 28.5 `npm run test` — all frontend tests pass
  - [ ] 28.6 Manual verification: `docker-compose up -d --build` → visit `/admin/debates` → verify data loads, flag a hallucination

---

## Dev Notes

### Architecture Context

This story implements **Journey 3: The Hallucination Hunt** (PRD Journey-Req-3) and **NFR-09 (Tamper-Evidence)**.

**Adversarial Review Consensus (2026-04-18):** This story was reviewed by Winston (Architect), Amelia (Dev), Murat (Test Architect), and Dr. Quinn (Problem Solver). All 12 consensus positions below were signed off by all agents.

### Adversarial Review — 12 Consensus Positions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **2-way split:** 6.1a (Infrastructure + Write Path) + 6.1b (Integration + Frontend + Observability) | Natural seam at write-path vs read-path. 3-way adds coordination overhead with no standalone value. |
| 2 | **2-table schema:** `audit_events` (JSONB payload) + `hallucination_flags` (relational) | JSONB handles heterogeneous event types without schema migrations. Flags are admin-authored and deserve their own table. `event_type` discriminator replaces separate SanitizationEvent/GuardianAnalysis tables. |
| 3 | **`sequence_number BIGINT`** with `UNIQUE(debate_id, sequence_number)` | Tamper-evidence via gap detection. AuditWriter assigns via `INSERT ... SELECT MAX()+1`. UNIQUE is the safety net. |
| 4 | **Async write-behind queue** (`asyncio.Queue` + background consumer) | Decouples audit latency from debate engine latency. Batch flush on count/time threshold. No Redis dependency. |
| 5 | **Dead Letter Queue + reconciliation job** required | try/except alone violates NFR-09. Failed writes → DLQ table. Reconciliation replays via DirectAuditWriter. Gap detection via sequence_number. |
| 6 | **`AuditWriter` protocol** — `QueuedAuditWriter` (prod) + `DirectAuditWriter` (DLQ/testing) | Decouples `stream_debate()` from persistence. Lives in `app/services/audit/writer.py`. Testable via mock injection. |
| 7 | **Alembic: `CREATE INDEX CONCURRENTLY`** with autocommit block | Standard `op.create_index()` wraps in transaction — fails with CONCURRENTLY. Use `op.execute()` with autocommit. |
| 8 | **Observability in 6.1b** — counters for events written, DLQ entries, queue depth; histogram for write latency | Silent audit failure is #1 risk. Observability makes failures visible. Admin health endpoint. |
| 9 | **No new infrastructure** — audit trail uses existing PostgreSQL only | No Redis, no message broker. In-process queue + same DB. |
| 10 | **Feature flag** for audit enablement | Deploy code with flag off → run migration → flip flag on. Zero-downtime. Handles in-progress debates. |
| 11 | **25-test plan** — 6 unit + 8 integration + 5 API + 3 reconciliation + 1 migration + 2 JSONB query | Risk-weighted allocation. Integration tests cover async pipeline failure modes. PostgreSQL-only per Lesson #7. |
| 12 | **Legacy marker** at sequence_number 0 for pre-audit debates | Honest marker, not fabricated history. Reconciliation skips gap detection for pre-audit debates. |

### Key Architectural Decision: The NFR-09 Contradiction Resolution

The original story specified try/except-wrapped synchronous DB writes in the debate engine. The adversarial review identified a **fundamental contradiction**:

- **Requirement A:** Audit writes must NEVER block or fail the debate engine
- **Requirement B:** Audit trail must be tamper-evident (NFR-09)

try/except resolves A but violates B (silent gaps in audit trail). The resolution uses **separation in time**: tamper-evidence at *verification-time* (reconciliation + gap detection), not at *write-time* (synchronous writes). The pipeline is:

1. Engine emits event to async queue (non-blocking)
2. Background consumer writes to DB in batches
3. Failures → DLQ table (synchronous fallback)
4. Reconciliation job detects gaps in `sequence_number`
5. Admin health endpoint shows pipeline status

### Audit Event Payload Examples

**Sanitization event** (`event_type='SANITIZATION'`, `actor='bull'`):
```json
{
  "turn": 3,
  "redacted_phrases": ["guaranteed", "risk-free"],
  "redaction_ratio": 0.12,
  "original_length": 1200
}
```

**Guardian analysis event** (`event_type='GUARDIAN_ANALYSIS'`, `actor='guardian'`):
```json
{
  "turn": 3,
  "analyzing_agent": "bull",
  "should_interrupt": true,
  "risk_level": "high",
  "fallacy_type": "overconfidence",
  "reason": "Bull claims 'guaranteed upside' without supporting data",
  "summary_verdict": "High Risk",
  "safe": false,
  "detailed_reasoning": "..."
}
```

**Note on field names:** `should_interrupt` (NOT `intervention_needed`), `reason` (NOT `reasoning`). There is NO `intervention_needed` or `reasoning` field. (AGENTS.md Lesson #4)

### Key File Locations (Backend)

| Purpose | Path |
|---------|------|
| SQLAlchemy models | `trade-app/fastapi_backend/app/models.py` |
| AuditWriter protocol + impls | `trade-app/fastapi_backend/app/services/audit/writer.py` |
| DLQ service | `trade-app/fastapi_backend/app/services/audit/dlq.py` |
| Reconciliation job | `trade-app/fastapi_backend/app/services/audit/reconciliation.py` |
| Admin schemas | `trade-app/fastapi_backend/app/services/debate/admin_schemas.py` |
| Admin routes | `trade-app/fastapi_backend/app/routes/admin.py` |
| User auth | `trade-app/fastapi_backend/app/users.py` |
| Router registration | `trade-app/fastapi_backend/app/main.py` |
| Debate engine | `trade-app/fastapi_backend/app/services/debate/engine.py` |
| Sanitization layer | `trade-app/fastapi_backend/app/services/debate/sanitization.py` |
| Guardian agent | `trade-app/fastapi_backend/app/services/debate/agents/guardian.py` |
| Config | `trade-app/fastapi_backend/app/config.py` |
| Seed script | `trade-app/fastapi_backend/seed_test_user.py` |
| Migrations | `trade-app/fastapi_backend/alembic_migrations/versions/` |
| Tests | `trade-app/fastapi_backend/tests/` |

### Key File Locations (Frontend)

| Purpose | Path |
|---------|------|
| Admin pages | `trade-app/nextjs-frontend/app/admin/` |
| Admin feature components | `trade-app/nextjs-frontend/features/admin/components/` |
| Admin hooks + queryKeys | `trade-app/nextjs-frontend/features/admin/hooks/` |
| Admin API client | `trade-app/nextjs-frontend/features/admin/api.ts` |
| Middleware | `trade-app/nextjs-frontend/middleware.ts` |
| Test factories | `trade-app/nextjs-frontend/tests/support/factories/index.ts` (has `createAdminUser()`) |

### Critical Architecture Patterns

1. **Response Envelope**: ALL admin endpoints use `{ "data": ..., "error": null, "meta": { "latency_ms": ... } }`.

2. **Pydantic camelCase Bridge**: Admin schemas use `alias_generator=camelize` + `populate_by_name=True`.

3. **Router Pattern**: Admin router at `app/routes/admin.py` with `Depends(current_superuser)` at router level.

4. **Pagination**: `fastapi-pagination` already configured. Use for all list endpoints.

5. **Engine Integration — NEVER BLOCK**: The engine calls `audit_writer.write(event)` which enqueues to async queue. If queue is full, falls to DLQ. The debate NEVER waits for a DB write. This is the highest-risk integration point.

6. **WebSocket action prefix**: ALL actions use `DEBATE/` prefix. There are NO `GUARDIAN/` prefixed actions. (Lesson #3)

7. **Frontend — No Next.js API routes**: Frontend is pure consumer of FastAPI. Admin pages are Server Components that call FastAPI admin endpoints using `cookies()` from `next/headers`.

8. **Frontend — Shadcn Dialog**: Hallucination flag dialog uses Shadcn `Dialog` with explicit dismissal (`onInteractOutside` prevented).

9. **Bundle isolation**: Admin features (`features/admin/`) MUST NOT import from `features/debate/` components that pull in React Query debate caches, WebSocket hooks, Zustand stores, or `@xyflow/react`. (Lesson #21)

10. **Dark mode contrast**: Use `text-slate-400` minimum (NOT `text-slate-500`), `border-white/15` minimum (NOT `border-white/10`). (Lesson #24)

11. **Component size**: Any component exceeding 300 lines MUST be decomposed. (Lesson #14)

### Dashboard Query Patterns

Audit events by risk level:
```sql
SELECT d.id, d.asset, d.guardian_verdict,
       COUNT(*) FILTER (WHERE ae.event_type = 'GUARDIAN_ANALYSIS') as total_analyses,
       COUNT(*) FILTER (WHERE ae.payload->>'should_interrupt' = 'true') as interrupts,
       COUNT(*) FILTER (WHERE ae.payload->>'risk_level' = 'critical') as critical_count
FROM debates d
JOIN audit_events ae ON ae.debate_id = d.id
GROUP BY d.id
ORDER BY critical_count DESC
LIMIT 20;
```

Top forbidden phrases:
```sql
SELECT phrase, COUNT(*) as count
FROM audit_events ae, jsonb_array_elements_text(ae.payload->'redacted_phrases') AS phrase
WHERE ae.event_type = 'SANITIZATION'
GROUP BY phrase
ORDER BY count DESC
LIMIT 10;
```

Gap detection:
```sql
SELECT debate_id, sequence_number as gap_start,
       lead(sequence_number) OVER (PARTITION BY debate_id ORDER BY sequence_number) - 1 as gap_end
FROM audit_events
WHERE event_type != 'LEGACY_DEBATE_MIGRATION'
  AND event_type != 'RECONCILIATION_GAP_FILL'
  AND lead(sequence_number) OVER (PARTITION BY debate_id ORDER BY sequence_number) - sequence_number > 1;
```

### Accessibility Checklist for Admin Pages

- All interactive elements ≥ 44px touch targets
- Data tables use semantic `<table>` with `<thead>`, `<th>` scope
- Risk level badges use icon + text (not color alone — dual-coding)
- `aria-live="polite"` for toast notifications on flag actions
- Keyboard navigation: Tab through table rows, Enter to open detail, Escape to close dialogs
- `useReducedMotion()` respected for any animations

### References

- [Source: `_bmad-output/implementation-artifacts/6-0-spike-admin-auth-design.md` — Admin auth design]
- [Source: `_bmad-output/implementation-artifacts/6-0-spike-hallucination-log-data-model.md` — Original data model (SUPERSEDED by 2-table JSONB consensus)]
- [Source: `_bmad-output/implementation-artifacts/6-0-spike-sanitization-knowledge-transfer.md` — Sanitization + Guardian walkthrough]
- [Source: `_bmad-output/implementation-artifacts/epic-5-retro-2026-04-18.md` — Epic 6 prep checklist]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Journey 3, NFR-09, Journey-Req-3]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 stories]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Auth, API patterns, naming conventions]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
