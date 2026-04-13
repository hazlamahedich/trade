# Story 4.2: Debate History Page (The Archive)

Status: ready-for-dev

## Story

As a User,
I want to browse past debates by asset or outcome,
So that I can learn from previous market situations.

## Acceptance Criteria

1. **AC-1: Paginated debate list** — Given the History Page, When I load it, Then I see a paginated list of past debates with clear "Winner" badges (derived from vote breakdown or Guardian verdict).
2. **AC-2: Asset filter** — Given the list, When I filter by "ETH" or "BTC", Then the list updates to show only matching debates.
3. **AC-3: Outcome filter** — Given the list, When I filter by "Bull Wins" or "Bear Wins", Then the list updates to show only debates where that side won (by vote majority or Guardian verdict).
4. **AC-4: Navigate to detail** — Given a debate card, When clicked, Then it navigates to the static detail page for that debate (route will be implemented in Story 4.3; for now navigate to `/dashboard/debates/[externalId]` showing a summary).
5. **AC-5: Standard envelope** — All API responses use the project's `{ data, error, meta }` envelope pattern.
6. **AC-6: Mobile-first** — The page renders correctly in portrait mode (single column, thumb-zone navigation).
7. **AC-7: Dual empty states** — When no debates match active filters, show a "No debates match your filters" message with clear-filters CTA. When no debates exist at all, show a "No debates yet" message.
8. **AC-8: Loading state** — While fetching debate history, show skeleton cards matching the card layout dimensions (Shadcn `Skeleton`).
9. **AC-9: Error state** — When the API call fails, show an error message with a retry CTA.
10. **AC-10: Active filter chips** — When filters are applied, show dismissible chips above the card list showing active filters. Each chip is tappable to remove that filter.

## Tasks / Subtasks

### Backend

- [ ] Task 1: Create `DebateHistoryItem` schema (AC: #1, #5)
  - [ ] 1.1 Add `DebateHistoryItem` Pydantic model to `app/services/debate/schemas.py` with fields: `external_id` (serialization_alias="externalId"), `asset`, `status`, `guardian_verdict` (alias="guardianVerdict"), `guardian_interrupts_count` (alias="guardianInterruptsCount"), `total_votes` (alias="totalVotes"), `vote_breakdown` (alias="voteBreakdown", type `dict[str, int]`), `winner` (derived: "bull"|"bear"|"undecided"), `created_at` (alias="createdAt"), `completed_at` (alias="completedAt")
  - [ ] 1.2 Use explicit `Field(serialization_alias=...)` for camelCase output on EVERY field that needs it. Use `ConfigDict(populate_by_name=True)`. Follow the exact pattern in `vote_schemas.py` — do NOT use `alias_generator=to_camel` (inconsistent with codebase convention).
  - [ ] 1.3 Add `DebateHistoryMeta` with pagination metadata: `page` (int), `size` (int), `total` (int), `pages` (int). All with camelCase serialization aliases.
  - [ ] 1.4 Add `StandardDebateHistoryResponse` envelope schema: `data: list[DebateHistoryItem]`, `error: Optional[ErrorBody]`, `meta: DebateHistoryMeta`. Same envelope shape as `StandardDebateResponse`.

- [ ] Task 2: Add `get_filtered_debates` repository method with inline winner derivation (AC: #1, #2, #3)
  - [ ] 2.1 In `app/services/debate/repository.py`, add `get_filtered_debates(page, size, asset, outcome)` async method — this is the named contract method for winner derivation
  - [ ] 2.2 Build filtered query on `Debate` model: filter by `status="completed"`, optional `asset`
  - [ ] 2.3 Use inline `LEFT JOIN LATERAL` subquery with `COUNT(*) FILTER (WHERE choice = 'bull'/'bear')` to compute vote counts per debate
  - [ ] 2.4 Derive `winner` inline using SQL `CASE` (majority wins; tie → "undecided"; zero votes → "undecided")
  - [ ] 2.5 Apply outcome filter via `WHERE` on the derived `winner` field (SQL-level, NOT Python post-filter)
  - [ ] 2.6 Order by `created_at DESC` (newest first)
  - [ ] 2.7 Use offset/limit pagination with total count — verify `COUNT` is correct with the subquery
  - [ ] 2.8 Add database index: `CREATE INDEX idx_vote_debate_choice ON vote(debate_id, choice)` in a migration

- [ ] Task 3: Create `GET /api/debate/history` route (AC: #1, #2, #3, #5)
  - [ ] 3.1 In `app/routes/debate.py`, add `GET /api/debate/history` endpoint
  - [ ] 3.2 Accept query params: `page: int = 1`, `size: int = 20`, `asset: Optional[str]`, `outcome: Optional[str]` ("bull"|"bear"|"undecided")
  - [ ] 3.3 Validate `asset` against `SUPPORTED_ASSETS` if provided
  - [ ] 3.4 Validate `outcome` against valid choices if provided
  - [ ] 3.5 Call `DebateRepository.get_filtered_debates(...)` and return `StandardDebateHistoryResponse`

### Frontend

- [ ] Task 4: Create API client for debate history (AC: #5)
  - [ ] 4.1 Create `features/debate/api/debate-history.ts` with typed fetch functions
  - [ ] 4.2 Define `DebateHistoryItem`, `DebateHistoryResponse` TypeScript interfaces matching backend schema. **IMPORTANT:** No debate types exist in `types.gen.ts` — these must be manually defined, not imported from the auto-generated client.
  - [ ] 4.3 Create `fetchDebateHistory(params)` function. Since no auto-generated SDK exists for debate history, use raw `fetch()` against the FastAPI backend URL from `lib/clientConfig.ts` — do NOT try to import from `@/app/clientService`.
  - [ ] 4.4 Create `"use server"` action in `features/debate/actions/debate-history-action.ts` following the cookie/token pattern from `components/actions/items-action.ts`, but using raw `fetch()` instead of auto-generated SDK calls.

- [ ] Task 5: Create history page components (AC: #1, #2, #3, #6, #7, #8, #9, #10)
  - [ ] 5.1 Create `features/debate/components/DebateHistoryCard.tsx` — card showing asset badge, winner badge (Bull/Bear/Undecided with color + icon + text for dual-coding), vote split bar, date, guardian verdict summary. Card background: `bg-white/5` with `hover:bg-white/8` for dark mode separation.
  - [ ] 5.2 Create `features/debate/components/DebateHistoryFilters.tsx` — asset select (BTC/ETH/SOL/All) + outcome select (Bull Wins/Bear Wins/All) + clear filters button
  - [ ] 5.3 Create `features/debate/components/DebateHistoryEmpty.tsx` — two distinct empty states: (a) filtered-empty: "No debates match your filters" + clear-filters CTA, (b) true-empty: "No debates yet" message. Functional-only (text + icon, no illustrations).
  - [ ] 5.4 Create `features/debate/components/DebateVoteBar.tsx` — mini horizontal bar showing bull/bear vote split (reusable). **NOTE:** The component name is `DebateVoteBar` (NOT `DebateHistoryVoteBar`) — this is the canonical name used in tasks and references.
  - [ ] 5.5 Create `features/debate/components/DebateHistoryFilterChips.tsx` — dismissible chips showing active filters above the card list. Each chip tappable to remove. Uses "×" dismiss pattern.
  - [ ] 5.6 Create `features/debate/components/DebateHistorySkeleton.tsx` — skeleton loading cards matching DebateHistoryCard dimensions. Show 6-8 skeleton cards during fetch. Use Shadcn `Skeleton`.
  - [ ] 5.7 Create `features/debate/components/DebateHistoryError.tsx` — error state component with "Could not load debates" message + retry CTA.
  - [ ] 5.8 Add all new components to `features/debate/components/index.ts` barrel export
  - [ ] 5.9 Use Shadcn `Badge` for winner badge, `Select` for filters, `Card` for card layout. **PREREQUISITE:** Run `npx shadcn@latest add skeleton` before Task 5.6 — the `Skeleton` component does NOT exist yet and must be installed.

- [ ] Task 5.10: Parameterize `PagePagination` for filter preservation (AC: #2, #3, #10)
  - [ ] 5.10.1 `PagePagination`'s `buildUrl()` only preserves `page` and `size` params — it drops `asset` and `outcome` filter params on pagination navigation. Extend `PagePagination` to accept an optional `extraParams` prop (e.g., `Record<string, string>`) that gets merged into the URL query string. This ensures filters survive page changes.
  - [ ] 5.10.2 Pass `extraParams={{ asset, outcome }}` (only non-empty values) from the history page to `PagePagination`.

- [ ] Task 6: Create history page route (AC: #1, #4, #8, #9)
  - [ ] 6.1 Create `app/dashboard/debates/page.tsx` — Server Component with `searchParams: Promise<{page?, size?, asset?, outcome?}>`
  - [ ] 6.2 Call server action to fetch paginated debate history
  - [ ] 6.3 Render: filter bar (sticky top) → active filter chips → debate card grid/list → pagination controls
  - [ ] 6.4 Wrap data fetch in `Suspense` boundary with `DebateHistorySkeleton` as fallback
  - [ ] 6.5 Handle error state with `DebateHistoryError` component (retry re-fetches server action)
  - [ ] 6.6 Reuse existing `PagePagination` component — pass `basePath="/dashboard/debates"` and `extraParams` for filter preservation (see Task 5.10)
  - [ ] 6.7 Each card links to `/dashboard/debates/[externalId]` (detail page placeholder for Story 4.3)
  - [ ] 6.8 **PREREQUISITE:** Add `basePath` prop to `PageSizeSelector` component (`components/page-size-selector.tsx`). Currently hardcoded to `/dashboard` (line 21: `router.push(\`/dashboard?page=1&size=${newSize}\`)`). Mirror the `basePath` prop pattern from `PagePagination`. Pass `basePath="/dashboard/debates"` and include current filter params in the navigation URL.

- [ ] Task 7: Add navigation link (AC: #6)
  - [ ] 7.1 Update `app/dashboard/layout.tsx` sidebar to include "Debate History" link pointing to `/dashboard/debates`

### Testing

- [ ] Task 8: Backend tests (AC: #1-#5)
  - [ ] 8.1 Test `get_filtered_debates` repository method: pagination, asset filter, outcome filter, empty results, boundary conditions
  - [ ] 8.2 Test `GET /api/debate/history` route: valid params, invalid asset (422), invalid outcome (422), pagination defaults, filter combinations
  - [ ] 8.3 Test winner derivation logic (parametrized pytest — highest ROI, runs in ms): bull majority, bear majority, tie → "undecided", no votes → "undecided", single vote, all-one-side
  - [ ] 8.4 Test outcome filter correctness: "bull" returns only bull-majority debates, "undecided" captures both zero-vote AND tie cases, "bear" works symmetrically
  - [ ] 8.5 Test pagination + outcome filter interaction: correct total count with subquery, no duplicate/skipped rows across pages
  - [ ] 8.6 Use PostgreSQL fixtures from `tests/conftest.py` (NEVER SQLite). Use parameterized `debate_history_factory` fixture for vote distributions

- [ ] Task 9: Frontend tests (AC: #1, #2, #3, #6, #7, #8, #9, #10)
  - [ ] 9.1 Test `DebateHistoryCard` renders winner badge correctly (Bull green, Bear red, Undecided grey) with icon + text (dual-coding)
  - [ ] 9.2 Test `DebateHistoryFilters` select interactions and filter param generation
  - [ ] 9.3 Test `DebateHistoryEmpty` renders both empty states: filtered-empty with clear-filters CTA, true-empty with appropriate message
  - [ ] 9.4 Test `DebateVoteBar` renders proportional vote split (including 100/0 and 50/50 edge cases)
  - [ ] 9.5 Test `DebateHistoryFilterChips` renders active filters as dismissible chips, verify chip dismiss removes filter
  - [ ] 9.6 Test `DebateHistorySkeleton` renders correct number of skeleton cards
  - [ ] 9.7 Test `DebateHistoryError` renders error message and retry CTA
  - [ ] 9.8 Test debate history page server action: success, error, filter params
  - [ ] 9.9 Use Jest 29 + RTL — NEVER `vi.fn()` — use `jest.fn()` and `jest.mock()`

## Dev Notes

### Architecture & Patterns

- **Pagination:** Build **manual** offset/limit pagination inside the envelope (NOT `fastapi_pagination`'s `Page[T]`). The debate routes use `{ data, error, meta }` envelope — `fastapi_pagination` returns a flat `{ items, total, page, size, pages }` shape which is incompatible with the envelope. Reference `app/routes/items.py` for **parameter conventions only** (`page`, `size` Query params). The actual pagination is handled in `DebateRepository.get_filtered_debates()` with manual `OFFSET`/`LIMIT` + `COUNT` for total.
- **Response Envelope:** ALL responses use `{ data, error, meta }` structure. Reference `app/routes/debate.py` for existing debate envelope patterns (`StandardDebateResponse`, `StandardDebateResultResponse`). Pagination metadata goes in `meta` field, NOT as a flat `Page[T]` response.
- **Pydantic camelCase:** Use explicit `Field(serialization_alias="camelCase")` for camelCase output. Use `ConfigDict(populate_by_name=True)`. Follow the exact pattern in `vote_schemas.py` — do NOT use `alias_generator=to_camel` (the existing codebase uses manual `serialization_alias` on each field; using `alias_generator` would be inconsistent).
- **Repository pattern:** Data access goes through `DebateRepository(session)`. Add the new `get_filtered_debates` method — a named contract method with inline `LEFT JOIN LATERAL` subquery for winner derivation. NOT a database view (YAGNI — one consumer). If a second consumer appears later, promote to a view then.
- **Server Actions:** Frontend calls backend via `"use server"` actions that read `accessToken` from cookies. Follow pattern in `components/actions/items-action.ts`.
- **Feature Module Structure:** New components go in `features/debate/components/`. New hooks in `features/debate/hooks/`. All barrel-exported from respective `index.ts`.

### Database Schema (Existing — DO NOT MODIFY)

The `Debate` model (`app/models.py:31-50`) has these fields available for the history page:
- `id` (UUID), `external_id` (String, unique, indexed), `asset` (String), `status` (String: "running"/"completed"/"error")
- `max_turns`, `current_turn`, `guardian_verdict` (nullable String), `guardian_interrupts_count`
- `transcript` (Text, nullable), `created_at`, `completed_at` (nullable)
- `votes` relationship → `Vote` model

The `Vote` model (`app/models.py:53-75`): `id`, `debate_id` (FK), `choice` ("bull"/"bear"/"undecided"), `voter_fingerprint`, `created_at`.

**No `winner` column exists** — it must be derived at query time from vote counts.

### Winner Derivation Logic

```
If total_votes == 0 → winner = "undecided"
If bull_votes > bear_votes → winner = "bull"
If bear_votes > bull_votes → winner = "bear"
Else → winner = "undecided"
```

The `outcome` filter maps to this derived field. Filtering by outcome requires a subquery or having clause on vote aggregation.

### Outcome Filter Implementation Strategy

Since `winner` is not a column but derived from votes, the filter approach:

**DECISION: Inline subquery with named repository method (NOT a PostgreSQL view).**

Rationale (Party Mode consensus): A view is a migration artifact maintained forever for one consumer. YAGNI until a second consumer appears. The named method `get_filtered_debates()` encapsulates the logic in one testable place.

Implementation:
1. Use `LEFT JOIN LATERAL` with `COUNT(*) FILTER (WHERE choice = 'bull'/'bear')` to annotate each debate with vote counts
2. Derive `winner` inline using SQL `CASE` expression
3. Apply outcome filter via `WHERE` on the derived field — SQL-level only (Python post-filtering breaks pagination)
4. Add index `idx_vote_debate_choice ON vote(debate_id, choice)` to optimize the lateral join

**DO NOT filter in Python after fetching** — this breaks pagination (inconsistent page sizes, wrong total counts).

### Frontend Route Structure

```
app/dashboard/debates/
  page.tsx                ← History list page (THIS STORY)
  [externalId]/
    page.tsx              ← Detail page (placeholder for Story 4.3)
```

The detail page placeholder should fetch `GET /api/debate/{externalId}/result` (already exists) and display the debate summary with an "Archived" badge. Full static SEO page comes in Story 4.3.

### Component Reuse

- **Existing:** `PagePagination` component from dashboard items page — reuse directly with `basePath="/dashboard/debates"`. **MUST extend** with `extraParams` prop for filter preservation (Task 5.10).
- **Existing:** `PageSizeSelector` component — **MUST add** `basePath` prop (currently hardcoded to `/dashboard`). See Task 6.8.
- **Existing:** `AgentAvatar` from debate components — reuse on history cards
- **New:** `DebateVoteBar` — horizontal bar showing vote split, can be reused later for sentiment reveal
- **Shadcn Components needed:** `Badge` (winner ✅ exists), `Select` (filters ✅ exists), `Card` (list items ✅ exists), `Skeleton` (loading ⚠️ MUST INSTALL via `npx shadcn@latest add skeleton`)

### UX Considerations

- **"Glass Cockpit" dark mode:** Follow existing dark theme (`bg-slate-900`, `border-white/10`). Card backgrounds: `bg-white/5` with `hover:bg-white/8` for separation.
- **Winner badges:** Bull = `bg-emerald-500`, Bear = `bg-rose-500`, Undecided = `bg-slate-500`. Must have icon + text (dual-coding for color blindness).
- **Mobile-first:** Single column card layout on mobile, grid on desktop
- **Accessibility:** Winner badges dual-coded (color + icon + text). Vote bars need `aria-label` ("Bull: 65%, Bear: 35%"). Card list uses `<ul>/<li>` semantics. Focus order: filters → chips → cards → pagination.
- **Loading states:** Skeleton cards (6-8) matching DebateHistoryCard dimensions. Wrap fetch in `Suspense` boundary.
- **Error state:** Error message + retry CTA. Not a blank page.
- **Filter chips:** Dismissible chips above card list showing active filters. Each chip tappable to remove.
- **Dual empty states:** (a) Filtered-empty: "No debates match your filters" + clear-filters CTA. (b) True-empty: "No debates yet". Functional-only — text + icon, no illustrations.

### Dependencies on Story 4.1

Story 4.1 (Debate Archival Service) must complete debates (set `status="completed"`, populate `completed_at`) and clean up Redis. The history page only queries debates with `status="completed"`.

**4.1 does NOT hard-block 4.2.** Parallelization strategy (Party Mode consensus):
- Define the API contract as a TypeScript interface and work against a hardcoded mock/stub initially
- 4.1 delivers a callable endpoint with the right shape (doesn't need to be production-hardened)
- When 4.1's real implementation lands, swap stub for live call
- Minimum to unblock: (1) `Debate` model has required columns with migrations applied, (2) API returns paginated list with correct shape, (3) Foreign keys verified via `alembic current`

### Key Files to Modify

| File | Change |
|------|--------|
| `app/services/debate/schemas.py` | Add `DebateHistoryItem`, `DebateHistoryMeta`, `StandardDebateHistoryResponse` |
| `app/services/debate/repository.py` | Add `get_filtered_debates()` method with inline LEFT JOIN LATERAL |
| `app/routes/debate.py` | Add `GET /api/debate/history` endpoint |
| `features/debate/components/` | Add `DebateHistoryCard`, `DebateHistoryFilters`, `DebateHistoryEmpty`, `DebateVoteBar`, `DebateHistoryFilterChips`, `DebateHistorySkeleton`, `DebateHistoryError` |
| `features/debate/components/index.ts` | Barrel export new components |
| `features/debate/api/` or `actions/` | New server action for fetching history |
| `app/dashboard/debates/page.tsx` | New history list page |
| `app/dashboard/layout.tsx` | Add sidebar nav link |

### Anti-Patterns to Avoid

- **DO NOT** create a new `DebateHistoryService` — add `get_filtered_debates` to the existing `DebateRepository`
- **DO NOT** create a PostgreSQL view for winner derivation — use inline subquery in named repo method (YAGNI)
- **DO NOT** filter by outcome in Python after fetching — this breaks pagination (inconsistent page sizes, wrong totals)
- **DO NOT** use in-memory SQLite for tests — use PostgreSQL fixtures from `conftest.py`
- **DO NOT** use `vi.fn()` or Vitest — use Jest 29 (`jest.fn()`, `jest.mock()`)
- **DO NOT** add a `winner` column to the `Debate` model — derive at query time
- **DO NOT** build a custom pagination component — reuse `PagePagination`
- **DO NOT** create API routes in Next.js — use server actions calling FastAPI backend
- **DO NOT** leak `snake_case` to frontend — use Pydantic `serialization_alias` for camelCase
- **DO NOT** hard-block on Story 4.1 completion — parallelize with contract stub, swap when ready
- **DO NOT** use `fastapi_pagination`'s `Page[T]` response shape — use the standard envelope `{ data, error, meta }` with manual pagination in `meta`. `Page[T]` returns a flat shape incompatible with the envelope.
- **DO NOT** use `alias_generator=to_camel` on Pydantic models — use explicit `Field(serialization_alias=...)` to match existing codebase convention in `vote_schemas.py`.
- **DO NOT** import debate types from `types.gen.ts` — no debate types exist in the auto-generated client. Define TypeScript interfaces manually.
- **DO NOT** use auto-generated SDK calls for debate history — use raw `fetch()` with manual token passing, since the OpenAPI client hasn't been regenerated for this endpoint.

### References

- [Source: app/routes/items.py] — Pagination pattern with `fastapi_pagination`
- [Source: app/services/debate/schemas.py] — Existing Pydantic schema conventions
- [Source: app/services/debate/repository.py] — Existing repository pattern
- [Source: app/services/debate/vote_schemas.py] — `DebateResultResponse` for vote breakdown shape
- [Source: app/models.py:31-75] — Debate and Vote model definitions
- [Source: app/dashboard/layout.tsx] — Sidebar nav structure
- [Source: app/dashboard/page.tsx] — Paginated server component pattern
- [Source: components/actions/items-action.ts] — Server action with token pattern
- [Source: _bmad-output/planning-artifacts/architecture.md] — Architecture patterns
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — Glass Cockpit design direction

## Party Mode Consensus (Pre-Dev)

**Agents present:** Winston (Architect), Amelia (Dev), Sally (UX), Murat (Test Architect), John (PM)

| Decision | Rationale |
|----------|-----------|
| Inline subquery + named repo method (NOT a view) | YAGNI — one consumer. If second consumer appears, promote to view then. View = migration maintained forever. |
| SQL-level filtering only for outcome | Python post-filtering breaks pagination (inconsistent page sizes, wrong total counts). |
| Add `idx_vote_debate_choice` index | Optimizes the `LEFT JOIN LATERAL` + `COUNT(*) FILTER` for NFR-03 (50k readers). |
| Skeletons + error state in 4.2 | Table stakes. Blank page = broken experience. |
| Active filter chips in 4.2 | Part of the filter system itself — not additive. Filters without visible state are unusable. Functional-only (text + icon). |
| Dual empty states in 4.2 | Correctness, not polish. Filtered-empty vs. true-empty shapes the core flow's first impression. Functional-only. |
| No date range filter in 4.2 | New feature, not a gap. Own story with own ACs. |
| No collapsible filter drawer in 4.2 | Backlog until mobile traffic data exists. |
| No "load more" pagination in 4.2 | `PagePagination` works. Iterate later with data. |
| 4.1 does NOT hard-block 4.2 | Parallelize with contract stub. Swap stub for live when 4.1 ships callable endpoint. |
| Backend/frontend test split: 70/30 | Backend carries correctness risk (winner derivation, vote aggregation SQL). Frontend tests focus on badge rendering + filter wiring. |
| Winner derivation tests first (parametrized) | Highest ROI — fast, deterministic, covers most complex logic. ~10 cases. |

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
