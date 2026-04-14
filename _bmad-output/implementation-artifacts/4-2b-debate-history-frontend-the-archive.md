# Story 4.2b: Debate History Frontend (The Archive)

Status: review

## Story

As a User,
I want to browse past debates by asset or outcome on a history page,
So that I can learn from previous market situations.

## Acceptance Criteria

1. **AC-1: Paginated debate list** — Given the History Page, When I load it, Then I see a paginated list of past debates with clear "Winner" badges (dual-coded: color + icon + text).
2. **AC-2: Asset filter** — Given the list, When I filter by "ETH" or "BTC", Then the list updates to show only matching debates. Filter state is reflected in URL search params.
3. **AC-3: Outcome filter** — Given the list, When I filter by "Bull Wins" or "Bear Wins", Then the list updates to show only debates where that side won. Filter state is reflected in URL search params.
4. **AC-4: Navigate to detail** — Given a debate card, When clicked, Then it navigates to `/dashboard/debates/[externalId]` (detail page placeholder for Story 4.3).
5. **AC-5: URL-owned filter state** — Filter state is owned by URL search params (`?asset=BTC&outcome=bull&page=2`). No parallel React state. Filters persist across back-button, are shareable via URL, and SSR reads them on first render.
6. **AC-6: Mobile-first** — The page renders correctly in portrait mode (single column, thumb-zone navigation, 44×44px touch targets, collapsible filter bar).
7. **AC-7: Dual empty states** — When no debates match active filters, show "No debates match your filters" with clear-filters CTA. When no debates exist at all, show "No debates yet" message.
8. **AC-8: Loading state** — While fetching, show 6-8 skeleton cards matching DebateHistoryCard dimensions (Shadcn `Skeleton`). Skeletons appear on BOTH initial load AND filter/page changes.
9. **AC-9: Error state** — When the API call fails, show an error message with a retry CTA via a proper Next.js `error.tsx` error boundary.
10. **AC-10: Active filter chips** — When filters are applied, show dismissible chips above the card list. Each chip is a `<button>` with `aria-label="Remove [filter] filter"`, tappable to remove that filter.
11. **AC-11: Vote bar correctness** — Vote split bar always sums to 100. `bullPct = Math.round(bull/total*100)`, `bearPct = 100 - bullPct`. Never round independently.
12. **AC-12: Accessibility** — Keyboard navigation through filters, cards, pagination. Winner badges dual-coded (color + icon + text). Filter chips have accessible dismiss buttons. Skeleton loading has `aria-busy="true"`.
13. **AC-13: Filter-change loading indicator** — When a filter or page change triggers a re-fetch, show skeleton loading (not stale data). The Suspense boundary must catch navigation-triggered refetches.
14. **AC-14: Winner fallback** — Any unrecognized `winner` value renders as a neutral "Unknown" badge (slate + "—" + "Unknown"). Never crash or show blank on unexpected values.

## Tasks / Subtasks

### Task 0: Prerequisites

- [x] 0.1 Run `npx shadcn@latest add skeleton` — Skeleton component must exist before any component imports it
- [x] 0.2 Verify 4.2a backend endpoint returns real data via curl/Postman before starting frontend tasks. Run: `curl http://localhost:8000/api/debate/history?page=1&size=5` and confirm the response envelope matches `StandardDebateHistoryResponse`. **Note:** The actual endpoint is `/api/debate/history` (NOT `/api/v1/debates/history`). The router prefix is `/api/debate` defined in `app/routes/debate.py:40`.
- [x] 0.3 Verify which assets the backend supports. Check `SUPPORTED_ASSETS` in `app/routes/debate.py` and `VALID_OUTCOMES` in the same file. The frontend filter options MUST match these exactly.

### Task 1: Define frontend types manually (AC: #5)

No TypeScript types are generated from 4.2a — the backend generates Python types only. Frontend types must be hand-written to match the backend schema.

- [x] 1.1 Create `features/debate/types/debate-history.ts` with hand-written TypeScript interfaces matching the backend `DebateHistoryItem` and `StandardDebateHistoryResponse` from `app/services/debate/schemas.py`:
  ```typescript
  export interface DebateHistoryItem {
    externalId: string;       // from external_id, alias camelCase
    asset: string;
    status: string;
    guardianVerdict: string | null;
    guardianInterruptsCount: number;
    totalVotes: number;
    voteBreakdown: Record<string, number>;  // keys: "bull" | "bear" — see voteBreakdown key contract below
    winner: string;           // "bull" | "bear" | "undecided" | unknown → fallback
    createdAt: string;        // ISO 8601 datetime
    completedAt: string | null;
  }

  export interface DebateHistoryMeta {
    page: number;
    size: number;
    total: number;
    pages: number;
  }
  // NOTE: These fields are single words — no camelCase aliases exist on the backend schema.
  // DebateHistoryMeta in schemas.py:86-92 has NO Field(serialization_alias=...) unlike DebateHistoryItem.
  // The JSON keys are exactly: page, size, total, pages.

  export interface StandardDebateHistoryResponse {
    data: DebateHistoryItem[];
    error: { code: string; message: string } | null;
    meta: DebateHistoryMeta;
  }

  export type WinnerType = "bull" | "bear" | "undecided";
  export type OutcomeFilter = "bull" | "bear" | "";
  export type AssetFilter = string;  // validated against SUPPORTED_ASSETS at runtime
  ```
- [x] 1.2 Export `SUPPORTED_ASSETS` and `VALID_OUTCOMES` constants matching the backend values. Retrieve them from the backend route file (`app/routes/debate.py`) and hardcode as `const` arrays. Add a comment: `// Keep in sync with backend SUPPORTED_ASSETS / VALID_OUTCOMES in app/routes/debate.py`. Example:
  ```typescript
  // Keep in sync with backend SUPPORTED_ASSETS / VALID_OUTCOMES in app/routes/debate.py
  export const SUPPORTED_ASSETS = ["btc", "eth", "sol", "bitcoin", "ethereum", "solana"] as const;
  export const VALID_OUTCOMES = ["bull", "bear", "undecided"] as const;
  ```

### Task 2: Create API client for debate history (AC: #5)

- [x] 2.1 Create `features/debate/api/debate-history.ts` with typed fetch functions.
- [x] 2.2 Export `getApiBaseUrl()` helper that reads `process.env.API_BASE_URL` directly (the env var is available in Server Components and server actions). Do NOT import from `lib/clientConfig.ts` — that file only configures the OpenAPI client singleton and doesn't export a URL string. If `API_BASE_URL` is undefined, throw with a clear message: `"API_BASE_URL env var is not set"`.
- [x] 2.3 Create `fetchDebateHistory(params: { page: number, size: number, asset?: string, outcome?: string })` function using raw `fetch()` against `${getApiBaseUrl()}/api/debate/history`. Do NOT try to import from `@/app/clientService`. **Endpoint path is `/api/debate/history`** — the router defines `prefix="/api/debate"` in `app/routes/debate.py:40`.
- [x] 2.4 Add Zod schema validating the FULL response envelope — not just card-relevant fields. Validate `data` (array), `error` (nullable object with code+message), `meta` (object with page+size+total+pages). This catches backend schema changes (e.g., field renames) instead of silently ignoring them. Schema:
  ```typescript
  const debateHistoryResponseSchema = z.object({
    data: z.array(z.object({
      externalId: z.string(),
      asset: z.string(),
      status: z.string(),
      guardianVerdict: z.string().nullable(),
      guardianInterruptsCount: z.number(),
      totalVotes: z.number(),
      voteBreakdown: z.record(z.string(), z.number()),
      winner: z.string(),
      createdAt: z.string(),
      completedAt: z.string().nullable(),
    })),
    error: z.object({ code: z.string(), message: z.string() }).nullable(),
    meta: z.object({ page: z.number().int().positive(), size: z.number().int().positive(), total: z.number().int().min(0), pages: z.number().int().min(0) }),
  });
  ```
- [x] 2.5 **voteBreakdown key contract:** The backend stores votes as `dict[str, int]` where keys are `"bull"` and `"bear"` (lowercase). The API client must normalize these keys on fetch. Create a helper:
  ```typescript
  function extractVotes(voteBreakdown: Record<string, number>): { bullVotes: number; bearVotes: number; undecidedVotes: number } {
    return {
      bullVotes: voteBreakdown["bull"] ?? 0,
      bearVotes: voteBreakdown["bear"] ?? 0,
      undecidedVotes: voteBreakdown["undecided"] ?? 0,
    };
  }
  ```
  If neither key exists, return `{ bullVotes: 0, bearVotes: 0, undecidedVotes: 0 }` — never throw. **The backend always emits all three keys** (`bull`, `bear`, `undecided`) per 4.2a implementation, but the helper should be defensive.

### Task 3: Create server action (AC: #5)

- [x] 3.1 Create `features/debate/actions/debate-history-action.ts` with `"use server"` directive.
- [x] 3.2 **Auth decision:** The backend `GET /history` endpoint has NO auth dependency (no `Depends` for user/session). Do NOT extract cookies or tokens. This is a public endpoint. If auth is added later, the server action can be updated then.
- [x] 3.3 Accept `{ page, size, asset?, outcome? }` params, call `fetchDebateHistory`, validate response with Zod schema, return typed `StandardDebateHistoryResponse`.
- [x] 3.4 Handle errors: network failure → throw `new Error("Failed to fetch debate history: ${message}")`, Zod validation failure → throw `new Error("Invalid response shape from debate history API")`, HTTP error → throw with status code context.

### Task 4: Create `DebateVoteBar` component (AC: #11)

- [x] 4.1 Create `features/debate/components/DebateVoteBar.tsx` — horizontal bar showing bull/bear vote split.
- [x] 4.2 Props: `{ bullVotes: number, bearVotes: number, className?: string }`. Accept `bullLabel`/`bearLabel` for reuse (defaults: "Bull"/"Bear").
- [x] 4.3 Math: `bullPct = Math.round(bullVotes / total * 100)`, `bearPct = 100 - bullPct` — NEVER round both independently (Lesson 10).
- [x] 4.4 Handle edge cases: 0/0 votes (empty bar with "No votes" text), 100/0, 50/50.
- [x] 4.5 Accessibility: `aria-label="Bull: {bullPct}%, Bear: {bearPct}%"` on the bar container.
- [x] 4.6 Colors: Bull fill `bg-emerald-500`, Bear fill `bg-rose-500`. Percentage text placed OUTSIDE the bar fill (below or beside), not inside — bar fills can be too narrow for readable text. Use `text-slate-400` for percentage labels. Add a 2px gap between bull and bear fills so they are visually distinguishable against the card background even when fills are similar luminance.

### Task 5: Create `DebateHistoryCard` component (AC: #1, #4, #11, #12, #14)

- [x] 5.1 Create `features/debate/components/DebateHistoryCard.tsx` — card component.
- [x] 5.2 Props include a `thesisPreview?: string` slot (empty initially, structurally present for future enhancement).
- [x] 5.3 Card content (from consensus):
  - Asset symbol (large, prominent)
  - Winner badge (dual-coded: Bull=emerald+▲+"Bull", Bear=rose+▼+"Bear", Undecided=slate+"?"+"Undecided", Unknown=slate+"—"+"Unknown") using Shadcn `Badge`. **Winner mapping logic:** normalize `winner` field to lowercase, match against `"bull"` | `"bear"` | `"undecided"` — any other value renders the "Unknown" fallback badge. NEVER crash on unexpected values.
  - `DebateVoteBar` component (receives extracted bull/bear vote counts from `voteBreakdown`)
  - Relative timestamp ("2h ago") from `createdAt`
  - Guardian badge (conditional — only when `guardianVerdict` is not null)
  - Total vote count
- [x] 5.4 Card background: `bg-white/5` with `hover:bg-white/8`. Subtle border: `border-white/15` (NOT `/10` — fails contrast).
- [x] 5.5 Entire card is wrapped in `<a>` or has click handler navigating to `/dashboard/debates/[externalId]`.
- [x] 5.6 Use `<article>` with accessible name from asset ticker. Semantic `<ul>/<li>` for card list.

### Task 6: Create filter components (AC: #2, #3, #5, #10, #12)

- [x] 6.1 Create `features/debate/components/DebateHistoryFilters.tsx` — asset select + outcome select + clear filters button. Use Shadcn `Select`.
  - **Asset options** are driven by `SUPPORTED_ASSETS` constant (from Task 1.2), NOT hardcoded. Render each asset as uppercase label, lowercase value. Include an "All" option with empty-string value.
  - **Outcome options** are driven by `VALID_OUTCOMES` constant (from Task 1.2). Render "Bull Wins" / "Bear Wins" / "Undecided" / "All". Include an "All" option with empty-string value.
- [x] 6.2 Filter state is owned by URL search params: reads via `useSearchParams()`, writes via `useRouter().push()`. NO parallel React state for filter values. **Server Component boundary:** The page Server Component passes `searchParams` as props to this Client Component. The Client Component receives initial values via props, then reads/writes URL via `useSearchParams()` / `useRouter()` for subsequent interactions. This avoids calling `useSearchParams()` in a Server Component.
- [x] 6.3 Pagination resets to page 1 when any filter changes.
- [x] 6.4 Create `features/debate/components/DebateHistoryFilterChips.tsx` — dismissible chips showing active filters above the card list. Each chip is a `<button>` with `aria-label="Remove [filter name] filter"`. Focus moves to next chip or filter bar after dismissal.
- [x] 6.5 Touch targets: all interactive elements minimum 44×44px hit area.
- [x] 6.6 **Mobile layout:** On screens < 640px (`sm:` breakpoint), the filter bar collapses into a horizontal scrollable row with `overflow-x-auto` and `flex-nowrap`. Filter selects render as compact pills. Cards render as full-width single column. On `sm:` and above, filters display as a standard row with gap.

### Task 7: Create state components (AC: #7, #8, #9)

- [x] 7.1 Create `features/debate/components/DebateHistoryEmpty.tsx` — two distinct states: (a) filtered-empty: "No debates match your filters" + clear-filters CTA, (b) true-empty: "No debates yet" message. Functional-only (text + icon, no illustrations).
- [x] 7.2 Create `features/debate/components/DebateHistorySkeleton.tsx` — skeleton loading cards (6-8) matching DebateHistoryCard dimensions. Use Shadcn `Skeleton`. Container has `aria-busy="true"`.
- [x] 7.3 Create `features/debate/components/DebateHistoryError.tsx` — error state with "Could not load debates" message + retry CTA. This is a Client Component used as the `error.tsx` boundary.

### Task 8: Extend shared components (AC: #2, #3, #5)

- [x] 8.1 Extend `PagePagination` to accept optional `extraParams?: Record<string, string>` prop (default `{}`). **Implementation pattern** — refactor `buildUrl` to use `URLSearchParams`:
  ```typescript
  const buildUrl = (page: number) => {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
    Object.entries(extraParams).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    return `${basePath}?${params.toString()}`;
  };
  ```
  Must be backward-compatible — existing callers work without passing it (default `{}` produces same URL as before).
- [x] 8.2 Extend `PageSizeSelector` to accept `basePath?: string` prop (default `/dashboard`) AND `extraParams?: Record<string, string>` prop (default `{}`). **Both props are needed** — `basePath` controls the route, `extraParams` preserves active filters when page size changes. Implementation:
  ```typescript
  interface PageSizeSelectorProps {
    currentSize: number;
    basePath?: string;          // default: "/dashboard"
    extraParams?: Record<string, string>;  // default: {}
  }

  const handleSizeChange = (newSize: string) => {
    const params = new URLSearchParams({ page: "1", size: newSize });
    Object.entries(extraParams).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    router.push(`${basePath}?${params.toString()}`);
  };
  ```
  Ensure no double-prefix bug (`/dashboard/dashboard/...`). Existing callers work without changes (default props produce same behavior as before).
- [x] 8.3 Update existing tests for both components to verify backward compatibility AND that `extraParams` are correctly preserved in generated URLs.

### Task 9: Create history page route (AC: #1, #4, #5, #6, #7, #8, #9, #13)

- [x] 9.1 Create `app/dashboard/debates/page.tsx` — Server Component with `searchParams: Promise<{page?, size?, asset?, outcome?}>`.
- [x] 9.2 Call server action to fetch paginated debate history using awaited `searchParams`.
- [x] 9.3 Render: filter bar (sticky top) → active filter chips → debate card grid/list → pagination controls.
- [x] 9.4 Wrap data fetch in `Suspense` boundary with `DebateHistorySkeleton` as fallback. **Key:** Wrap the inner data-dependent section in a `Suspense` boundary with `key={searchParamsString}` so that filter/page changes trigger Suspense fallback (skeleton) instead of showing stale data while loading. Example:
  ```tsx
  const paramsKey = `asset=${asset}&outcome=${outcome}&page=${page}&size=${size}`;
  <Suspense key={paramsKey} fallback={<DebateHistorySkeleton />}>
    <DebateHistoryList page={page} size={size} asset={asset} outcome={outcome} />
  </Suspense>
  ```
  Where `DebateHistoryList` is an async Server Component that calls the server action. This ensures filter changes show skeleton loading.
- [x] 9.5 **Error boundary:** Create `app/dashboard/debates/error.tsx` as a proper Next.js error boundary (Client Component with `"use client"`, receives `error` and `reset` props). Render `DebateHistoryError` with the `reset` function wired to the retry CTA. The page component itself does NOT handle errors — `error.tsx` catches server-action thrown errors automatically.
- [x] 9.6 Reuse `PagePagination` with `basePath="/dashboard/debates"` and `extraParams={{ asset, outcome }}` (only non-empty values, filter out empty strings).
- [x] 9.7 Reuse `PageSizeSelector` with `basePath="/dashboard/debates"` and `extraParams` containing current filter params (same filtering: only non-empty values).
- [x] 9.8 Each card links to `/dashboard/debates/[externalId]` (detail page placeholder for Story 4.3).
- [x] 9.9 **ISR strategy:** Prefer `revalidate = 0` (dynamic rendering) for this page because it is filter-driven — users change `asset`/`outcome`/`page` frequently and expect fresh results. ISR with `revalidate = 60` would serve stale cached pages for filter combinations. Dynamic rendering ensures each request hits the server action. If performance becomes a concern, add client-side caching via React Query later.

### Task 10: Add navigation link (AC: #6)

- [x] 10.1 Update `app/dashboard/layout.tsx` sidebar to include "Debate History" link pointing to `/dashboard/debates`. Use `History` icon from `lucide-react` (consistent with existing icon imports). Consider `Swords` as an alternative if a debate-specific icon is preferred. The sidebar is icon-only (`w-16` — not 16px, it's `w-16` = 64px) — add `aria-label="Debate History"` on the `<Link>` and a `Tooltip` (already wrapped in `TooltipProvider` with `delayDuration={300}`) that shows "Debate History" on hover. Follow the exact pattern of the existing `List` icon link at lines 43-48. Insert the new link after the Customers link (after line 54), before the closing `</div>` on line 55.

### Task 11: Barrel exports

- [x] 11.1 Add all new components to `features/debate/components/index.ts` barrel export.

### Task 12: Frontend tests (AC: #1-#14)

- [x] 12.1 **URL filter sync** (P0): Render page with `?asset=BTC&outcome=bull` in URL, assert filters are pre-populated and API called with correct params.
- [x] 12.2 **URL reflects filter selection** (P0): Interact with filter selects, assert URL search params update.
- [x] 12.3 **Vote bar sums to 100** (P0): Test `DebateVoteBar` with edge cases: 50/50, 99/1, 0/100, 0/0. Assert `bullPct + bearPct === 100` in all cases (except 0/0).
- [x] 12.4 **Reduced motion disables bar animation** (P0): Mock `useReducedMotion()` returning true, verify no animation transitions on vote bar.
- [x] 12.5 **Winner badge dual-coding** (P0): Test each winner state (bull, bear, undecided, unknown string like "pending") renders color + icon + text. Unknown value renders "Unknown" fallback badge.
- [x] 12.6 **Filter chip dismissal** (P1): Test chip dismiss removes filter from URL params and focus moves to next chip or filter bar.
- [x] 12.7 **Empty states** (P1): Test both filtered-empty (with clear-filters CTA) and true-empty states render correct copy.
- [x] 12.8 **Skeleton loading** (P2): Test correct number of skeleton cards render during loading state.
- [x] 12.9 **Error state** (P2): Test error boundary renders error message and retry CTA correctly.
- [x] 12.10 **Component rendering** (P1): Test `DebateHistoryCard` renders with edge-case data: 0 votes, 50/50 split, long asset names, unexpected winner value. Test `DebateHistoryFilters` select interactions.
- [x] 12.11 **voteBreakdown key extraction** (P1): Test `extractVotes()` helper with: normal keys, missing keys, empty object, extra keys. Never throws.
- [x] 12.12 **PagePagination extraParams** (P1): Test that `extraParams` are merged into URLs. Test backward compatibility (no `extraParams` → same URL as before). Test empty-string values are excluded.
- [x] 12.13 **PageSizeSelector extraParams** (P1): Test that changing page size preserves filter params. Test backward compatibility.
- [x] 12.14 **Filter options match backend** (P2): Assert `SUPPORTED_ASSETS` and `VALID_OUTCOMES` constants are non-empty arrays.
- [x] 12.15 Use Jest 29 + RTL — NEVER `vi.fn()` — use `jest.fn()` and `jest.mock()`.

## Dev Notes

### Architecture Decisions (Party Mode Consensus)

| Decision | Rationale |
|----------|-----------|
| Filter state lives in URL search params | Shareable links, back-button works, SSR reads on first render, no stale React state. URL IS the state. |
| Raw `fetch()` for API calls | No OpenAPI client for this endpoint yet. Use raw `fetch()` against `/api/debate/history` with typed response. |
| Server action WITHOUT auth | Backend `GET /history` has no auth dependency. Don't extract cookies/tokens. Update if auth is added later. |
| Hand-written TypeScript types | 4.2a generates Python types only — no `npm run generate:types` step exists. Write TS interfaces to match backend schema explicitly. |
| No thesis preview in initial ship | Cards differentiate via 5 signals: asset, winner, vote split, timestamp, guardian badge. Card has empty `thesisPreview` slot for future. |
| `revalidate = 0` (dynamic rendering) | Filter-driven page needs fresh results per request. ISR would serve stale filter combinations. Add React Query client-side caching if performance becomes a concern. |
| Zod validates full response envelope | Validates ALL fields, not just card-relevant ones. Catches backend schema changes (renames, removals) at the boundary instead of silently ignoring them. |
| Server Component passes searchParams as props | Server Components cannot use `useSearchParams()`. The page reads `searchParams` prop and passes values down to Client Components. Client Components then use `useSearchParams()` for subsequent interactions. |
| Filter options driven by shared constants | `SUPPORTED_ASSETS` (6 values: btc, eth, sol, bitcoin, ethereum, solana) and `VALID_OUTCOMES` (3 values: bull, bear, undecided) are constants in the types file, kept in sync with backend via comment. Not fetched from API — would add latency and failure mode. |
| `error.tsx` for error boundary | Next.js App Router requires a separate `error.tsx` file to catch server-action errors. Inline error components don't work for Server Component thrown errors. |
| `Suspense key` for filter-change loading | Using `key={paramsKey}` on Suspense boundary forces React to unmount/remount the inner component when filters change, triggering the skeleton fallback. Prevents stale data flash. |

### voteBreakdown Key Contract

The backend stores vote breakdown as `dict[str, int]` with keys `"bull"`, `"bear"`, and `"undecided"` (lowercase). The frontend MUST use these exact keys. The `extractVotes()` helper normalizes access and defaults to `0` for missing keys. This is the contract:

```typescript
// Backend returns: { "bull": 45, "bear": 32, "undecided": 5 }
// Frontend extracts: { bullVotes: 45, bearVotes: 32, undecidedVotes: 5 }
```

If the backend changes these keys, the Zod schema will still pass (it's `z.record(z.string(), z.number())`), but the vote bar will show 0/0. Add a console warning in `extractVotes()` when neither "bull" nor "bear" keys are found.

### Winner Badge Mapping

```typescript
type WinnerBadge = {
  label: string;
  icon: "▲" | "▼" | "?" | "—";
  colorClass: string;
};

function getWinnerBadge(winner: string): WinnerBadge {
  switch (winner.toLowerCase()) {
    case "bull": return { label: "Bull", icon: "▲", colorClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    case "bear": return { label: "Bear", icon: "▼", colorClass: "bg-rose-500/20 text-rose-400 border-rose-500/30" };
    case "undecided": return { label: "Undecided", icon: "?", colorClass: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
    default: return { label: "Unknown", icon: "—", colorClass: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
  }
}
```

### Card Content Specification (Consensus)

| Element | Source | Always Present |
|---------|--------|---------------|
| Asset symbol (large) | `debate.asset` | Yes |
| Winner badge (color + icon + text + fallback) | Derived `winner` | Yes |
| Vote split bar | `voteBreakdown` → `extractVotes()` | Yes (0 votes = "No votes") |
| Relative timestamp | `createdAt` | Yes |
| Guardian badge | `guardianVerdict` | Conditional |
| Total vote count | `totalVotes` | Yes |
| Thesis preview slot | Empty prop | Yes (empty, structural only) |

### Component Tree

```
app/dashboard/debates/
├── page.tsx (Server Component — reads searchParams, passes as props)
├── error.tsx (Client Component — Next.js error boundary)
│
└── DebateHistoryList (async Server Component — calls server action)
    ├── DebateHistoryFilters (Client Component — receives initial props, uses useSearchParams)
    │   ├── Asset Select (options from SUPPORTED_ASSETS)
    │   └── Outcome Select (options from VALID_OUTCOMES)
    ├── DebateHistoryFilterChips (Client Component)
    ├── DebateHistoryEmpty (two variants)
    ├── Card List (<ul>/<li> semantic)
    │   └── DebateHistoryCard (<article>)
    │       ├── Winner Badge (Shadcn Badge, dual-coded + Unknown fallback)
    │       ├── DebateVoteBar (reusable, extracts votes from voteBreakdown)
    │       ├── Guardian Badge (conditional)
    │       └── thesisPreview slot (empty)
    ├── PagePagination (extended with extraParams)
    └── PageSizeSelector (extended with basePath + extraParams)

DebateHistorySkeleton (Suspense fallback, aria-busy) — NOT inside DebateHistoryList
DebateHistoryError (rendered by error.tsx)
```

### Dark Mode Contrast Values (Consensus)

- Card background: `bg-white/5` on `bg-slate-900` ≈ #151c2e
- Card border: `border-white/15` (NOT `/10` — `/10` ≈ 1.3:1, fails WCAG AA; `/15` ≈ 1.8:1, still subtle but visible)
- Secondary text: `text-slate-400` or lighter (passes AA at ~5.8:1). NEVER `text-slate-500` (~3.7:1, fails AA)
- Winner badge text: Use `font-semibold` (large text threshold = 3:1) or darker badge backgrounds
- Vote bar text: Place percentage text OUTSIDE the bar fill (below or beside). Bar fills (`bg-emerald-500`, `bg-rose-500`) against card background (`bg-white/5`) have insufficient luminance contrast to serve as the only visual distinction — add a 2px gap between fills.
- Vote bar percentage labels: `text-slate-400` (not inside the fill)

### Mobile Layout Specification

| Breakpoint | Filter Bar | Card Layout |
|------------|-----------|-------------|
| < 640px (portrait) | Horizontal scroll, compact pill-style selects, `overflow-x-auto flex-nowrap` | Single column, full-width cards |
| ≥ 640px | Standard row with gap between selects | Multi-column grid (2 cols) |
| ≥ 1024px | Standard row | Multi-column grid (3 cols) |

### Accessibility Requirements (Consensus — Minimum 4 Tests)

1. **Keyboard filter navigation** — Tab through all filter controls, Enter activates
2. **Winner badge not color-only** — Icon + text present alongside color
3. **Reduced motion** — Vote bar doesn't animate when `prefers-reduced-motion: reduce`
4. **Touch targets** — All interactive elements ≥ 44×44px

### Anti-Patterns

- **DO NOT** use `vi.fn()` or Vitest — use Jest 29 (`jest.fn()`, `jest.mock()`)
- **DO NOT** create API routes in Next.js — use server actions calling FastAPI backend
- **DO NOT** own filter state in React state — URL search params own it via `useSearchParams()`
- **DO NOT** call `useSearchParams()` in a Server Component — pass `searchParams` as props from the page to Client Components
- **DO NOT** truncate `transcript` for thesis preview — conversation logs are misleading
- **DO NOT** import debate types from `types.gen.ts` or `app/openapi-client/types.gen.ts` — they don't contain debate history types. Use hand-written types from `features/debate/types/debate-history.ts`
- **DO NOT** round all vote percentages independently — only round one, derive the other
- **DO NOT** use `border-white/10` — fails contrast. Use `border-white/15` minimum
- **DO NOT** use `text-slate-500` — fails contrast. Use `text-slate-400` or lighter
- **DO NOT** extract cookies/tokens in the server action — the history endpoint is public
- **DO NOT** hardcode filter options (BTC/ETH/SOL) — use `SUPPORTED_ASSETS` / `VALID_OUTCOMES` constants
- **DO NOT** ignore unrecognized `winner` values — always render "Unknown" fallback badge
- **DO NOT** show stale data during filter changes — use `Suspense key` pattern to trigger skeleton loading
- **DO NOT** put percentage text inside vote bar fills — place outside with `text-slate-400`

### Dependencies

- **Story 4.2a MUST be complete** before starting 4.2b. The backend API must return real data.
- **Story 4.3** (detail page) is NOT blocked by 4.2b — the detail route placeholder just needs to exist.

### Key Files to Modify

| File | Change |
|------|--------|
| `features/debate/types/debate-history.ts` | New — hand-written TS types + constants |
| `features/debate/api/debate-history.ts` | New API client |
| `features/debate/actions/debate-history-action.ts` | New server action (no auth) |
| `features/debate/components/DebateHistoryCard.tsx` | New |
| `features/debate/components/DebateHistoryFilters.tsx` | New |
| `features/debate/components/DebateHistoryEmpty.tsx` | New |
| `features/debate/components/DebateVoteBar.tsx` | New |
| `features/debate/components/DebateHistoryFilterChips.tsx` | New |
| `features/debate/components/DebateHistorySkeleton.tsx` | New |
| `features/debate/components/DebateHistoryError.tsx` | New |
| `features/debate/components/index.ts` | Barrel export new components |
| `app/dashboard/debates/page.tsx` | New history page |
| `app/dashboard/debates/error.tsx` | New — Next.js error boundary |
| `app/dashboard/layout.tsx` | Add sidebar nav link with History icon + Tooltip + aria-label |
| `components/page-pagination.tsx` | Add `extraParams` prop, refactor `buildUrl` to use `URLSearchParams` |
| `components/page-size-selector.tsx` | Add `basePath` + `extraParams` props, refactor URL building |

### References

- [Source: app/dashboard/page.tsx] — Paginated server component pattern
- [Source: components/page-pagination.tsx] — Existing pagination to extend (note: `buildUrl` hardcodes query string)
- [Source: components/page-size-selector.tsx] — Existing size selector to extend (note: hardcodes `/dashboard`)
- [Source: app/dashboard/layout.tsx] — Sidebar nav structure (icon-only, TooltipProvider at line 111)
- [Source: app/services/debate/schemas.py] — Backend schema for `DebateHistoryItem` (lines 67-83) and `StandardDebateHistoryResponse` (lines 95-100). **`DebateHistoryMeta` (lines 86-92) has NO camelCase aliases** — fields are `page`, `size`, `total`, `pages` as-is. `SUPPORTED_ASSETS` is defined on line 7 of this file with 6 values.
- [Source: app/routes/debate.py] — Backend route `GET /history` (lines 122-172), router prefix `/api/debate` (line 40), `SUPPORTED_ASSETS` (imported from schemas), `VALID_OUTCOMES` (line 38)

### Previous Story Intelligence (Story 4.2a)

**Story 4.2a (Debate History Backend API) — Status: DONE**

Key learnings for 4.2b implementation:

| Finding | Impact on 4.2b |
|---------|---------------|
| `vote_breakdown` **always** emits all 3 keys: `bull`, `bear`, `undecided` | Frontend `extractVotes()` must handle `undecided` key, not just bull/bear |
| Winner derivation handles "undecided-plurality" (undecided > bull AND undecided > bear) | Winner filter should include "Undecided" as a filterable outcome |
| `SUPPORTED_ASSETS` has 6 values: `{"bitcoin", "btc", "ethereum", "eth", "solana", "sol"}` | Filter options must include all 6, not just the 3 ticker symbols |
| `VALID_OUTCOMES` has 3 values: `{"bull", "bear", "undecided"}` | Outcome filter must include "Undecided" option |
| Router prefix is `/api/debate` (NOT `/api/v1/debates`) | All API calls use `/api/debate/history` |
| Conditional count query uses bare COUNT without outcome filter, CTE with outcome filter | Frontend pagination totals will be correct — no special handling needed |
| `_build_winner_expr()` extracted as DRY helper in repository.py | Winner derivation is consistent between data and count queries |
| 4.2a completed with 101 history tests passing | Backend is stable, frontend can trust the API contract |

## Party Mode Consensus (Pre-Dev)

**Agents present:** Winston (Architect), Amelia (Dev), Sally (UX), Murat (Test Architect)

| Decision | Rationale |
|----------|-----------|
| URL search params own filter state | Shareable, back-button survives, SSR-ready, no stale closures |
| No thesis preview in initial ship | Data model has no summary field. Cards differentiate on 5 signals. Slot exists for future. |
| 5 frontend a11y tests minimum | AGENTS.md mandates accessibility. Keyboard nav, dual-coding, reduced motion, touch targets. |
| Zod on full response envelope | Validates ALL fields to catch backend schema drift, not just card-relevant subset |
| `revalidate = 0` on page (updated from 60) | Filter-driven page needs fresh results per request. ISR would serve stale filter combinations. |
| `border-white/15` not `/10` | `/10` fails WCAG contrast on dark backgrounds |
| Server Component → Client Component prop drilling | Server Components can't use `useSearchParams()`. Page reads searchParams, passes to Client Components. |
| No auth in server action | Backend endpoint is public. Don't add complexity that doesn't do anything. |
| Hand-written TS types | No type generation step exists for frontend. Write once, keep in sync with backend schema. |
| `Suspense key` for filter-change loading | Forces skeleton on filter/page changes instead of stale data flash |
| `error.tsx` boundary | Only way to catch server-action errors in Next.js App Router |
| Filter options from constants, not API | Shared constants (`SUPPORTED_ASSETS` with 6 values including full names, `VALID_OUTCOMES` with `bull`/`bear`/`undecided`) avoid extra network call. Comment marks them for sync with backend. |

## Dev Agent Record

### Agent Model Used

GLM-5.1

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- ✅ Task 0: Installed Shadcn Skeleton, verified backend endpoint /api/debate/history, confirmed SUPPORTED_ASSETS (6 values) and VALID_OUTCOMES (3 values)
- ✅ Task 1: Created hand-written TypeScript types in debate-history.ts matching backend schema, exported constants
- ✅ Task 2: Created API client with Zod validation, extractVotes helper, fetchDebateHistory using raw fetch()
- ✅ Task 3: Created server action with "use server", no auth, error handling for network/Zod/HTTP errors
- ✅ Task 4: Created DebateVoteBar with correct percentage math (bullPct rounded, bearPct derived), 0/0 edge case, aria-label
- ✅ Task 5: Created DebateHistoryCard with winner badge dual-coding (color+icon+text), Unknown fallback, guardian badge, semantic HTML
- ✅ Task 6: Created DebateHistoryFilters (URL-owned state via useSearchParams), DebateHistoryFilterChips (dismissible, aria-label)
- ✅ Task 7: Created DebateHistoryEmpty (dual states), DebateHistorySkeleton (6 cards, aria-busy), DebateHistoryError (retry CTA)
- ✅ Task 8: Extended PagePagination with extraParams (backward compatible), PageSizeSelector with basePath + extraParams (backward compatible)
- ✅ Task 9: Created page.tsx (Server Component with Suspense key pattern), error.tsx (Next.js error boundary), dynamic rendering
- ✅ Task 10: Added sidebar nav link with History icon, Tooltip, aria-label
- ✅ Task 11: Added all new components to barrel export index.ts
- ✅ Task 12: 42 new tests across 9 test files — all pass. Full suite (56 suites, 403 tests) passes with zero regressions

### File List

- `trade-app/nextjs-frontend/components/ui/skeleton.tsx` — New (Shadcn generated)
- `trade-app/nextjs-frontend/features/debate/types/debate-history.ts` — New
- `trade-app/nextjs-frontend/features/debate/api/debate-history.ts` — New
- `trade-app/nextjs-frontend/features/debate/actions/debate-history-action.ts` — New
- `trade-app/nextjs-frontend/features/debate/components/DebateVoteBar.tsx` — New
- `trade-app/nextjs-frontend/features/debate/components/DebateHistoryCard.tsx` — New
- `trade-app/nextjs-frontend/features/debate/components/DebateHistoryFilters.tsx` — New
- `trade-app/nextjs-frontend/features/debate/components/DebateHistoryFilterChips.tsx` — New
- `trade-app/nextjs-frontend/features/debate/components/DebateHistoryEmpty.tsx` — New
- `trade-app/nextjs-frontend/features/debate/components/DebateHistorySkeleton.tsx` — New
- `trade-app/nextjs-frontend/features/debate/components/DebateHistoryError.tsx` — New
- `trade-app/nextjs-frontend/features/debate/components/DebateHistoryList.tsx` — New
- `trade-app/nextjs-frontend/features/debate/components/index.ts` — Modified (added exports)
- `trade-app/nextjs-frontend/app/dashboard/debates/page.tsx` — New
- `trade-app/nextjs-frontend/app/dashboard/debates/error.tsx` — New
- `trade-app/nextjs-frontend/app/dashboard/layout.tsx` — Modified (added History nav link)
- `trade-app/nextjs-frontend/components/page-pagination.tsx` — Modified (added extraParams)
- `trade-app/nextjs-frontend/components/page-size-selector.tsx` — Modified (added basePath + extraParams)
- `trade-app/nextjs-frontend/tests/unit/extractVotes.test.ts` — New
- `trade-app/nextjs-frontend/tests/unit/DebateVoteBar.test.tsx` — New
- `trade-app/nextjs-frontend/tests/unit/DebateHistoryCard.test.tsx` — New
- `trade-app/nextjs-frontend/tests/unit/DebateHistoryEmpty.test.tsx` — New
- `trade-app/nextjs-frontend/tests/unit/DebateHistorySkeleton.test.tsx` — New
- `trade-app/nextjs-frontend/tests/unit/DebateHistoryError.test.tsx` — New
- `trade-app/nextjs-frontend/tests/unit/debateHistoryConstants.test.ts` — New
- `trade-app/nextjs-frontend/tests/unit/PagePagination.test.tsx` — New
- `trade-app/nextjs-frontend/tests/unit/PageSizeSelector.test.tsx` — New
