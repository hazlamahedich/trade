# Story 6.1b: Frontend Admin Dashboard + Observability

Status: backlog
Parent: 6-1-admin-dashboard-logs-hallucinations.md
Depends on: 6-1a-audit-infrastructure-write-path (MUST be shipped and validated first)
Split from: original 6.1 (164 subtasks, exceeded Lesson #23 threshold)

## Story

As a Compliance Officer,
I want to view a table of all debates and flag hallucinations via a web UI,
So that we can improve the system and remove dangerous content.

## Acceptance Criteria

1. **Given** a staff user
   **When** loading `/admin/debates`
   **Then** I see a paginated table of recent debates with "Risk Score" columns

2. **Given** a specific debate
   **When** I flag a message as "Hallucination"
   **Then** it is marked in the DB (Journey-Req-3) and added to the "Negative Examples" dataset

---

> **PREREQUISITE:** Story 6.1a must be complete — all backend endpoints, models, and migrations must be shipped and verified before starting this story.

---

## Tasks / Subtasks

### Phase 1: Frontend — Admin Route Protection

- [ ] 1. Create admin route protection (AC: #1)
  - [ ] 1.1 Create `nextjs-frontend/middleware.ts` — redirect unauthenticated users from `/admin/*` to `/login`. Matcher: `["/admin/:path*"]`. Note: this is UX-only protection; real enforcement is backend `current_superuser` dependency
  - [ ] 1.2 Create `nextjs-frontend/app/admin/layout.tsx` — Server Component that calls `GET /api/admin/me` using `cookies()` from `next/headers` to forward session cookie (FastAPI session cookie does NOT auto-forward from Server Components). If 403, redirect to `/dashboard`. If 200, render admin layout with sidebar. Add loading/error state handling for slow or unreachable backend.

### Phase 2: Frontend — Admin Pages

- [ ] 2. Scaffold `features/admin/` directory structure (AC: #1)
  - [ ] 2.1 Create `nextjs-frontend/features/admin/components/` directory
  - [ ] 2.2 Create `nextjs-frontend/features/admin/hooks/` directory
  - [ ] 2.3 Create `nextjs-frontend/features/admin/hooks/queryKeys.ts` — admin-specific query key factory (Lesson #12: shared factory, never inline keys)
  - [ ] 2.4 Create `nextjs-frontend/features/admin/api.ts` — admin API client, separate from debate API client (Lesson #21: bundle isolation)

- [ ] 3. Create admin debates list page (AC: #1)
  - [ ] 3.1 Create `nextjs-frontend/app/admin/debates/page.tsx` — paginated data table of debates
  - [ ] 3.2 Table columns: Asset, Status, Created, Guardian Verdict, Audit Events, Risk Score (derived), Actions
  - [ ] 3.3 Risk score badge: icon + text (dual-coding, not color alone) — green=low, yellow=medium, orange=high, red=critical. Use `text-slate-400` minimum, `border-white/15` minimum (Lesson #24)
  - [ ] 3.4 Sorting: click column headers. Default sort by created_at DESC
  - [ ] 3.5 Filtering: status dropdown, risk_level dropdown
  - [ ] 3.6 Pagination: page controls with configurable page_size. Named constant: `export const ADMIN_DEBATES_PAGE_SIZE = 20` (Lesson #17)
  - [ ] 3.7 Row click → navigate to `/admin/debates/[id]`

- [ ] 4. Create admin debate detail page (AC: #1, #2)
  - [ ] 4.1 Create `nextjs-frontend/app/admin/debates/[id]/page.tsx` — Server Component that fetches debate detail + audit events. Pass as props to Client Component tabs
  - [ ] 4.2 Tab 1: Debate Overview — metadata, transcript summary, guardian verdict, trading analysis
  - [ ] 4.3 Tab 2: Audit Events — chronological list of all audit events by `sequence_number`, with event-type-specific rendering (sanitization shows redacted phrases, guardian shows risk level + fallacy)
  - [ ] 4.4 Tab 3: Hallucination Flags — existing flags + "Flag as Hallucination" button per argument
  - [ ] 4.5 Component must stay under 300 lines (Lesson #14). Extract tab content into separate components under `features/admin/components/`

- [ ] 5. Create hallucination flagging UI (AC: #2, Journey-Req-3)
  - [ ] 5.1 "Flag as Hallucination" action on each argument in the transcript view (Tab 3)
  - [ ] 5.2 Clicking flag opens Shadcn `Dialog` with `onInteractOutside` prevented. Fields: message_snippet (pre-filled), notes textarea, confirm/cancel
  - [ ] 5.3 On confirm: `POST /api/admin/debates/{id}/hallucination-flags` → success toast (`aria-live="polite"`)
  - [ ] 5.4 Flagged messages show red "Flagged" badge (icon + text)
  - [ ] 5.5 Flags list page at `/admin/flags` — table with status, debate link, actions (confirm/dismiss)

- [ ] 6. Create admin audit log page (AC: #1)
  - [ ] 6.1 Create `nextjs-frontend/app/admin/logs/page.tsx` — global audit event log viewer
  - [ ] 6.2 Filter by event_type, actor, date range
  - [ ] 6.3 Summary cards: Total Debates, High/Critical Guardian Analyses, Total Sanitization Events, DLQ Entries

### Phase 3: Frontend — Bundle Isolation

- [ ] 7. Enforce bundle isolation for admin features (AC: #1)
  - [ ] 7.1 Admin components live in `features/admin/` — MUST NOT import from `features/debate/` components that transitively depend on React Query debate caches, WebSocket hooks, Zustand stores, or `@xyflow/react` (Lesson #21)
  - [ ] 7.2 Admin pages use their own query keys from `features/admin/hooks/queryKeys.ts` (Lesson #12)
  - [ ] 7.3 Admin API client in `features/admin/api.ts` — separate from debate API client

### Phase 4: Frontend Tests

- [ ] 8. Frontend tests for admin pages (AC: #1, #2)
  - [ ] 8.1 Unit tests for admin API client functions (`features/admin/api.ts`)
  - [ ] 8.2 Unit tests for admin data table component with MSW mock handlers
  - [ ] 8.3 Unit tests for hallucination flag dialog (open → fill → submit → success toast; cancel → no API call; validation errors)
  - [ ] 8.4 Use `renderWithProviders()` from shared test utility. **NOTE:** This utility does NOT exist yet. Create it first in `tests/support/renderWithProviders.tsx` — a wrapper that provides QueryClientProvider + any required context providers. Existing tests in `tests/unit/` use ad-hoc wrappers; consolidate into this shared utility.
  - [ ] 8.5 Use shared `queryKeys` factory from `features/admin/hooks/queryKeys.ts` in tests — never inline keys (Lesson #12)

### Phase 5: Observability

- [ ] 9. Add observability for audit pipeline (AC: #1, NFR-09)
  - [ ] 9.1 Structured logging: `audit.event_written` at INFO, `audit.dlq_capture` at WARNING, `audit.reconciliation_complete` at INFO
  - [ ] 9.2 Admin-visible health check: `GET /api/admin/audit/health` — returns `{"last_event_at": "...", "queue_depth": N, "dlq_pending": N}`. If `last_event_at` is stale (> 5 min during active debates), flag as degraded
  - [ ] 9.3 **NOTE on Prometheus:** No `prometheus-client` dependency exists in the codebase. For v1, use structured logging only. Prometheus counters/metrics are deferred to a future story when observability infrastructure is added.

### Phase 6: Quality Gates (6.1b)

- [ ] 10. Run all quality gates before marking 6.1b complete
  - [ ] 10.1 `ruff check .` — fix all errors
  - [ ] 10.2 `ruff format .` — ensure formatting
  - [ ] 10.3 `.venv/bin/python -m pytest` — all backend tests pass (including 6.1a tests)
  - [ ] 10.4 `npm run lint && npx tsc --noEmit` — frontend lint and typecheck
  - [ ] 10.5 `npm run test` — all frontend tests pass
  - [ ] 10.6 Manual verification: `docker-compose up -d --build` → visit `/admin/debates` → verify data loads, flag a hallucination

---

## Dev Notes

### Bundle Isolation (Critical)

Admin features in `features/admin/` MUST NOT import from `features/debate/` components that transitively depend on:
- React Query debate caches
- WebSocket hooks
- Zustand stores
- `@xyflow/react`

(Lesson #21 — public pages must be lean; admin pages have the same isolation requirement)

### Frontend Accessibility Checklist (Mandatory)

- All interactive elements ≥ 44px touch targets
- Data tables use semantic `<table>` with `<thead>`, `<th>` scope
- Risk level badges use icon + text (not color alone — dual-coding)
- `aria-live="polite"` for toast notifications on flag actions
- Keyboard navigation: Tab through table rows, Enter to open detail, Escape to close dialogs
- `useReducedMotion()` respected for any animations
- Component size: Any component exceeding 300 lines MUST be decomposed (Lesson #14)
- Dark mode contrast: `text-slate-400` minimum (NOT `text-slate-500`), `border-white/15` minimum (NOT `border-white/10`) (Lesson #24)

### Frontend — No Next.js API Routes

Frontend is pure consumer of FastAPI. Admin pages are Server Components that call FastAPI admin endpoints using `cookies()` from `next/headers`. No Next.js API routes for business logic.

### Shadcn Dialog Pattern

Hallucination flag dialog uses Shadcn `Dialog` with explicit dismissal (`onInteractOutside` prevented).

### Shared Test Utility

`renderWithProviders()` must be created in `tests/support/renderWithProviders.tsx`. It should wrap components with `QueryClientProvider` and any required context. The `createAdminUser()` factory already exists in `tests/support/factories/index.ts`.

### Key File Locations (Frontend)

| Purpose | Path |
|---------|------|
| Admin pages | `trade-app/nextjs-frontend/app/admin/` |
| Admin feature components | `trade-app/nextjs-frontend/features/admin/components/` |
| Admin hooks + queryKeys | `trade-app/nextjs-frontend/features/admin/hooks/` |
| Admin API client | `trade-app/nextjs-frontend/features/admin/api.ts` |
| Middleware | `trade-app/nextjs-frontend/middleware.ts` |
| Test factories (has `createAdminUser()`) | `trade-app/nextjs-frontend/tests/support/factories/index.ts` |
| Shared render utility (CREATE THIS) | `trade-app/nextjs-frontend/tests/support/renderWithProviders.tsx` |

### Key File Locations (Backend — already created in 6.1a)

| Purpose | Path |
|---------|------|
| Admin routes | `trade-app/fastapi_backend/app/routes/admin.py` |
| Admin schemas | `trade-app/fastapi_backend/app/services/debate/admin_schemas.py` |
| Audit health endpoint | `trade-app/fastapi_backend/app/routes/admin.py` (add to existing) |

### References

- [Source: `_bmad-output/implementation-artifacts/6-0-spike-admin-auth-design.md` — Frontend middleware + layout pattern]
- [Source: `_bmad-output/implementation-artifacts/6-0-spike-sanitization-knowledge-transfer.md` — Sanitization + Guardian field names]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Journey 3, Journey-Req-3]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 stories]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Frontend patterns, no API routes]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
