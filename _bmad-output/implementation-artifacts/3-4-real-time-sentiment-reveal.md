# Story 3.4: Real-time Sentiment Reveal

Status: done

## Story

As a User,
I want to see what others thought only *after* I vote,
So that my opinion isn't biased by the crowd (and I get a reward for voting).

## Acceptance Criteria

1. **AC1: Sentiment Hidden for Non-Voters** — Given I have not voted, When I view the debate, Then current community sentiment stats are HIDDEN (FR-12). VoteControls are shown; SentimentReveal is not rendered.
2. **AC2: Animated Reveal After Voting** — Given I have successfully voted, When the "Reveal" animation plays, Then the SentimentReveal bars expand with a staggered Framer Motion animation (bars grow from 0% to final width sequentially: Bull bar first, then Bear bar with 150ms delay). The transition feels like a "revealing curtain."
3. **AC3: Real-time Updates via WebSocket Push** — Given the debate is live and I have voted, When another user casts a vote, Then my SentimentReveal updates within 2 seconds via a `DEBATE/VOTE_UPDATE` WebSocket action broadcast from the backend. No manual page refresh needed.
4. **AC4: Polling Fallback** — Given the WebSocket connection is interrupted or unavailable, When I have voted and am viewing SentimentReveal, Then the sentiment data refreshes via HTTP polling every 5 seconds (`refetchInterval: 5000` on the `useVotingStatus` query). This ensures resilience — stale data is better than no data.

## Tasks / Subtasks

- [x] Task 1: Backend WebSocket vote update action (AC: #3)
  - [x] Add `DEBATE/VOTE_UPDATE` to `WebSocketActionType` literal in `app/services/debate/ws_schemas.py`
  - [x] Create `VoteUpdatePayload` Pydantic model in `ws_schemas.py` with explicit fields and types:
  - [x] In `app/routes/debate.py`, after successful vote INSERT ONLY (not on duplicate/rejected votes — check the guard chain exits before the broadcast), broadcast a `DEBATE/VOTE_UPDATE` action to all WebSocket clients watching that debate using the `DebateConnectionManager.broadcast_to_debate()` method
  - [x] The broadcast payload must include the UPDATED aggregate counts (call `repo.get_result()` after the vote commit). Do NOT broadcast the single vote — broadcast the aggregate so each client can replace its local state directly.
  - [x] Import `connection_manager` from its confirmed location: `from app.services.debate.streaming import connection_manager`. If this creates a circular import, use a lazy import inside the route function.
  - [x] Wrap the broadcast in a try/except — vote write must succeed even if broadcast fails. Log broadcast failures at WARNING level.
  - [x] Before broadcasting, check `connection_manager.get_connection_count(request.debate_id) > 0` to skip broadcast when no WS clients are watching (avoids unnecessary `repo.get_result()` call)
  - [x] **Race condition acknowledgment:** The write-then-read-then-broadcast pattern is inherently racy (concurrent votes can produce stale broadcast payloads). This is accepted as eventual consistency — the polling fallback (Task 4) corrects stale data within 5 seconds. Do NOT add locks or serialized transactions for this.
- [x] Task 2: Frontend WebSocket handler for vote updates (AC: #3)
  - [x] Add `VoteUpdatePayload` interface to `features/debate/hooks/useDebateSocket.ts`: `{ debateId: string; totalVotes: number; voteBreakdown: Record<string, number> }`
  - [x] Add `onVoteUpdate?: (payload: VoteUpdatePayload) => void` callback to `UseDebateSocketOptions`
  - [x] Add `case "DEBATE/VOTE_UPDATE"` handler in the `ws.onmessage` switch block that calls `onVoteUpdate` with the payload
  - [x] Guard the handler: if payload is null/undefined/malformed, log a warning and do NOT call `onVoteUpdate` (prevent crash on bad data)
  - [x] Add `VoteUpdatePayload` to the `WebSocketAction.payload` union type
  - [x] Update `features/debate/hooks/index.ts` to export `VoteUpdatePayload`
- [x] Task 3: Wire WebSocket vote updates into DebateStream (AC: #3)
  - [x] In `DebateStream.tsx`, create `handleVoteUpdate` callback that updates the React Query cache via `queryClient.setQueryData` — MUST use the **updater function form** to avoid stale closure reads:
  - [x] Pass `onVoteUpdate: handleVoteUpdate` to `useDebateSocket` options
  - [x] The `handleVoteUpdate` callback must be wrapped in `useCallback` with `[queryClient, debateId]` deps to prevent re-registering the WS listener on every render
  - [x] Use the shared `queryKeys.debateResult(debateId)` factory from `features/debate/hooks/queryKeys.ts` — do NOT inline the query key array. This prevents silent breakage if the key structure changes.
  - [x] Import `useQueryClient` in DebateStream (it already uses `useVote` which has a queryClient, but DebateStream needs its own reference for the cache update)
- [x] Task 4: Add polling fallback to useVotingStatus (AC: #4)
  - [x] Extract the polling interval to a named constant: `const VOTE_POLL_INTERVAL_MS = 5000;` at the top of the hook file
  - [x] In `features/debate/hooks/useVotingStatus.ts`, add `refetchInterval: hasVoted ? VOTE_POLL_INTERVAL_MS : false` to the `useQuery` options
  - [x] This means: only poll when the user has voted (sentiment is visible). Don't waste HTTP calls when showing VoteControls.
  - [x] Add `refetchIntervalInBackground: false` to avoid polling when the tab is hidden
  - [x] This is a fallback — WebSocket push (Task 3) is the primary update mechanism. Polling ensures resilience when WS is disconnected.
  - [x] Export `VOTE_POLL_INTERVAL_MS` for use in tests (avoids magic number assertions)
- [x] Task 5: Enhanced SentimentReveal animation (AC: #2)
  - [x] In `features/debate/components/SentimentReveal.tsx`, add Framer Motion `motion.div` wrappers for each bar segment
  - [x] **Use animate interpolation (NOT key-based re-animation)** — Framer Motion handles animation interruption natively by interpolating from the current position to the new target
  - [x] Use an `isFirstRender` ref (`useRef(true)`) to distinguish initial mount from subsequent data updates:
  - [x] Bull bar: `initial={{ width: "0%" }}`, `animate={{ width: \`${bullPct}%\` }}`, `transition={{ duration: 0.3, ease: "easeOut" }}`
  - [x] Bear bar: `initial={{ width: "0%" }}`, `animate={{ width: \`${bearPct}%\` }}`, `transition={{ duration: 0.3, ease: "easeOut", delay: isFirstRender.current ? 0.15 : 0 }}` — stagger ONLY on first mount
  - [x] Gray "Other" segment (if present): Same stagger pattern as Bear
  - [x] On subsequent data updates (WebSocket/polling), bars smoothly interpolate to new widths from their current position — NO reset to 0%
  - [x] When `shouldReduceMotion` is true, use `transition={{ duration: 0 }}` for instant rendering — no stagger delay
  - [x] Total vote count text should also animate: use `AnimatePresence` + `motion.span` with a subtle fade/scale on count changes
  - [x] Do NOT change the existing layout structure, color classes, or accessibility attributes — only add animation wrappers
  - [x] **Empty state:** When `totalVotes === 0` (no community votes yet), show a "Be the first to vote" placeholder instead of empty bars. This prevents the anticlimactic 0%/0% reveal.
- [x] Task 6: Backend tests for vote broadcast (AC: #3)
  - [x] In `tests/routes/test_vote_broadcast.py` (new file), add tests:
    - [x] Test: Successful vote triggers `broadcast_to_debate` call with correct `DEBATE/VOTE_UPDATE` action
    - [x] Test: `broadcast_to_debate` failure (Exception) does NOT fail the vote write (vote still returns 200)
    - [x] Test: `broadcast_to_debate` timeout (`asyncio.TimeoutError`) does NOT fail the vote write — verify response returns within reasonable latency
    - [x] Test: Broadcast payload contains aggregate counts (not single vote) — validate against `VoteUpdatePayload` Pydantic model schema including field names, types, and `timestamp`
    - [x] Test: Broadcast is NOT called when vote is rejected for duplicate — separate test case
    - [x] Test: Broadcast is NOT called when vote is rejected for rate limit — separate test case (different code path)
    - [x] Test: Broadcast payload has `type == "DEBATE/VOTE_UPDATE"` exactly (prefix safety — AGENTS.md Lesson 3)
    - [x] Test: Two concurrent votes for same debate both succeed and both trigger broadcast (race condition coverage — payloads may have same counts due to race, which is accepted)
  - [x] Mock `DebateConnectionManager.broadcast_to_debate` with `AsyncMock` in route tests — reuse the existing `mock_manager` fixture pattern from `tests/services/debate/conftest.py:124`
  - [x] When patching `app.config.settings`, provide ALL required fields (AGENTS.md Lesson 5):
  - [x] Isolate `DebateConnectionManager` mock from debate engine mock — do NOT share mock state between vote tests and debate tests (AGENTS.md Lesson 2)
- [x] Task 7: Frontend unit tests (AC: #2, #3, #4)
  - [x] **UPDATE existing `tests/unit/SentimentReveal.test.tsx`** (14 tests from Story 3.2): Replace CSS transition class assertions (`transition-all duration-500 ease-out`) with Framer Motion prop assertions. The CSS `<div>` elements become `<motion.div>` — selectors and assertions must adapt.
  - [x] `tests/unit/useDebateSocketVoteUpdate.test.ts` — Test `DEBATE/VOTE_UPDATE` action triggers `onVoteUpdate` callback with correct payload
  - [x] `tests/unit/useDebateSocketVoteUpdate.test.ts` — Test malformed/null payload does NOT crash the hook (graceful handling)
  - [x] `tests/unit/useDebateSocketVoteUpdate.test.ts` — Test rapid sequential `VOTE_UPDATE` events all fire the callback (no debouncing)
  - [x] `tests/unit/useVotingStatusPolling.test.ts` — Test `refetchInterval` is `VOTE_POLL_INTERVAL_MS` when `hasVoted=true`, `false` when `hasVoted=false`; test `refetchIntervalInBackground: false`
  - [x] `tests/unit/SentimentReveal.test.tsx` — Animation tests (all synchronous prop assertions, NO animation timing assertions):
    - [x] Bull bar `animate` prop receives correct `width` from `bullPct`
    - [x] Bear bar `animate` prop receives correct `width` from `bearPct`
    - [x] Bear bar `transition.delay` is `0.15` on first render, `0` on subsequent renders (stagger-on-mount-only)
    - [x] When `shouldReduceMotion` is true, all bars have `transition.duration === 0`
    - [x] Rerender with new percentages updates `animate` prop (smooth interpolation, no key change)
    - [x] Empty state: when `totalVotes === 0`, "Be the first to vote" placeholder is shown
  - [x] Reset any shared WebSocket mock in `beforeEach` — no leaked listeners between tests
  - [x] All tests use Jest 29 + React Testing Library (NOT Vitest) — `jest.fn()`, `jest.mock()`, NEVER `vi.fn()`
  - [x] All tests use `retry: false` in QueryClient config (AGENTS.md pattern)
  - [x] Use `renderHook` from `@testing-library/react` for hook tests (NOT `@testing-library/react-hooks`)
- [x] Task 8: Lint and typecheck (run BEFORE writing tests — Task 6/7 — to catch type errors early)
  - [x] `ruff check .` (backend) — fix all errors
  - [x] `ruff format .` (backend) — fix formatting
  - [x] `npm run lint && npx tsc --noEmit` (frontend) — fix all errors
  - [x] No unused imports, no `any` types

## Dev Notes

### CRITICAL: What Already Exists

| Component | File | Status |
|-----------|------|--------|
| SentimentReveal (basic bar) | `features/debate/components/SentimentReveal.tsx` | Done (Story 3.2) — CSS transitions, no Framer Motion animation yet |
| VoteControls | `features/debate/components/VoteControls.tsx` | Done (Story 3.2) |
| useVote hook | `features/debate/hooks/useVote.ts` | Done — optimistic mutation, sessionStorage persistence |
| useVotingStatus hook | `features/debate/hooks/useVotingStatus.ts` | Done — single fetch, NO polling yet |
| useDebateSocket hook | `features/debate/hooks/useDebateSocket.ts` | Done — 341 lines, no vote handlers yet |
| DebateStream | `features/debate/components/DebateStream.tsx` | Done — 414 lines, `showSentiment` toggle already wired |
| WS action types | `app/services/debate/ws_schemas.py` | Done — NO vote-related actions yet |
| DebateConnectionManager | `app/services/debate/streaming.py` | Done — `broadcast_to_debate(debate_id, action)` method |
| POST /vote route | `app/routes/debate.py:142-291` | Done — 6-guard chain, no broadcast yet |
| GET /result route | `app/routes/debate.py:113-139` | Done — optimized aggregation (Story 3.3) |
| api.ts | `features/debate/api.ts` | Done — `fetchDebateResult()`, `submitVote()` |
| queryKeys | `features/debate/hooks/queryKeys.ts` | Done — `debateResult(debateId)` key |
| storedVote | `features/debate/hooks/storedVote.ts` | Done — VoteChoice type, sessionStorage helpers |

### What This Story Must Create

1. **Backend:** `DEBATE/VOTE_UPDATE` WebSocket action type + payload + broadcast in vote route
2. **Frontend:** `VoteUpdatePayload` type + handler in useDebateSocket + cache update in DebateStream
3. **Frontend:** `refetchInterval: 5000` on useVotingStatus when user has voted
4. **Frontend:** Framer Motion animation on SentimentReveal bars with stagger
5. **Tests:** Backend broadcast tests, frontend WebSocket handler tests, polling tests, animation tests

### What This Story Must NOT Create

- Do NOT create new API endpoints — only the WebSocket action
- Do NOT add Redis caching for votes — explicitly deferred in Story 3.3 adversarial review
- Do NOT create a new Zustand store — React Query cache is the state source
- Do NOT modify the `DebateConnectionManager` class itself — just use its existing `broadcast_to_debate` method

(For the full list of prohibitions including component-level restrictions, see Anti-Pattern Prevention below.)

### PATH CONVENTIONS

**Backend:** All paths relative to `trade-app/fastapi_backend/`
- `app/services/debate/ws_schemas.py` → `trade-app/fastapi_backend/app/services/debate/ws_schemas.py`
- `app/routes/debate.py` → `trade-app/fastapi_backend/app/routes/debate.py`

**Frontend:** All paths relative to `trade-app/nextjs-frontend/` — there is NO `src/` directory
- `features/debate/hooks/useDebateSocket.ts` → `trade-app/nextjs-frontend/features/debate/hooks/useDebateSocket.ts`
- `@/lib/utils` → `trade-app/nextjs-frontend/lib/utils.ts`

### AC1: Already Implemented

AC1 (sentiment hidden for non-voters) is ALREADY DONE in `DebateStream.tsx:231`:
```tsx
const showSentiment = hasVoted || voteStatus === "voted";
// ...
{showSentiment ? <SentimentReveal ... /> : <VoteControls ... />}
```
This story must NOT break this existing behavior. Verify with existing tests.

### Backend Broadcast Pattern

> **Note:** Task 1 subtasks describe the WHAT (step-by-step checklist). This section describes the WHY and HOW (design decisions + code sample). Read both before implementing.

The `DebateConnectionManager` is a singleton instantiated at `app/services/debate/streaming.py:89`:

```python
# app/services/debate/streaming.py:89
connection_manager = DebateConnectionManager()
```

Import it in the vote route:
```python
from app.services.debate.streaming import connection_manager
```

In the vote route, after the successful vote commit:
```python
# After session.commit() for the vote write
try:
    updated_result = await repo.get_result(request.debate_id)
    if updated_result and connection_manager.get_connection_count(request.debate_id) > 0:
        action = WebSocketAction(
            type="DEBATE/VOTE_UPDATE",
            payload=VoteUpdatePayload(
                debate_id=request.debate_id,
                total_votes=updated_result.total_votes,
                vote_breakdown=updated_result.vote_breakdown,
            ).model_dump(by_alias=True),
        )
        await connection_manager.broadcast_to_debate(request.debate_id, action.model_dump(by_alias=True))
except Exception as e:
    logger.warning(f"Vote broadcast failed for debate {request.debate_id}: {e}")
```

**Key decision:** Use `repo.get_result()` to get the authoritative aggregate counts AFTER the vote write. This avoids race conditions where the broadcast might contain stale data. The `get_result()` is optimized (single GROUP BY from Story 3.3) and fast (~3-5ms). This is acceptable overhead for a write path.

**Race condition acknowledged:** Between `repo.get_result()` and `broadcast_to_debate()`, another vote can land. The broadcast payload may be stale by the time it reaches clients. This is accepted as eventual consistency — the polling fallback (Task 4) corrects stale data within 5 seconds. Do NOT add `SELECT ... FOR UPDATE` or serialized transactions. The write-then-read-then-broadcast pattern is pragmatic for current scale.

**Broadcast only on actual insertion:** The broadcast MUST fire only after a successful vote INSERT, not on duplicate vote (200 "already voted") or rate-limited rejection. The vote route's guard chain (Guards 1-6) handles rejections — the broadcast code lives AFTER all guards pass and the DB commit succeeds.

**Alternative considered and rejected:** Computing aggregate in-memory from the just-inserted vote + previous cached counts. Rejected because: (a) introduces a cache invalidation problem, (b) race condition with concurrent votes, (c) `get_result()` is already fast enough.

### Frontend Cache Update Pattern

When the WebSocket delivers a `DEBATE/VOTE_UPDATE`, update the React Query cache directly:

```tsx
const handleVoteUpdate = useCallback((payload: VoteUpdatePayload) => {
  queryClient.setQueryData<DebateResultEnvelope>(
    queryKeys.debateResult(debateId),
    (old) => {
      if (!old?.data) return old;
      return {
        ...old,
        data: {
          ...old.data,
          totalVotes: payload.totalVotes,
          voteBreakdown: payload.voteBreakdown,
        },
      };
    }
  );
}, [queryClient, debateId]);
```

This is the same cache update pattern used in `useVote.ts:65-98` (onSuccess handler). The `useVotingStatus` hook reads from this cache, so it will immediately reflect the update.

**CRITICAL: Use the updater function form.** `setQueryData(key, (old) => new)` reads the latest cache state. `setQueryData(key, newValue)` from a closure reads stale state if multiple updates arrive before React re-renders. Always use the callback form.

**CRITICAL: Use shared query key factory.** Both the WS handler and `useVotingStatus` must reference the same `queryKeys.debateResult(debateId)` from `features/debate/hooks/queryKeys.ts`. Do NOT inline `["debateResult", debateId]` — if the key structure changes, the WS handler silently stops updating the cache.

### useVotingStatus Polling Configuration

```tsx
const VOTE_POLL_INTERVAL_MS = 5000;

const { data, isLoading } = useQuery({
  queryKey: queryKeys.debateResult(debateId),
  queryFn: () => fetchDebateResult(debateId),
  enabled: !!debateId,
  refetchInterval: hasVoted ? VOTE_POLL_INTERVAL_MS : false,
  refetchIntervalInBackground: false,
});
```

**Why 5 seconds?** Fast enough to catch updates when WS is down (AC4 requires "within a reasonable time"). Slow enough to not thrash the DB under load (NFR-04: 10K concurrent voters × 0.2 qps = 2K qps — well within Postgres capacity for the optimized GROUP BY).

**Why `refetchIntervalInBackground: false`?** Don't waste resources when the tab is hidden. The user isn't looking at the data anyway. When they return, React Query will refetch if the data is stale.

### SentimentReveal Animation Design

The reveal animation should feel like a "curtain lifting" — bars grow sequentially on first mount, then smoothly interpolate on data updates.

#### Initial Mount (the "Reveal")

1. **Bull bar** grows from 0% to `bullPct%` — duration 300ms, ease-out
2. **150ms later**, Bear bar grows from 0% to `bearPct%` — duration 300ms, ease-out
3. Total animation time: ~450ms — fast enough to feel snappy, slow enough to create "reveal" drama

Use an `isFirstRender` ref to gate the stagger to first mount only:
```tsx
const isFirstRender = useRef(true);
useEffect(() => { isFirstRender.current = false; }, []);
```

#### Subsequent Updates (WebSocket / Polling)

When new data arrives, Framer Motion interpolates from the bar's **current position** to the new target width. The bar never resets to 0%. This is the correct Framer Motion pattern — let the library handle animation interruption natively.

```tsx
<motion.div
  className="h-3 rounded-full bg-emerald-500"
  initial={{ width: "0%" }}
  animate={{ width: `${bullPct}%` }}
  transition={{
    duration: shouldReduceMotion ? 0 : 0.3,
    ease: "easeOut",
  }}
/>
<motion.div
  className="h-3 rounded-full bg-rose-500"
  initial={{ width: "0%" }}
  animate={{ width: `${bearPct}%` }}
  transition={{
    duration: shouldReduceMotion ? 0 : 0.3,
    ease: "easeOut",
    delay: (shouldReduceMotion || !isFirstRender.current) ? 0 : 0.15,
  }}
/>
```

**Key decisions (from adversarial review):**
- **Do NOT use `key`-based re-animation.** Changing the `key` forces React to unmount/remount the DOM node, resetting the bar to 0% and replaying the full animation. Under rapid vote sequences, this causes visible flashing/stuttering. The `animate` interpolation approach keeps the same DOM node and smoothly transitions.
- **Do NOT use `layoutId` or `layout` animations.** These cause layout thrashing (existing constraint, unchanged).
- **Duration reduced from 500ms to 300ms** based on UX review feedback — snappier feel while preserving the reveal effect.
- **Empty state:** When `totalVotes === 0`, show "Be the first to vote" placeholder text instead of 0% bars. Prevents anticlimactic reveal.

**Reduced motion:** When `shouldReduceMotion` is true, all animations use `duration: 0` and `delay: 0` — instant rendering, no stagger. This is a WCAG AA requirement (already followed in Story 3.2).

### WebSocket Action Type Registration

In `ws_schemas.py`, the `WebSocketActionType` is a `Literal[...]`. Add `"DEBATE/VOTE_UPDATE"` to the list. Follow the exact pattern of existing entries:

```python
WebSocketActionType = Literal[
    "DEBATE/CONNECTED",
    "DEBATE/TOKEN_RECEIVED",
    # ... existing entries ...
    "DEBATE/GUARDIAN_INTERRUPT_ACK",
    "DEBATE/VOTE_UPDATE",  # NEW — Story 3.4
]
```

**CRITICAL:** All WebSocket actions use `DEBATE/` prefix. There are NO `GUARDIAN/` or `VOTE/` prefixed actions (AGENTS.md Lesson 3). The action is `DEBATE/VOTE_UPDATE`, NOT `VOTE/UPDATE`.

### DebateConnectionManager Access Pattern

The manager singleton is at `app/services/debate/streaming.py:89` as `connection_manager`. Import directly:

```python
from app.services.debate.streaming import connection_manager
```

If this creates a circular import, use a lazy import inside the route function.

### Testing Requirements

**Backend (Python):**
- Use `engine`/`db_session` fixtures from `tests/conftest.py` — PostgreSQL ONLY (AGENTS.md Lesson 7)
- Mock `DebateConnectionManager.broadcast_to_debate` with `AsyncMock`
- Run with `.venv/bin/python -m pytest tests/routes/test_vote_broadcast.py`

**Frontend (TypeScript):**
- Jest 29 + React Testing Library — NOT Vitest
- Use `jest.fn()` and `jest.mock()` — NEVER `vi.fn()`
- React Query wrapper: `new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })`
- Run with `npm run test -- tests/unit/useDebateSocketVoteUpdate.test.ts`

### Anti-Pattern Prevention

- **DO NOT** use `VOTE/` prefix on WebSocket actions — ALL actions use `DEBATE/` prefix (AGENTS.md Lesson 3)
- **DO NOT** broadcast individual vote data — only broadcast aggregate counts to protect voter privacy
- **DO NOT** block the vote write on broadcast success — wrap broadcast in try/except, log failures, always return 200 for successful votes
- **DO NOT** add Redis caching for vote aggregation — explicitly rejected in Story 3.3 adversarial review
- **DO NOT** use Framer Motion `layoutId` or `layout` animations on bar segments — these cause layout thrashing
- **DO NOT** use `key`-based re-animation for vote update transitions — it forces unmount/remount and causes visual flashing under rapid votes. Use `animate` interpolation instead (adversarial review consensus: Winston, Amelia, Murat)
- **DO NOT** change the `SentimentReveal` component's existing props interface — keep `{ voteBreakdown, totalVotes }`
- **DO NOT** use `any` type anywhere — use specific interfaces
- **DO NOT** modify `useVote.ts` — it's complete and stable
- **DO NOT** create a Zustand store for vote counts — React Query cache is the state source
- **DO NOT** add `undecided` as a VoteControls button choice — only `bull` and `bear` are user-selectable (established in Story 3.1)
- **DO NOT** use `datetime.utcnow()` — always `datetime.now(timezone.utc)` (AGENTS.md)
- **DO NOT** modify `DebateStream.tsx`'s Guardian freeze logic, message handling, or virtualizer — only add the vote update handler and wire it
- **DO NOT** use `GUARDIAN/` prefix on any actions — all use `DEBATE/` prefix
- **DO NOT** break the existing `showSentiment` logic in DebateStream — AC1 depends on it
- **DO NOT** use `setQueryData(key, directValue)` — always use the **updater function form** `setQueryData(key, (old) => newValue)` to avoid stale closure reads
- **DO NOT** inline query key arrays in the WS handler — use the shared `queryKeys.debateResult(debateId)` factory to prevent silent breakage
- **DO NOT** fire broadcast on rejected votes (duplicate, rate limit) — only on actual vote INSERT
- **DO NOT** test Framer Motion animation timing (e.g., waiting for frames) — use synchronous prop assertions on `animate` and `transition` values

### Architecture Compliance

- **WebSocket Action structure:** All actions follow `{ type, payload, timestamp }` envelope (architecture.md Communication Patterns)
- **Payload serialization:** `VoteUpdatePayload` uses `serialization_alias` for camelCase (`debateId`, `totalVotes`, `voteBreakdown`) — NOT `alias_generator=to_camel` since the existing payloads in `ws_schemas.py` use per-field aliases
- **Standard envelope:** The HTTP response shape is unchanged — only the WebSocket gets a new action
- **Feature-based organization:** Frontend types stay in `features/debate/hooks/useDebateSocket.ts`, components in `features/debate/components/`

### Previous Story Intelligence (Story 3.1, 3.2, 3.3)

Key learnings:

1. **`DebateResultResponse` has `totalVotes` and `voteBreakdown`** — the WebSocket payload reuses the same shape. No schema changes needed.
2. **`useVotingStatus` never refetches** — this story fixes it with `refetchInterval` (deferred from 3.2 code review).
3. **`DebateStream` is becoming a god component (414 lines)** — acknowledged in Story 3.2 party review. Do NOT decompose in this story. Add minimal code only.
4. **`get_result()` is optimized** (Story 3.3) — single GROUP BY, ~3-5ms. Safe to call on every vote write for broadcast payload.
5. **Config patching landmine** — every test that patches `settings` must provide ALL required fields (AGENTS.md Lesson 5). This story does NOT add new config fields.
6. **`Vote.debate_id` is a UUID** — the route receives `external_id` (string) and resolves internally.
7. **Framer Motion is already installed** — used by DebateStream, ArgumentBubble, GuardianOverlay. No new dependency needed.
8. **`SentimentReveal` already handles "Other" (undecided) votes** — gray `bg-slate-500` segment, `otherPct` calculation. Preserve this.
9. **SentimentReveal already has `aria-live="polite"` and `role="region"`** — screen readers will announce updates automatically when vote counts change via cache update.

### References

- [Source: `app/services/debate/ws_schemas.py`] — WebSocket action types and payload models
- [Source: `app/services/debate/streaming.py:32-68`] — `DebateConnectionManager` with `broadcast_to_debate` method
- [Source: `app/routes/debate.py:142-291`] — POST /vote route with 6-guard chain
- [Source: `app/routes/debate.py:113-139`] — GET /result route (optimized in Story 3.3)
- [Source: `features/debate/hooks/useDebateSocket.ts`] — WebSocket hook (341 lines)
- [Source: `features/debate/hooks/useVotingStatus.ts`] — Vote status hook (needs polling)
- [Source: `features/debate/components/SentimentReveal.tsx`] — Basic bar component (needs Framer Motion)
- [Source: `features/debate/components/DebateStream.tsx:231`] — `showSentiment` toggle
- [Source: `features/debate/hooks/useVote.ts:65-98`] — React Query cache update pattern (reuse this pattern)
- [Source: `features/debate/api.ts`] — API client with `fetchDebateResult`
- [Source: `AGENTS.md` Lessons 1-9] — Critical bug prevention rules
- [Source: `_bmad-output/implementation-artifacts/3-3-sentiment-aggregation-service.md`] — Story 3.3 (optimized get_result)
- [Source: `_bmad-output/implementation-artifacts/3-2-voting-ui-components.md`] — Story 3.2 (VoteControls, SentimentReveal, useVote)
- [Source: `_bmad-output/implementation-artifacts/3-1-voting-api-data-model.md`] — Story 3.1 (API contract, guard chain)
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`] — "Visceral Confidence" animation philosophy, reduced-motion requirements

## Dev Agent Record

### Agent Model Used

GLM 5.1

### Debug Log References

- Patch target for `connection_manager` must be `app.services.debate.streaming.connection_manager` (lazy import), not `app.routes.debate.connection_manager`
- Framer Motion `motion.div` mock strips `animate` prop — test mock must apply `animate` values as `style` for `toHaveStyle` assertions

### Completion Notes List

- Task 1: Added `DEBATE/VOTE_UPDATE` to `WebSocketActionType`, created `VoteUpdatePayload` model, wired broadcast into vote route with lazy import, try/except, connection count check
- Task 2: Added `VoteUpdatePayload` interface, `onVoteUpdate` callback, switch case handler with malformed payload guard, updated union type and exports
- Task 3: Added `handleVoteUpdate` with `useCallback` and updater function form, wired `onVoteUpdate` to socket, imported `useQueryClient`, `queryKeys`, `DebateResultEnvelope`
- Task 4: Added `VOTE_POLL_INTERVAL_MS = 5000` constant, `refetchInterval` and `refetchIntervalInBackground` to `useQuery` options
- Task 5: Replaced CSS transition divs with Framer Motion `motion.div`, added `isFirstRender` ref for stagger-on-mount, `AnimatePresence` for vote count, "Be the first to vote" empty state
- Task 6: Created `tests/routes/test_vote_broadcast.py` with 9 tests covering broadcast success, failure isolation, timeout, aggregate payload, duplicate/rate-limit rejection, prefix safety, concurrent votes, no-WS-clients optimization
- Task 7: Updated `SentimentReveal.test.tsx` (15 tests including new rerender test), created `useDebateSocketVoteUpdate.test.ts` (3 tests), `useVotingStatusPolling.test.ts` (3 tests)
- Task 8: `ruff check` clean, `ruff format` clean, `tsc --noEmit` clean (source files), `eslint` clean (source files — removed unused `cn` import)

### File List

- `trade-app/fastapi_backend/app/services/debate/ws_schemas.py` — Modified: added `DEBATE/VOTE_UPDATE` to action type, added `VoteUpdatePayload` model
- `trade-app/fastapi_backend/app/routes/debate.py` — Modified: added broadcast logic after successful vote commit
- `trade-app/nextjs-frontend/features/debate/hooks/useDebateSocket.ts` — Modified: added `VoteUpdatePayload` interface, `onVoteUpdate` callback, handler, union type
- `trade-app/nextjs-frontend/features/debate/hooks/useVotingStatus.ts` — Modified: added polling fallback with `VOTE_POLL_INTERVAL_MS`
- `trade-app/nextjs-frontend/features/debate/hooks/index.ts` — Modified: added `VoteUpdatePayload` export
- `trade-app/nextjs-frontend/features/debate/components/SentimentReveal.tsx` — Modified: replaced CSS transitions with Framer Motion animations, added empty state
- `trade-app/nextjs-frontend/features/debate/components/DebateStream.tsx` — Modified: added `handleVoteUpdate` callback and wired to socket
- `trade-app/fastapi_backend/tests/routes/test_vote_broadcast.py` — New: 9 backend broadcast tests
- `trade-app/nextjs-frontend/tests/unit/SentimentReveal.test.tsx` — Modified: updated 14 tests for Framer Motion, added 1 rerender test (15 total)
- `trade-app/nextjs-frontend/tests/unit/useDebateSocketVoteUpdate.test.ts` — New: 3 WebSocket vote update handler tests
- `trade-app/nextjs-frontend/tests/unit/useVotingStatusPolling.test.ts` — New: 3 polling configuration tests

### Change Log

 - 2026-04-12: Story created from Epic 3 context, Stories 3.1-3.3 intelligence, and full codebase analysis.
 - 2026-04-12: Adversarial party-mode review (Winston/Architect, Amelia/Dev, Murat/Test Architect, John/PM). Changes:
   - **Animation:** Replaced key-based re-animation with animate interpolation + isFirstRender ref (consensus: all agents). Duration 500ms→300ms. Added empty state placeholder.
   - **Task 1:** Added explicit VoteUpdatePayload schema with types. Added race condition acknowledgment. Clarified broadcast only on actual INSERT (not duplicate/rate-limit).
   - **Task 2:** Added malformed payload guard on WS handler.
   - **Task 3:** Mandated updater function form for setQueryData (stale closure prevention). Mandated useCallback wrapping. Mandated shared query key factory.
   - **Task 4:** Extracted polling interval to named constant VOTE_POLL_INTERVAL_MS.
   - **Task 6:** Added 8 test cases (was 4): timeout test, schema validation, separate duplicate/rate-limit paths, concurrent votes test, prefix safety, full config patching, mock isolation.
   - **Task 7:** Expanded to 12+ test cases (was 5): malformed payload, rapid events, synchronous prop assertions (no timing), empty state, shared mock reset, renderHook clarification.
   - **Task 8:** Moved lint/typecheck to run BEFORE tests.
    - **Anti-patterns:** Added 7 new entries (key-based re-animation, setQueryData direct form, inline query keys, broadcast on rejection, animation timing tests).
  - 2026-04-12: Story validation — 1 critical + 5 enhancements + 2 optimizations applied:
     - **C1:** Fixed `connection_manager` singleton location to confirmed `app/services/debate/streaming.py:89` (was "likely" in wrong paths). Updated import in Task 1 and Dev Notes.
     - **E1:** Changed `action.model_dump()` to `action.model_dump(by_alias=True)` to match all 13 existing broadcast calls in codebase.
     - **E2:** Added note to Task 7 about updating existing `SentimentReveal.test.tsx` (14 tests from Story 3.2) when CSS transitions are replaced with Framer Motion.
     - **E3:** Referenced existing `mock_manager` fixture in `tests/services/debate/conftest.py:124` for Task 6.
     - **E4:** Added `get_connection_count` check to Task 1 subtasks (was only in Dev Notes).
     - **E5:** Updated Task 1 import subtask with confirmed singleton path.
     - **O1:** Added Task/Dev Notes redundancy note to Backend Broadcast Pattern section.
     - **O2:** Deduplicated "Must NOT Create" / "Anti-Pattern Prevention" overlap.
  - 2026-04-12: Story implementation complete. All 8 tasks done. 9 backend tests pass, 21 frontend tests pass (15 SentimentReveal + 3 WS + 3 polling). No regressions.
  - 2026-04-12: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 5 dismissed (4 false positives, 1 intentional). 4 patches applied, 2 deferred.

### Review Findings

- [x] [Review][Patch] Broad `except Exception` swallows programming errors silently [`app/routes/debate.py:309`] — Split into expected (ConnectionError, OSError, asyncio.TimeoutError at WARNING) vs unexpected (ERROR with exc_info). Added `import asyncio`.
- [x] [Review][Patch] No test for `get_result` returning `None` during broadcast [`tests/routes/test_vote_broadcast.py`] — Added `test_no_broadcast_when_get_result_returns_none`.
- [x] [Review][Patch] No test for undecided votes in broadcast payload [`tests/routes/test_vote_broadcast.py`] — Added `test_broadcast_payload_includes_undecided_votes`.
- [x] [Review][Patch] Polling tests don't verify actual `refetchInterval` config in useQuery [`tests/unit/useVotingStatusPolling.test.ts`] — Added 2 tests verifying observer options via `queryClient.getQueryCache()`.
- [x] [Review][Defer] Percentage rounding can produce `bullPct + bearPct = 101%` bar overflow [`SentimentReveal.tsx:45-47`] — deferred, pre-existing `Math.round` behavior, mitigated by `overflow-hidden`
- [x] [Review][Defer] Polling + WS both active — stale poll can overwrite fresher WS update for ~5s [`useVotingStatus.ts:25` + `DebateStream.tsx:202`] — deferred, accepted eventual consistency per spec
