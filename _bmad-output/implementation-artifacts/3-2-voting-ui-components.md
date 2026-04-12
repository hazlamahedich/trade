# Story 3.2: Voting UI Components

Status: done

## Story

As a User,
I want to click "Bull Won" or "Bear Won" during a debate,
So that I can express my opinion.

## Acceptance Criteria

1. **AC1: Optimistic UI Update** — Given the Voting Controls in the UI, When I tap a vote button, Then it updates immediately to a "Voted" state (Optimistic UI). The button shows a loading/confirmed state instantly before the API responds.
2. **AC2: Sentiment Reveal Transition** — Given the "Voted" state, When the API confirms success, Then the UI transitions to show the Sentiment Reveal. NOTE: Story 3.4 owns the full reveal animation; this story creates the transition trigger and a placeholder/basic reveal component.
3. **AC3: Rollback on Failure** — Given an API failure, When voting fails (network error, 429 rate limit, 503 voting disabled), Then the UI reverts the optimistic update and shows a toast error with a human-readable message from the error envelope. Both vote buttons are disabled while a mutation is in-flight to prevent concurrent optimistic updates.
4. **AC4: Already Voted State Detection** — Given a user returning to a debate they previously voted on, When the page loads, Then the UI detects the prior vote (via `GET /api/debate/{id}/result` + `sessionStorage` fallback) and shows the SentimentReveal instead of VoteControls. The 409 `DUPLICATE_VOTE` response displays honest messaging ("Your vote is already counted") rather than a generic success confirmation.
5. **AC5: Guardian Freeze Interaction** — Given a Guardian freeze is active, When vote controls are visible, Then vote controls are **disabled** (not hidden) with a micro-label "Voting paused during risk review" visible to the user. Controls remain spatially consistent so users maintain trust in the bottom bar's reliability.

## Tasks / Subtasks

- [x] Task 1: Create vote API client module (AC: #1, #3)
  - [x] Create `features/debate/api.ts` with typed fetch functions for `POST /api/debate/vote` and `GET /api/debate/{id}/result`
  - [x] Use `process.env.NEXT_PUBLIC_API_URL` as base URL (matches `clientConfig.ts` pattern)
  - [x] Define TypeScript interfaces matching backend `VoteRequest`, `VoteResponse`, `DebateResultResponse` schemas (all `camelCase` keys)
  - [x] Handle standard envelope: `{ data, error, meta }` — extract `data` on success, throw typed error on failure
  - [x] Generate `voterFingerprint` client-side: `crypto.randomUUID()` or hash of session storage ID (1-128 chars, anonymous-first design)
  - [x] Cache fingerprint in `sessionStorage` for consistency across page reloads within a session
- [x] Task 2: Create `useVote` hook with optimistic update (AC: #1, #2, #3, #4)
  - [x] Create `features/debate/hooks/useVote.ts`
  - [x] State machine: `idle` → `voting` (optimistic) → `voted` (confirmed) or `error` (rollback)
  - [x] Use React Query `useMutation` with `onMutate` for optimistic update, `onError` for rollback, `onSuccess` for confirmation, `onSettled` for cache invalidation & refetch
  - [x] **Race condition guard:** Disable both buttons while mutation is in-flight. The hook must reject/ignore any `vote()` call when `voteStatus === "voting"`. No concurrent optimistic updates allowed.
  - [x] Track `userVote` choice in hook state (persisted to `sessionStorage` keyed by `debateId`)
  - [x] Handle all error codes: `DUPLICATE_VOTE` (409), `RATE_LIMITED` (429), `VOTING_DISABLED` (503), `DEBATE_NOT_ACTIVE` (422), `DEBATE_NOT_FOUND` (404)
  - [x] **409 DUPLICATE_VOTE dual path:** (a) If optimistic update already set `userVote`, confirm and show "Your vote is already counted". (b) If optimistic update was NOT set (e.g. cross-tab scenario), restore from server response and set `voteStatus="voted"`. Display honest messaging — NOT a generic "Vote recorded!" success.
  - [x] **Cache invalidation:** On `onSettled`, call `queryClient.invalidateQueries({ queryKey: queryKeys.debateResult(debateId) })` to ensure sentiment data stays fresh after mutation (success or failure).
  - [x] Expose: `{ vote, userVote, voteStatus, error }` where `voteStatus` is `"idle" | "voting" | "voted" | "error"`
- [x] Task 3: Create `VoteControls` component (AC: #1, #5)
  - [x] Create `features/debate/components/VoteControls.tsx`
  - [x] Two buttons: "Bull Won" (emerald) and "Bear Won" (rose) — dual-coded with icon + text + color
  - [x] Icons: `TrendingUp` (Bull) and `TrendingDown` (Bear) from `lucide-react` (project's icon library)
  - [x] States per button: `default`, `selected` (user chose this), `disabled` (user chose other, voting in progress, OR Guardian freeze active)
  - [x] **Disable during mutation:** Both buttons receive `disabled={voteStatus === "voting"}` to prevent race conditions from rapid double-clicks
  - [x] **Guardian freeze state:** When `isFrozen` is true, buttons are disabled (NOT hidden) and a micro-label "Voting paused during risk review" is displayed. This preserves spatial consistency and user trust.
  - [x] Use Shadcn `Button` component as base (`components/ui/button.tsx`)
  - [x] Color scheme: Bull = `bg-emerald-500 hover:bg-emerald-600`, Bear = `bg-rose-500 hover:bg-rose-600` (matches `ArgumentBubble.tsx` pattern)
  - [x] Fixed at bottom of DebateStream area (thumb zone — bottom 15vh per UX spec)
  - [x] Keyboard accessible: `<button>` elements with clear `aria-label` ("Vote Bull Won — cannot be changed", "Vote Bear Won — cannot be changed") — communicate permanence
  - [x] `data-testid="vote-bull-btn"` and `data-testid="vote-bear-btn"` (matches existing E2E `voting.spec.ts`)
  - [x] Respect `prefers-reduced-motion`: disable press animations when active
  - [x] **`aria-live="polite"` region** wrapping the control area for screen reader announcements on state changes ("Your vote has been recorded", "Voting paused", etc.)
- [x] Task 4: Create `SentimentReveal` placeholder component (AC: #2)
  - [x] Create `features/debate/components/SentimentReveal.tsx`
  - [x] Shows after user votes: basic horizontal bar with Bull % vs Bear %
  - [x] **Zero-votes state:** If `totalVotes === 0`, show "No votes yet" placeholder text instead of an empty bar. Avoid division by zero.
  - [x] **Tie state:** If Bull% === Bear%, show equal-width bars with no "winner" highlight.
  - [x] Animate bar width from 0 to final % — use CSS `transition: width 500ms ease-out` via Tailwind `transition-all duration-500 ease-out`. Framer Motion is NOT required for this simple width animation (avoid pulling in 32KB for a bar transition). If Story 3.4 adds complex staggered animations, Framer Motion can be introduced then.
  - [x] Colors: Bull portion = `bg-emerald-500`, Bear portion = `bg-rose-500` (matches `ArgumentBubble.tsx` palette)
  - [x] Include total vote count text
  - [x] `aria-label` on bar: `"Bull: X%, Bear: Y%"` (dual-coding for colorblind users)
  - [x] **Boundary labels:** At extreme ratios (e.g., 99%/1%), always show text labels for both sides, not just color — the thin slice is unreadable without text.
  - [x] `data-testid="sentiment-reveal"` for E2E testing
  - [x] `aria-live="polite"` on the container so screen readers announce vote results after voting
  - [x] NOTE: Full real-time polling/WebSocket updates are Story 3.4. This story shows a static snapshot from the vote response.
- [x] Task 5: Create `useVotingStatus` hook for debate-level vote state (AC: #1, #4)
  - [x] Create `features/debate/hooks/useVotingStatus.ts`
  - [x] **Server-side authority first:** Use React Query `useQuery` to fetch `GET /api/debate/{id}/result` — this is the primary source of truth for vote state, not `sessionStorage`.
  - [x] **sessionStorage fallback:** On mount, check `sessionStorage` for existing vote on this `debateId` as a fast local hint, but always reconcile with the server response when it arrives. `sessionStorage` is per-tab and does NOT sync across tabs (no `storage` event). See "Voter Fingerprint Strategy" caveats below.
  - [x] Refetch on vote success (via `queryClient.invalidateQueries` in `useVote`'s `onSettled`)
  - [x] Expose: `{ hasVoted, userChoice, voteCounts, isLoading }`
- [x] Task 6: Integrate VoteControls into DebateStream (AC: #1, #2, #3, #5)
  - [x] Add `VoteControls` below the message list in `DebateStream.tsx`, above the connection status indicator
  - [x] Show `VoteControls` when debate is active; show `SentimentReveal` after user votes
  - [x] **Track debate status:** Add `const [debateStatus, setDebateStatus] = useState<string>("running")` to DebateStream. Wire `useDebateSocket`'s `onStatusUpdate` callback to `setDebateStatus(payload.status)`. The `onStatusUpdate` callback exists in `useDebateSocket` (line 108, 228) but is NOT currently consumed in DebateStream — you MUST wire it. The `DEBATE/STATUS_UPDATE` action provides `payload.status` values: `"running"`, `"completed"`, `"paused"`, `"cancelled"`.
  - [x] **Guardian freeze:** When `isFrozen` is true, DISABLE vote controls (do NOT hide them). Show "Voting paused during risk review" micro-label. This preserves spatial consistency so users maintain trust in the bottom bar. (AC: #5)
  - [x] Disable vote controls when `debateStatus !== "running"` (uses the new state from `onStatusUpdate` wiring above)
  - [x] Disable vote controls when connection is not `"connected"` (offline prevention — `isConnected` already returned by `useDebateSocket`)
  - [x] **Focus management:** When vote controls transition from enabled → disabled (freeze), do NOT trap focus — allow natural tab-away. When controls re-enable after freeze, do not auto-focus. When vote completes and SentimentReveal replaces VoteControls, move focus to the SentimentReveal container with `aria-live` announcement.
  - [x] Wire toast error notifications — project does NOT currently have a toast library installed. Add `sonner` (`pnpm add sonner`) and add `<Toaster />` from `sonner` to the app layout. Use `toast.error(msg)` for vote error toasts. Configure `<Toaster position="top-center" />` to avoid overlapping with the sticky bottom vote bar on mobile.
  - [x] **Toast positioning:** On mobile, toasts must render ABOVE the sticky bottom bar (not at viewport bottom where they'd overlap vote controls). Configure toast container offset or use `position="top"` for vote-related toasts.
- [x] Task 7: Update barrel exports (AC: #1)
  - [x] Add `VoteControls`, `SentimentReveal` to `features/debate/components/index.ts`
  - [x] Add `useVote`, `useVotingStatus` to `features/debate/hooks/index.ts`
- [x] Task 7.5: Create centralized query key factory (AC: #1, #2, #3)
  - [x] Create `features/debate/hooks/queryKeys.ts` — single source of truth for all React Query cache keys used by debate features
  - [x] Define: `debateResult: (debateId: string) => ["debate", debateId, "result"]` and any other keys needed
  - [x] Import and use in `useVote` (for invalidation in `onSettled`) and `useVotingStatus` (for `useQuery` key)
  - [x] Audit existing hooks (`useDebateSocket`, etc.) for any debate-related query keys — align if conflicts exist
- [x] Task 8: Unit tests for VoteControls (AC: #1, #3, #5)
  - [x] Test: renders both vote buttons with correct labels and icons
  - [x] Test: clicking Bull button triggers `vote("bull")` callback
  - [x] Test: clicking Bear button triggers `vote("bear")` callback
  - [x] Test: buttons disabled when `voteStatus === "voting"`
  - [x] Test: **rapid double-click** — second click is ignored when `voteStatus === "voting"` (race condition guard)
  - [x] Test: selected state styling on voted button
  - [x] Test: buttons have correct `aria-label` attributes (must include "cannot be changed" permanence hint)
  - [x] Test: `data-testid` attributes present
  - [x] Test: reduced motion respected (no animation classes)
  - [x] Test: **Guardian freeze state** — buttons disabled with "Voting paused" micro-label when `isFrozen=true`, controls remain visible (NOT hidden)
  - [x] Test: **keyboard navigation** — Tab reaches buttons, Enter/Space triggers vote, focus ring visible
  - [x] Test: **`aria-live` region** present for vote status announcements
  - [x] Test: **disabled state** communicates reason to screen readers (`aria-disabled` with explanation)
  - [x] File: `tests/unit/VoteControls.test.tsx`
- [x] Task 9: Unit tests for useVote hook (AC: #1, #2, #3, #4)
  - [x] Test: initial state is `idle` with no `userVote`
  - [x] Test: `vote("bull")` transitions to `voting` immediately (optimistic) — assert IMMEDIATELY after `fireEvent`, no `waitFor`
  - [x] Test: API success transitions to `voted` with correct choice
  - [x] Test: API 409 DUPLICATE_VOTE — **Path A:** optimistic update already set → confirm with "Your vote is already counted" message
  - [x] Test: API 409 DUPLICATE_VOTE — **Path B:** optimistic update NOT set → force `voted` state with stored choice
  - [x] Test: API 429 RATE_LIMITED transitions to `error` and shows toast
  - [x] Test: API 503 VOTING_DISABLED transitions to `error` and shows toast with degradation message
  - [x] Test: API network error transitions to `error` and reverts optimistic update
  - [x] Test: `userVote` persisted to sessionStorage
  - [x] Test: `userVote` loaded from sessionStorage on mount
  - [x] Test: **race condition rejection** — calling `vote()` while `voteStatus === "voting"` is a no-op (no second API call)
  - [x] Test: **component unmount during mutation** — verify no state update after unmount, query cache is cleaned
  - [x] Test: **cache invalidation** — `queryClient.invalidateQueries` called with correct key in `onSettled`
  - [x] Test: **concurrent debates** — two hook instances with different `debateId`s don't cross-contaminate state
  - [x] **React Query wrapper config:** All hook tests MUST use `new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })` to prevent 3x retries slowing/flaking tests
  - [x] File: `tests/unit/useVote.test.ts`
- [x] Task 10: Unit tests for SentimentReveal (AC: #2)
  - [x] Test: renders vote percentages in bar
  - [x] Test: renders total vote count
  - [x] Test: `aria-label` contains correct percentages
  - [x] Test: bar widths match percentages
  - [x] Test: **zero-votes state** — shows "No votes yet" placeholder, no division by zero
  - [x] Test: **tie state** — both bars equal width
  - [x] Test: **extreme ratio** (99%/1%) — both sides have text labels visible
  - [x] Test: **reduced motion** — bar uses instant transition (no animation duration)
  - [x] Test: `aria-live="polite"` container present for screen reader announcements
  - [x] File: `tests/unit/SentimentReveal.test.tsx`
- [x] Task 10.5: Unit tests for useVotingStatus hook (AC: #1, #4)
  - [x] Test: initial state has `hasVoted=false`, `userChoice=null` when no prior vote
  - [x] Test: `hasVoted=true` when server returns result with matching `voterFingerprint` in vote counts (or when sessionStorage has stored choice)
  - [x] Test: **server-first authority** — `userChoice` reflects server response, not just sessionStorage
  - [x] Test: **sessionStorage fallback** — when server fetch is loading, `hasVoted` shows sessionStorage hint immediately
  - [x] Test: **reconciliation** — if sessionStorage says "bull" but server says no vote, trust server (revert to `hasVoted=false`)
  - [x] Test: **cache refetch** — after `useVote` invalidation, `useVotingStatus` refetches and returns fresh `voteCounts`
  - [x] Test: `isLoading` is true during initial fetch, false after
  - [x] Test: **React Query wrapper** with `retry: false` config (same as Task 9)
  - [x] File: `tests/unit/useVotingStatus.test.ts`
- [x] Task 10.6: Unit tests for queryKeys factory (AC: #1, #2, #3)
  - [x] Test: `queryKeys.debateResult("abc")` returns `["debate", "abc", "result"]`
  - [x] Test: keys are deterministic (same input → same output)
  - [x] Test: different debateIds produce different keys
  - [x] File: `tests/unit/queryKeys.test.ts`
- [x] Task 11: Lint and typecheck
  - [x] `npm run lint` — fix all errors
  - [x] `npx tsc --noEmit` — fix all type errors
  - [x] No `any` types — use `unknown` or specific interfaces
  - [x] No unused imports

## Dev Notes

### ⚠️ PATH CONVENTION: Frontend Root

All frontend file paths in this story are relative to **`trade-app/nextjs-frontend/`** — there is NO `src/` directory. The `@/` alias in imports resolves to this frontend root (configured in `tsconfig.json`). Examples:
- `@/lib/utils` → `trade-app/nextjs-frontend/lib/utils.ts`
- `@/components/ui/button` → `trade-app/nextjs-frontend/components/ui/button.tsx`
- `features/debate/hooks/useVote.ts` → `trade-app/nextjs-frontend/features/debate/hooks/useVote.ts`

### CRITICAL: What Already Exists

| Component | File | Status |
|-----------|------|--------|
| Vote API backend | `app/routes/debate.py:114-153` | Done (Story 3.1) — `POST /api/debate/vote`, `GET /api/debate/{id}/result` |
| Vote Pydantic schemas | `app/services/debate/vote_schemas.py` | Done — `VoteRequest`, `VoteResponse`, `DebateResultResponse`, envelopes |
| Vote SQLAlchemy model | `app/models.py:53-75` | Done — UUID PK, `debate_id` FK, `choice`, `voter_fingerprint` |
| Debate model | `app/models.py:31-50` | Done — `status` field (default `"running"`) |
| DebateStream component | `features/debate/components/DebateStream.tsx` | Done — 376 lines, receives `debateId` prop |
| Shadcn Button | `components/ui/button.tsx` | Available |
| Shadcn Dialog | `components/ui/dialog.tsx` | Available (used by GuardianOverlay) |
| Framer Motion | Already installed | Used by DebateStream, ArgumentBubble, GuardianOverlay |
| Lucide React | Already installed | Used across components |
| **Sonner (toast)** | **NOT installed** | **Must add via `pnpm add sonner`** — project has no toast library. Add `<Toaster />` to app layout. |
| `cn()` utility | `lib/utils.ts` | `twMerge(clsx(...))` pattern |
| E2E voting test | `tests/e2e/voting.spec.ts` | Exists — uses `data-testid="vote-bull-btn"`, `vote-bear-btn`, `voting-panel`, `sentiment-reveal` |

### What This Story Must Create

1. **Install `sonner`** — `pnpm add sonner`, add `<Toaster position="top-center" />` to app layout (no toast lib exists yet)
2. **`features/debate/api.ts`** — Typed vote API client (auto-generated OpenAPI client does NOT include vote endpoints)
2. **`features/debate/hooks/useVote.ts`** — Optimistic vote mutation hook
3. **`features/debate/hooks/useVotingStatus.ts`** — Debate-level vote state query hook
4. **`features/debate/components/VoteControls.tsx`** — Two-button voting UI
5. **`features/debate/components/SentimentReveal.tsx`** — Basic bar chart (placeholder for Story 3.4)
6. **Unit tests** for all new components and hooks

### API Contract (from Story 3.1 Backend)

**POST `/api/debate/vote`**
```typescript
// Request body (camelCase per Pydantic alias)
interface VoteRequest {
  debateId: string;      // min 1 char
  choice: "bull" | "bear" | "undecided";
  voterFingerprint: string;  // 1-128 chars, client-generated
}

// Success response (200)
interface VoteSuccessEnvelope {
  data: {
    voteId: string;
    debateId: string;
    choice: string;
    voterFingerprint: string; // Returned by backend but frontend doesn't need to use it
    createdAt: string;    // ISO datetime (NOTE: "createdAt", NOT "votedAt")
  };
  error: null;
  meta: {
    latencyMs: number;
    isFinal: true;        // Votes are permanent — no PATCH/DELETE
  };
}

// Error responses — all use this envelope:
// { data: null, error: { code: "SCREAMING_SNAKE", message: "..." }, meta: {} }
// Error codes: DUPLICATE_VOTE (409), RATE_LIMITED (429), VOTING_DISABLED (503),
//   DEBATE_NOT_FOUND (404), DEBATE_NOT_ACTIVE (422), INVALID_FINGERPRINT (422)
// Rate-limited meta: { retryAfterMs: number }
// Voting-disabled meta: { estimatedWaitMs: number }
```

**GET `/api/debate/{id}/result`**
```typescript
interface DebateResultEnvelope {
  data: {
    debateId: string;
    asset: string;
    status: string;           // "running" | "completed" | "paused" | "cancelled"
    currentTurn: number;
    maxTurns: number;
    guardianVerdict: string | null;
    guardianInterruptsCount: number;
    createdAt: string;
    completedAt: string | null;
    totalVotes: number;
    voteBreakdown: Record<string, number>;  // e.g. { "bull": 42, "bear": 18 }
  };
  error: null;
  meta: {};
}
```

### Voter Fingerprint Strategy

- Generate using `crypto.randomUUID()` on first visit (available in all evergreen browsers)
- Store in `sessionStorage` under key `"voter_fingerprint"` — persists across page reloads within session, cleared on tab close
- This is an **anonymous-first** design. No auth token required to vote.
- Per-debate vote tracking: store user's choice in `sessionStorage` under key `"vote:{debateId}"` as JSON `{ choice, timestamp }`
- On mount, check `sessionStorage` for existing vote to restore "already voted" state

**⚠️ sessionStorage Caveats (from adversarial review):**
- **Per-tab isolation:** `sessionStorage` does NOT share across tabs. User voting in Tab A won't be detected in Tab B. The `storage` event only fires for `localStorage`, not `sessionStorage`. Server-side authority via `GET /api/debate/{id}/result` is the primary truth; `sessionStorage` is a fast local hint only.
- **Session death:** Tab closes → fingerprint gone. User reopening debate gets a new fingerprint. Server-side dedup (409 DUPLICATE_VOTE) is the real guard. `sessionStorage` provides UX responsiveness, not integrity.
- **Incognito bypass:** Each private window has isolated `sessionStorage`. Trivially bypassed for vote manipulation. This is acceptable — the system is anonymous-first and rate-limited server-side.
- **Design principle:** Always reconcile `sessionStorage` state with server response. If they disagree, trust the server.

### Optimistic UI Pattern

```
User clicks "Bull Won"
  → GUARD: if voteStatus === "voting", IGNORE (race condition guard)
  → onMutate: set userVote="bull", voteStatus="voting" (immediate)
  → Both buttons disabled during flight
  → API call fires
  → onSuccess: set voteStatus="voted", show SentimentReveal, invalidate debate result query
  → onSettled: invalidate query cache for fresh data
  → onError:
      → DUPLICATE_VOTE (409) Path A: optimistic was set → confirm, show "Your vote is already counted"
      → DUPLICATE_VOTE (409) Path B: optimistic NOT set → restore from response, set voteStatus="voted"
      → RATE_LIMITED (429): revert to idle, toast "Slow down! Try again in a moment"
      → VOTING_DISABLED (503): revert to idle, toast "Voting is temporarily busy. Try again soon"
      → DEBATE_NOT_ACTIVE (422): revert to idle, disable buttons, toast "This debate has ended"
      → Network error: revert to idle, toast "Connection lost. Your vote wasn't recorded"
```

### Component Placement in DebateStream

```
<DebateStream>
  <div className="flex flex-col h-full">
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      {messages.map(...)}
      {isStreaming && <TypingIndicator />}
      {reasoningNodes && <ReasoningGraph />}
    </div>

    {/* NEW: Voting area at bottom (thumb zone) */}
    {/* Controls are DISABLED (not hidden) during Guardian freeze — preserves spatial consistency */}
    {!hasVoted ? (
      <VoteControls
        debateId={debateId}
        disabled={isFrozen || !isConnected || debateStatus !== "running"}
        isFrozen={isFrozen}
      />
    ) : (
      <SentimentReveal debateId={debateId} voteBreakdown={voteBreakdown} totalVotes={totalVotes} />
    )}
  </div>
</DebateStream>
```

### Styling Patterns (follow existing conventions)

**VoteControls container:**
```tsx
<div className="sticky bottom-0 bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-4">
  <div className="flex gap-3">
    <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" ...>
      <TrendingUp className="mr-2 h-4 w-4" /> Bull Won
    </Button>
    <Button className="flex-1 bg-rose-500 hover:bg-rose-600 text-white" ...>
      <TrendingDown className="mr-2 h-4 w-4" /> Bear Won
    </Button>
  </div>
</div>
```

**Selected/disabled states:**
```tsx
// Selected Bull (user voted Bull)
className="flex-1 bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900"

// Disabled (user chose Bear, so Bull button disabled)
className="flex-1 bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
```

**SentimentReveal bar:**
```tsx
<div className="h-2 rounded-full overflow-hidden bg-slate-700 flex" aria-label={`Bull: ${bullPct}%, Bear: ${bearPct}%`}>
  <div className="bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${bullPct}%` }} />
  <div className="bg-rose-500 transition-all duration-500 ease-out" style={{ width: `${bearPct}%` }} />
</div>
```

### Accessibility (WCAG AA — mandatory)

- **Dual-coding:** Bull = green + `TrendingUp` icon + "Bull Won" text. Bear = red + `TrendingDown` icon + "Bear Won" text. NEVER color alone.
- **`aria-label`** on buttons: `"Vote Bull Won — cannot be changed"`, `"Vote Bear Won — cannot be changed"` — communicates permanence
- **`aria-live="polite"`** region for vote status announcements: "Your vote has been recorded", "Your vote is already counted", "Voting paused during risk review"
- **Disabled state communication:** `aria-disabled="true"` on disabled buttons with visible reason text (not just grayed out)
- **Focus management:** After vote → SentimentReveal transition, focus moves to SentimentReveal container. During Guardian freeze, focus is NOT trapped in vote area — user can tab away naturally.
- **`prefers-reduced-motion`:** Use `useReducedMotion()` from Framer Motion (already imported in DebateStream). Disable bar animations and press animations, use instant transitions. Applies to BOTH VoteControls and SentimentReveal.
- **Keyboard:** Buttons are native `<button>` elements (Shadcn Button base). Focus ring visible. Tab order logical. Enter/Space trigger vote.
- **Contrast:** All text passes WCAG AA on `slate-900` background (both `emerald-500` and `rose-500` on dark bg pass).
- **Extreme ratios:** At 99%/1% splits, the thin bar slice must have an always-visible text label — do not rely on color alone for the minority portion.

### Debate State Interactions

| Debate State | Vote Controls | Sentiment Reveal |
|-------------|---------------|------------------|
| `running` | Enabled (if connected & not frozen) | Shown if user voted |
| `completed` | Disabled — buttons grayed, tooltip "Debate ended" | Shown with final results |
| `paused` | Disabled — Guardian freeze handles interaction | Hidden (debate not finished) |
| Guardian Freeze (`isFrozen`) | **Disabled** (NOT hidden) — "Voting paused during risk review" micro-label visible. Controls remain spatially present to maintain user trust in bottom bar. | Hidden |

### Error Toast Messages

| Error Code | HTTP | Toast Message |
|-----------|------|---------------|
| `DUPLICATE_VOTE` | 409 | "Your vote is already counted!" (honest — not a generic success. Then set to voted state.) |
| `RATE_LIMITED` | 429 | "Slow down! Please wait a moment before voting again." |
| `VOTING_DISABLED` | 503 | "Voting is temporarily unavailable. Please try again shortly." |
| `DEBATE_NOT_ACTIVE` | 422 | "This debate is no longer accepting votes." |
| `DEBATE_NOT_FOUND` | 404 | "This debate could not be found." |
| Network error | — | "Connection lost. Your vote wasn't recorded. Please try again." |

**Toast positioning:** Install `sonner` as the toast library (no toast lib currently exists in the project). Add `<Toaster position="top-center" />` to the app layout so vote-related toasts render ABOVE the sticky bottom bar on mobile and don't overlap vote controls.

### Testing Conventions

- **Test framework:** Jest 29 + React Testing Library (NOT Vitest)
- **Test command:** `npm run test -- tests/unit/VoteControls.test.tsx`
- **Test ID format:** `[3-2-UNIT-{SEQ}] Test description @p{n}`
- **Mock pattern:** Use `@tanstack/react-query` `QueryClientProvider` wrapper for hooks testing
- **File locations:** `tests/unit/` for component/hook unit tests
- **No `any` types** in tests — use specific interfaces
- **Existing E2E tests** at `tests/e2e/voting.spec.ts` already reference `data-testid="vote-bull-btn"`, `vote-bear-btn`, `voting-panel`, `sentiment-reveal` — match these exactly

### Anti-Pattern Prevention

- **DO NOT** regenerate the OpenAPI client — it doesn't include vote endpoints yet. Create `api.ts` with manual fetch.
- **DO NOT** use `fetch` directly in components — all API calls go through `api.ts` module functions.
- **DO NOT** use `any` type — define specific interfaces for all API shapes.
- **DO NOT** use `Context` for vote state — use React Query (server) + `useState`/`useMutation` (client) per AGENTS.md.
- **DO NOT** create a Zustand store for this — the vote state is simple enough for React Query + `sessionStorage`.
- **DO NOT** modify `DebateStream.tsx` message handling or Guardian freeze logic — only add voting section at bottom.
- **DO NOT** implement WebSocket-based real-time vote updates — that's Story 3.4.
- **DO NOT** implement the full SentimentReveal animation with polling — that's Story 3.4. This story creates a basic static bar with CSS transitions.
- **DO NOT** use `datetime.utcnow()` — always `new Date().toISOString()`.
- **DO NOT** use `GUARDIAN/` prefix on any WebSocket actions — all use `DEBATE/` prefix.
- **DO NOT** add vote-related WebSocket action types — those don't exist yet (will be Story 3.4).
- **DO NOT** hardcode API base URL — use `process.env.NEXT_PUBLIC_API_URL`.
- **DO NOT** use Framer Motion for SentimentReveal bar width animation — CSS transitions suffice. Reserve Framer Motion for Story 3.4's complex animations.
- **DO NOT** hide vote controls during Guardian freeze — DISABLE them with visible explanation. Hiding destroys spatial consistency.
- **DO NOT** allow concurrent optimistic mutations — guard `vote()` call against `voteStatus === "voting"`.
- **DO NOT** treat 409 DUPLICATE_VOTE as generic success — use honest "Your vote is already counted" messaging.
- **DO NOT** scatter React Query cache keys as string literals — use the centralized `queryKeys.ts` factory.
- **DO NOT** forget `retry: false` in test QueryClient config — default retry:3 causes slow/flaky mutation tests.
- **DO NOT** duplicate `debateStatus` state — add it ONCE in DebateStream (wired to `onStatusUpdate`) and pass down. Do NOT create a separate hook or Zustand store for it.
- **DO NOT** add vote-related message handlers in `useDebateSocket.ts` — no vote WebSocket actions exist yet. That's Story 3.4.
- **DO NOT** add `src/` prefix to file paths — the frontend root is `trade-app/nextjs-frontend/`. The `@/` alias resolves to this root, NOT to `src/`.

### Previous Story Intelligence (Story 3.1)

Key learnings from Story 3.1 implementation:

1. **Vote response uses `createdAt` (NOT `votedAt`)** — see `vote_schemas.py:38`
2. **Votes are permanent** — `meta.isFinal: true` in response. No PATCH/DELETE.
3. **Guard ordering on backend:** schema validation → debate exists/running → duplicate → rate limit → capacity → write. Frontend should handle all error codes from any guard.
4. **`DUPLICATE_VOTE` (409) is a "soft success"** — user already voted, treat as voted state on frontend.
5. **Rate limit is 10 votes/minute per voter** — very generous, unlikely to hit in normal use.
6. **Capacity limit is 10,000 concurrent voters** — `VOTING_DISABLED` (503) if exceeded.
7. **Debate model `status="running"` (NOT `"active"`)** — verified at `app/models.py:37`
8. **Error envelope is at top level** `{ data, error, meta }` — NOT nested inside `{"detail": {...}}`. Custom exception handler in `app/main.py` ensures this.
9. **`voter_fingerprint` is opaque** — server validates length only (1-128 chars). Client can use any anonymous identifier.
10. **Backend test helper `_make_debate()`** default status changed to `"running"` — E2E tests should seed debates with `status: "running"` for voting.
11. **E2E `voting.spec.ts` bug:** Seeds debates with `status: 'active'` (lines 15, 29) but backend guard checks for `"running"` (`debate.py:166`). This is a pre-existing bug — E2E tests will fail against the real backend until the seed data is corrected to `status: "running"`. Do NOT fix in this story (E2E tests are out of scope), but be aware when running integration tests.
12. **`useVotingStatus.userChoice` source:** The `GET /api/debate/{id}/result` endpoint returns aggregate `voteBreakdown` and `totalVotes` — it does NOT return the current user's individual choice. Therefore, `userChoice` must come from `sessionStorage` ONLY (key `"vote:{debateId}"`). The server response cannot tell you which side the user voted for — it only provides aggregate counts. Design `useVotingStatus` accordingly: `hasVoted` is derived from sessionStorage OR the presence of any vote counts, `userChoice` is ALWAYS from sessionStorage.

### Adversarial Review Record (2026-04-12)

**Participants:** Winston (Architect), Sally (UX Designer), Murat (Test Architect), Amelia (Developer)

**Findings incorporated into this spec:**

| # | Finding | Source | Resolution |
|---|---------|--------|------------|
| 1 | `sessionStorage` per-tab isolation, no cross-tab sync | Winston | Added caveats; server-side authority is primary truth |
| 2 | Race condition on rapid clicks / concurrent optimistic updates | Winston, Murat | Added `voteStatus === "voting"` guard, disable buttons during flight |
| 3 | Already-voted / returning visitor state missing from AC | Winston, Sally, Amelia | Added AC4; `useVotingStatus` uses server-first + sessionStorage fallback |
| 4 | Guardian freeze should disable, not hide, vote controls | Sally, Amelia | Added AC5; changed Task 3 & Task 6 from hide → disable with micro-label |
| 5 | 409 DUPLICATE_VOTE is deceptive UX if shown as generic success | Sally | Changed to honest "Your vote is already counted" messaging; dual-path 409 handling |
| 6 | SentimentReveal zero-votes state (division by zero) | Murat | Added to Task 4; "No votes yet" placeholder |
| 7 | Framer Motion overkill for bar width animation | Winston | Changed to CSS transitions in Task 4; Framer Motion deferred to Story 3.4 |
| 8 | React Query cache key coupling risk | Winston | Added Task 7.5 centralized `queryKeys.ts` factory |
| 9 | Missing test scenarios: race condition, unmount-during-flight, keyboard, 409 dual path, concurrent debates, cache invalidation | Murat | Added 14 new test cases across Tasks 8-10 |
| 10 | React Query `retry: false` needed in test wrapper | Murat | Added to Task 9; mandatory config |
| 11 | Mobile toast overlaps sticky bottom bar | Sally | Added toast positioning note in Task 6 and Error Toast Messages |
| 12 | Focus management during state transitions | Sally | Added to Task 6 and Accessibility section |
| 13 | Vote permanence not communicated to users | Sally | Updated `aria-label` to include "cannot be changed" |
| 14 | SentimentReveal extreme ratio (99/1) unreadable | Sally | Added boundary label requirement to Task 4 |

### References

- [Source: `app/routes/debate.py:114-153`] — POST /vote route with 6-guard chain
- [Source: `app/services/debate/vote_schemas.py`] — `VoteRequest`, `VoteResponse`, `DebateResultResponse`, `StandardVoteResponse`
- [Source: `app/models.py:53-75`] — Vote SQLAlchemy model
- [Source: `app/models.py:31-50`] — Debate model (`status` field)
- [Source: `features/debate/components/DebateStream.tsx`] — Host component (376 lines)
- [Source: `features/debate/hooks/useDebateSocket.ts`] — WebSocket hook with `onStatusUpdate` callback
- [Source: `features/debate/hooks/useGuardianFreeze.ts`] — Freeze state hook (`isFrozen`)
- [Source: `features/debate/components/ArgumentBubble.tsx`] — Bull/Bear color pattern (emerald/rose)
- [Source: `components/ui/button.tsx`] — Shadcn Button base component
- [Source: `lib/utils.ts`] — `cn()` utility
- [Source: `tests/e2e/voting.spec.ts`] — Existing E2E test with data-testid patterns
- [Source: `_bmad-output/implementation-artifacts/3-1-voting-api-data-model.md`] — Previous story (API contract, error codes, guard chain)
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`] — Thumb zone (bottom 15vh), dual-coding, Framer Motion, color system
- [Source: `_bmad-output/planning-artifacts/architecture.md`] — Feature-based organization, React Query, camelCase bridge
- [Source: `AGENTS.md`] — Code conventions, testing commands, anti-patterns, lessons learned

## Review Findings

### decision-needed

- [x] [Review][Decision] Hydration mismatch from sessionStorage reads in useState initializer — Both `useVote.ts:52-54` and `useVotingStatus.ts:26` read `sessionStorage` synchronously during initialization. SSR produces `null` but client has stored value → React hydration mismatch warning + UI flash. Options: (a) use `useEffect` to read sessionStorage after mount, (b) use `useSyncExternalStore` with `getServerSnapshot` returning `null`, (c) suppress hydration warning on the voting container. Option (b) is the React-idiomatic approach. **Resolved: Option (a) — useEffect with null initial state. Clean, well-understood, standard React pattern.**
- [x] [Review][Decision] 409 DUPLICATE_VOTE uses `toast.error()` styling for informational message — Spec says "honest messaging" but doesn't specify toast variant. `toast.error()` renders red/danger styling which implies failure, but the vote IS already counted (success). Options: (a) keep `toast.error()` since it's an error response, (b) use `toast.info()` for informational styling, (c) use `toast.success()` since the vote is confirmed. **Resolved: Option (b) — toast.info(). Honest, informational, not misleading.**

### patch

- [x] [Review][Patch] Missing QueryClientProvider in app tree — runtime crash [`DebateStream.tsx:226`]
- [x] [Review][Patch] SentimentReveal miscalculates when "undecided" or other keys exist in voteBreakdown [`SentimentReveal.tsx:30-31`]
- [x] [Review][Patch] getStoredVote duplicated with incompatible return types [`useVote.ts:29-36`, `useVotingStatus.ts:10-20`]
- [x] [Review][Patch] DUPLICATE_VOTE handler overwrites correct stored vote with attempted choice [`useVote.ts:82-86`]
- [x] [Review][Patch] debateStatus defaults to "running" without server confirmation — allows voting on completed debates [`DebateStream.tsx:73`]
- [x] [Review][Patch] showSentiment flashes "No votes yet" before refetch completes [`DebateStream.tsx:228-229`]
- [x] [Review][Patch] vote() callback allows re-voting after "voted" status [`useVote.ts:108-111`]
- [x] [Review][Patch] useVotingStatus ignores server authority for hasVoted/userChoice [`useVotingStatus.ts:36`]
- [x] [Review][Patch] No loading/confirmed visual on selected vote button [`VoteControls.tsx:49-54`]
- [x] [Review][Patch] Static aria-label "cannot be changed" shown before user has voted [`VoteControls.tsx:43,63`]
- [x] [Review][Patch] Missing focus management after vote → SentimentReveal transition [`DebateStream.tsx`, `SentimentReveal.tsx`]
- [x] [Review][Patch] debateStatus state is untyped string [`DebateStream.tsx:73`]
- [x] [Review][Patch] submitVote crashes on non-JSON error responses [`api.ts:74`]

### defer

- [x] [Review][Defer] Voter fingerprint trivially spoofable — no server-side identity verification [`api.ts:104-114`] — deferred, pre-existing. Spec acknowledges as acceptable: "anonymous-first design" with server-side rate limiting.
- [x] [Review][Defer] No CSRF protection on vote POST [`api.ts:68-72`] — deferred, pre-existing. Anonymous-first design makes CSRF tokens impractical; server-side rate limiting is the guard.
- [x] [Review][Defer] fetchDebateResult doesn't validate response shape [`api.ts:92-102`] — deferred, pre-existing. Pattern is consistent with rest of codebase (no runtime validation on API responses).
- [x] [Review][Defer] crypto.randomUUID fails in non-secure context (HTTP without localhost) [`api.ts:111`] — deferred, pre-existing. Next.js apps typically run on localhost or HTTPS.
- [x] [Review][Defer] Vote in-flight during Guardian freeze — error toast may be obscured by overlay [`VoteControls.tsx:26`, `useVote.ts:98-100`] — deferred, low priority. Guardian overlay is blocking; toast visible after dismissal.
- [x] [Review][Defer] useVotingStatus never refetches on live debate [`useVotingStatus.ts:28-32`] — deferred, explicitly Story 3.4 scope. Spec: "Full real-time polling/WebSocket updates are Story 3.4."
- [x] [Review][Defer] useMutation object in useCallback dependency — memoization ineffective [`useVote.ts:111`] — deferred, cosmetic. Race guard via ref is the real protection; callback recreation is harmless.

## Dev Agent Record

### Agent Model Used

glm-5.1 via opencode

### Debug Log References

N/A

### Completion Notes List

- BMAD code review completed: 32 raw findings → 22 unique → 2 decision-needed, 13 patch, 7 defer, 2 dismissed
- All 13 patches + 2 decisions applied
- Critical fixes: QueryClientProvider added, hydration mismatch resolved, DUPLICATE_VOTE preserves existing choice, bear % calculation corrected, non-JSON error handling, typed debateStatus, dynamic aria-labels, focus management
- 49/49 unit tests passing
- Zero new lint/typecheck errors
- 7 deferred items documented in deferred-work.md (all pre-existing or Story 3.4 scope)

### File List

- `app/providers.tsx` — NEW QueryClientProvider wrapper
- `app/layout.tsx` — Updated with Providers wrapper
- `features/debate/hooks/storedVote.ts` — NEW shared vote storage utility
- `features/debate/api.ts` — NEW with parseJsonSafely()
- `features/debate/hooks/useVote.ts` — NEW with useEffect hydration, voted guard, optimistic cache, toast.info
- `features/debate/hooks/useVotingStatus.ts` — NEW with useEffect hydration, serverStatus export
- `features/debate/hooks/queryKeys.ts` — NEW centralized query key factory
- `features/debate/components/VoteControls.tsx` — NEW with dynamic labels, Voting… + pulse
- `features/debate/components/SentimentReveal.tsx` — NEW with bearVotes fix, focus management
- `features/debate/components/DebateStream.tsx` — Updated typed debateStatus, serverStatus wiring, vote controls integration
- `features/debate/hooks/index.ts` — Updated re-exports
- `features/debate/components/index.ts` — Updated re-exports
- `tests/unit/useVote.test.ts` — NEW 18 tests
- `tests/unit/useVotingStatus.test.ts` — NEW 7 tests
- `tests/unit/VoteControls.test.tsx` — NEW 12 tests
- `tests/unit/SentimentReveal.test.tsx` — NEW 10 tests
- `tests/unit/queryKeys.test.ts` — NEW 3 tests
