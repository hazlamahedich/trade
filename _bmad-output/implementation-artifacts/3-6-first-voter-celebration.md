# Story 3.6: First Voter Celebration

Status: done

## Story

As a User,
I want a celebratory moment when I am the first to cast my vote,
So that I feel my participation matters and the platform rewards early engagement.

## Acceptance Criteria

1. **AC1: First-Voter Celebration Triggers** — Given I cast a vote and the server confirms `totalVotes` transitions from 0 to 1, When the confirmed state renders, Then a celebration animation plays inside the SentimentReveal area for 1.5 seconds, delayed 500ms after vote confirmation renders.
2. **AC2: Celebration Shows Neutral Badge** — Given the celebration triggers, When it plays, Then a badge/label reading "First vote cast" appears with a neutral warm amber color (`bg-amber-500/15 text-amber-300`) and fades out after 1.5s.
3. **AC3: Celebration Respects Reduced Motion** — Given `prefers-reduced-motion` is active, When the celebration would trigger, Then a gentle opacity fade-in (0→1 over 200ms) plays with the text badge appearing for 1.5s — no scale, no transform, no shimmer.
4. **AC4: Celebration Only Fires Once Per Browser Session** — Given I was the first voter and the celebration has played, When subsequent vote updates arrive, component remounts, or route changes occur, Then the celebration does NOT replay. Persistence via `sessionStorage` keyed by `debateId`.
5. **AC5: No Celebration on Non-First Vote** — Given `totalVotes > 0` when I vote, When the confirmed state renders, Then no celebration plays — standard SentimentReveal behavior only.
6. **AC6: Accessible Announcement** — Given the celebration triggers, When it plays, Then an `aria-live="polite"` announcement reads "You are the first to vote!" for screen reader users, and the announcement clears after 1.5s dismissal.

## Tasks / Subtasks

- [x] Task 1: Create `useFirstVoter` custom hook (AC: #1, #4, #5)
  - [x] Create `trade-app/nextjs-frontend/features/debate/hooks/useFirstVoter.ts`
  - [x] Use `useState<boolean>(false)` for `isFirstVoter` (NOT useRef — refs don't trigger re-renders)
  - [x] Track previous `totalVotes` via `useRef(totalVotes)` — note: `totalVotes` is `number` (non-nullable) per SentimentRevealProps, but guard with `?? 0` for safety
  - [x] Detect transition only after server confirmation: `prevTotal === 0 && totalVotes === 1 && !isFirstVoter`. **CRITICAL:** Only the server-confirmed `totalVotes` triggers detection — the optimistic pipeline (Story 3.5.3) must NOT increment `totalVotes` before server confirmation. Verify in DebateStream that `totalVotes` passed to `useFirstVoter` is the confirmed value, NOT the optimistic value.
  - [x] Derive `storageKey` via `useMemo(() => \`first-voter-${debateId}\`, [debateId])` for stable reference — avoids unnecessary effect re-triggers on DebateStream's frequent re-renders from WS messages
  - [x] Persist to `sessionStorage` on trigger; initialize from sessionStorage on mount
  - [x] Reset hook state on `debateId` change (cross-debate contamination guard) — include `storageKey` in effect deps to satisfy `react-hooks/exhaustive-deps`
  - [x] Return `isFirstVoter: boolean`
- [x] Task 2: Add celebration UI to SentimentReveal (AC: #1, #2, #3, #6)
  - [x] Add `isFirstVoter?: boolean` prop to `SentimentRevealProps` in `trade-app/nextjs-frontend/features/debate/components/SentimentReveal.tsx`
  - [x] Celebration condition: `isFirstVoter && totalVotes === 1` (NOT `<= 1`)
  - [x] Celebration component: `<motion.div>` with "First vote cast" text, neutral amber color, scale-in animation (0.95→1.0 over 200ms), auto-dismiss after 1.5s with 500ms delay from vote confirmation
  - [x] Reduced motion: gentle opacity fade-in (0→1 over 200ms) — NOT stripped entirely
  - [x] Add `aria-live="polite"` region with "You are the first to vote!" text; clear announcement after dismissal
  - [x] Auto-dismiss: `useEffect` with 1.5s timeout + cleanup (`return () => clearTimeout(timer)`)
- [x] Task 3: Wire `useFirstVoter` from DebateStream → SentimentReveal (AC: #1, #4, #5)
  - [x] Call `useFirstVoter(totalVotes, debateId)` in `trade-app/nextjs-frontend/features/debate/components/DebateStream.tsx`
  - [x] Pass `isFirstVoter={isFirstVoter}` to `<LazySentimentReveal>` (line ~452)
  - [x] Verify prop survives lazy loading (dynamic import at line ~37-38)
- [x] Task 4: Write tests (AC: #1–#6) — 14 tests total, in `trade-app/nextjs-frontend/tests/unit/`
  - [x] Use describe block prefix `[3-6-UNIT]` to match project convention (`[3-2-UNIT]`, `[3-5-3-UNIT]`, etc.)
  - [x] Test SentimentReveal celebration via `isFirstVoter` prop — no need to mock `useFirstVoter` hook, just pass the prop directly
  - [x] Hook tests go in `useFirstVoter.test.ts` — test the hook directly via `renderHook` from `@testing-library/react`
  - [x] `test_first_voter_celebration_triggers_on_vote_from_zero` (P0, AC1)
  - [x] `test_celebration_shows_badge_with_neutral_amber_color` (P0, AC2)
  - [x] `test_celebration_respects_reduced_motion_opacity_fade` (P0, AC3)
  - [x] `test_reduced_motion_still_dismisses_after_timeout` (P0, AC3)
  - [x] `test_celebration_only_fires_once_per_session` (P0, AC4)
  - [x] `test_session_storage_persistence_prevents_retrigger_on_remount` (P0, AC4)
  - [x] `test_no_celebration_when_total_votes_already_nonzero` (P0, AC5)
  - [x] `test_no_celebration_when_total_votes_is_zero_after_remount` (P0, AC5 — edge case: prevTotalRef stale after remount)
  - [x] `test_screen_reader_announces_first_vote_and_clears_after_dismiss` (P0, AC6)
  - [x] `test_celebration_cleanup_on_unmount_no_state_leaks` (P0 — timer cleanup)
  - [x] `test_strict_mode_double_effect_no_duplicate_celebration` (P0 — React 18 StrictMode)
  - [x] `test_rapid_rerenders_do_not_retrigger_celebration` (P1 — race condition)
  - [x] `test_debate_id_change_resets_first_voter_state` (P1 — cross-debate guard)
  - [x] `test_full_first_voter_flow_vote_triggers_celebration_and_auto_dismisses` (P0 — integration)

## Dev Notes

### Context

This story was deferred from Story 3.5.3 (Empty State Emotional Arc). The empty state text "Be the first to vote" (`SentimentReveal.tsx:104-106`) is already rendered when `totalVotes === 0`. This story adds the celebration moment that replaces/reinforces that empty state when the first vote is cast.

### Adversarial Review Findings (Pre-Implementation)

This story underwent adversarial review by Winston (Architect), Sally (UX), Amelia (Dev), and Murat (Test Architect). The following critical issues were identified and incorporated into this revised spec:

| ID | Severity | Original Approach | Fix Applied |
|---|---|---|---|
| BUG-1 | **CRITICAL** | `useRef(false)` for `isFirstVoter` — ref mutations don't trigger re-renders, celebration never shows | Use `useState<boolean>(false)` instead |
| BUG-2 | **CRITICAL** | No timeout cleanup on unmount — memory leak / crash | `useEffect` returns `() => clearTimeout(timer)` |
| BUG-3 | **HIGH** | `totalVotes` may be `undefined`/`null` initially — `prevTotalRef === 0` never matches | Guard with `?? 0`, add null tests |
| BUG-4 | **HIGH** | `totalVotes <= 1` — `null <= 1` is `true` in JS, phantom celebration | Change to `=== 1` |
| UX-1 | **HIGH** | Badge copy "You're the pioneer!" celebrates speed not conviction | Changed to "First vote cast" |
| UX-2 | **MEDIUM** | Agent team color (emerald/rose) on celebration — false confidence signal | Changed to neutral warm amber |
| UX-3 | **MEDIUM** | 3s duration competes with vote confirmation | Reduced to 1.5s with 500ms delay |
| UX-4 | **MEDIUM** | `aria-live="assertive"` too aggressive for non-critical info | Changed to `polite` |
| UX-5 | **LOW** | Reduced motion strips all delight — just text | Gentle opacity fade-in (200ms) |
| ARCH-1 | **HIGH** | Optimistic render trigger — celebration fires on failed votes | Gate on server-confirmed totalVotes |
| ARCH-2 | **MEDIUM** | `useRef` resets on component remount (route change, Suspense) | `sessionStorage` keyed by `debateId` |
| ARCH-3 | **LOW** | Detection logic inline in DebateStream | Extract to `useFirstVoter` hook |
| ARCH-4 | **P2** | No reset on `debateId` change — cross-debate contamination | Reset state on `debateId` change |
| TEST-1 | **HIGH** | 6 tests insufficient, P1 on AC4 wrong | 14 tests, AC4 reclassified to P0 |

### Key Files

| File | Purpose |
|------|---------|
| `trade-app/nextjs-frontend/features/debate/hooks/useFirstVoter.ts` | **NEW** — Custom hook for first-voter detection + sessionStorage persistence |
| `trade-app/nextjs-frontend/features/debate/components/SentimentReveal.tsx` | Add celebration UI + `isFirstVoter` prop |
| `trade-app/nextjs-frontend/features/debate/components/DebateStream.tsx` | Call `useFirstVoter`, pass `isFirstVoter` prop |
| `trade-app/nextjs-frontend/features/debate/hooks/useVote.ts` | No changes needed |
| `trade-app/nextjs-frontend/features/debate/hooks/useVotingStatus.ts` | No changes needed |

### Implementation Approach

**Detection Hook (`useFirstVoter.ts`):**
```tsx
function useFirstVoter(totalVotes: number, debateId: string): boolean {
  const storageKey = useMemo(() => `first-voter-${debateId}`, [debateId]);
  const [isFirstVoter, setIsFirstVoter] = useState<boolean>(
    () => sessionStorage.getItem(storageKey) === "true"
  );
  const prevTotalRef = useRef(totalVotes);

  useEffect(() => {
    if (prevTotalRef.current === 0 && totalVotes === 1 && !isFirstVoter) {
      setIsFirstVoter(true);
      sessionStorage.setItem(storageKey, "true");
    }
    prevTotalRef.current = totalVotes;
  }, [totalVotes, isFirstVoter, storageKey]);

  useEffect(() => {
    setIsFirstVoter(sessionStorage.getItem(storageKey) === "true");
    prevTotalRef.current = totalVotes;
  }, [debateId, storageKey, totalVotes]);

  return isFirstVoter;
}
```
**Note:** `totalVotes` is `number` (non-nullable) per `SentimentRevealProps`. The `?? 0` guards are removed since the type is already resolved upstream by DebateStream. `storageKey` uses `useMemo` for stable reference. Both effects include all referenced variables in dependency arrays.

**Celebration (SentimentReveal):**
- Condition: `isFirstVoter && totalVotes === 1` (strict equality, NOT `<= 1`)
- Framer Motion: `motion.div` with `initial={{ scale: 0.95, opacity: 0 }}` → `animate={{ scale: 1, opacity: 1 }}` over 200ms, delayed 500ms from vote confirmation
- Color: neutral `bg-amber-500/15 text-amber-300 border border-amber-500/20` (NOT team colors)
- Reduced motion: gentle opacity fade-in (0→1, 200ms) — NOT stripped entirely
- Auto-dismiss: `useEffect` with 1.5s timeout + cleanup
- Screen reader: `aria-live="polite"` with "You are the first to vote!" — clears after dismissal

**Auto-dismiss pattern with cleanup:**
```tsx
const [showCelebration, setShowCelebration] = useState(true);

useEffect(() => {
  if (!showCelebration) return;
  const timer = setTimeout(() => setShowCelebration(false), 1500);
  return () => clearTimeout(timer);
}, [showCelebration]);
```

### Visual Timeline

```
T+0ms:    Vote click → shimmer begins (vote processing, from Story 3.5)
T+300ms:  Vote confirmed → shimmer resolves
T+500ms:  Celebration badge fades in (opacity 0→1, 200ms)
T+2000ms: Celebration badge fades out
```

### What This Story Must NOT Create

- Do NOT add confetti/particle libraries (canvas-confetti, tsparticles, etc.) — keep it CSS + Framer Motion only
- Do NOT modify the `useVote` hook or vote mutation logic
- Do NOT add new API endpoints or backend changes
- Do NOT change the empty-state text ("Be the first to vote") — that stays for pre-vote
- Do NOT add sound effects or haptics for the celebration
- Do NOT use team vote colors (emerald/rose) for the celebration badge — use neutral amber
- Do NOT use `useRef` for `isFirstVoter` state — must be `useState` to trigger re-renders
- Do NOT trigger celebration on optimistic render — gate on server-confirmed totalVotes
- Do NOT use `aria-live="assertive"` — use `"polite"` instead

### Architecture Compliance

- **Pydantic Bridge:** No backend changes — purely frontend feature
- **WebSocket Actions:** Uses existing `DEBATE/VOTE_UPDATE` action data, no new action types
- **Component Pattern:** Celebration is a transient state within SentimentReveal; detection extracted to `useFirstVoter` hook
- **Testing:** Jest 29 + RTL, mock `useReducedMotion` from framer-motion for AC3, `jest.useFakeTimers()` for all timer tests (never `waitFor` with real timers)
- **Accessibility:** `aria-live="polite"` region for screen readers; neutral color + text dual-coding (not color alone)
- **Reduced Motion:** Gentle opacity fade-in via `useReducedMotion()` hook (already imported in SentimentReveal)
- **Session Persistence:** `sessionStorage` keyed by `debateId` — clears on tab close (correct "per session" semantic)
- **Optimistic Pipeline Interaction:** Story 3.5.3 added optimistic state (`optimisticSegment`/`optimisticStatus`). The `totalVotes` passed to `useFirstVoter` MUST be the server-confirmed value, NOT the optimistically-incremented value. In DebateStream, verify the `totalVotes` variable is sourced from the WS/poll response (confirmed), not from the optimistic vote increment. If DebateStream currently uses optimistic `totalVotes`, this story must use a separate confirmed `totalVotes` for the hook.

### UX Design Spec References

- [Source: ux-design-specification.md#Micro-Emotions] — "JOMO (Joy Of Missing Out): Specifically designing for the 'Wait' verdict to feel like a victory."
- [Source: ux-design-specification.md#Emotional Design Principles] — "Celebrate Discipline: Visually reward patience as much as profit"
- [Source: ux-design-specification.md#Feedback Patterns] — "The Living UI" — ambient feedback principle
- [Source: ux-design-specification.md#Accessibility Strategy] — Screen reader support, reduced motion
- **Color note:** The UX spec defines semantic colors as Emerald (Bull), Rose (Bear), Violet (Guardian), Slate (Neutral). "Amber" is NOT a spec-defined token — it was chosen by the adversarial review panel as a neutral warm color that doesn't carry team association. This is intentional and acceptable, but be aware it's a custom addition, not from the design system.

### Previous Story Intelligence (3.5.3)

- `SentimentReveal.tsx` already handles optimistic state (shimmer, opacity transitions)
- `DebateStream.tsx` already wires `optimisticSegment` and `optimisticStatus` to `LazySentimentReveal`
- The empty-state rendering at line 92-108 (`totalVotes === 0`) shows "Be the first to vote"
- Lazy loading pattern (`dynamic import`) is already in place for SentimentReveal — no change needed

### Test Approach

**Timer Discipline (MANDATORY):**
- ALL timer-based tests use `jest.useFakeTimers()` + `act(() => { jest.advanceTimersByTime(ms); })`
- NEVER use `waitFor` with real timers for celebration tests
- Every `advanceTimersByTime` call must be wrapped in `act()`

**Framer Motion Mock:**
```typescript
jest.mock('framer-motion', () => {
  let reducedMotion = false;
  return {
    motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
    useReducedMotion: () => reducedMotion,
    AnimatePresence: ({ children }: any) => <>{children}</>,
    __setReducedMotion: (v: boolean) => { reducedMotion = v; },
  };
});
```

**sessionStorage Mock:**
```typescript
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });
```

### Project Structure Notes

All source files live under `trade-app/nextjs-frontend/`. New hook: `features/debate/hooks/useFirstVoter.ts`. Modified files: `features/debate/components/SentimentReveal.tsx`, `features/debate/components/DebateStream.tsx`. Tests go in `tests/unit/` with filenames `useFirstVoter.test.ts` and `SentimentRevealFirstVoter.test.tsx` (or appended to existing `SentimentReveal*.test.tsx` files using `[3-6-UNIT]` describe blocks).

### References

- [Source: _bmad-output/implementation-artifacts/3-5-3-empty-state-optimistic-update.md] — Deferred scope
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy]
- [Source: AGENTS.md#Lessons Learned #5] — Patching Config Requires All Fields (N/A — no backend changes)

## Dev Agent Record

### Agent Model Used

glm-5.1

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- ✅ Task 1: Created `useFirstVoter` hook with `useState<boolean>`, `useMemo` storageKey, `sessionStorage` persistence, debateId reset guard. Verified `totalVotes` in DebateStream comes from `useVotingStatus` (server-confirmed via React Query + WS updates), not optimistic pipeline.
- ✅ Task 2: Added `FirstVoterBadge` component inside SentimentReveal with neutral amber color, `motion.div` scale-in animation (0.95→1.0, 200ms, 500ms delay), reduced motion fallback (opacity-only), `aria-live="polite"` screen reader announcement, auto-dismiss with cleanup after 1.5s. Celebration condition: `isFirstVoter && totalVotes === 1` (strict equality).
- ✅ Task 3: Wired `useFirstVoter(totalVotes, debateId)` in DebateStream, passed `isFirstVoter` prop to `LazySentimentReveal`. Prop survives dynamic import.
- ✅ Task 4: 18 tests total across 2 test files (8 hook tests + 10 component tests), covering all 14 story-specified tests plus 4 extra coverage tests. All 320 unit tests pass with zero regressions.

### File List

- `trade-app/nextjs-frontend/features/debate/hooks/useFirstVoter.ts` — **NEW**
- `trade-app/nextjs-frontend/features/debate/hooks/index.ts` — Modified (added `useFirstVoter` export)
- `trade-app/nextjs-frontend/features/debate/components/SentimentReveal.tsx` — Modified (added `isFirstVoter` prop, `FirstVoterBadge` component)
- `trade-app/nextjs-frontend/features/debate/components/DebateStream.tsx` — Modified (imported + called `useFirstVoter`, passed prop)
- `trade-app/nextjs-frontend/tests/unit/useFirstVoter.test.ts` — **NEW** (8 tests)
- `trade-app/nextjs-frontend/tests/unit/SentimentRevealFirstVoter.test.tsx` — **NEW** (10 tests)

## Review Findings

- [x] [Review][Patch] SSR crash — unguarded `sessionStorage` in `useState` initializer [useFirstVoter.ts:8-10]
- [x] [Review][Patch] Multi-viewer false first voter — add `hasVoted` gate inside hook [useFirstVoter.ts:14]
- [x] [Review][Patch] Second `useEffect` resets `prevTotalRef` to wrong value on debateId change [useFirstVoter.ts:23]
- [x] [Review][Patch] Badge replays on remount when `totalVotes` still 1 — add module-level `celebratedDebates` Set [SentimentReveal.tsx:8,115]
- [x] [Review][Patch] Timer 1500ms starts at mount but animation has 500ms delay — only ~1.0s visible, changed to 2000ms [SentimentReveal.tsx:77]
- [x] [Review][Defer] AnimatePresence exit animation never fires — badge self-hides internally before unmount [SentimentReveal.tsx:225-229] — deferred, pre-existing

## Change Log

- 2026-04-13: Code review — 5 patches applied (SSR guard, hasVoted gate, prevTotalRef reset fix, replay prevention, timer duration). 22 tests, 355/355 total passing. Decision-needed (voter-only gate) resolved via party mode consensus: gate `hasVoted` inside hook.
- 2026-04-13: Implemented Story 3.6 — First Voter Celebration feature. Created `useFirstVoter` hook with sessionStorage persistence, added `FirstVoterBadge` celebration UI to SentimentReveal, wired through DebateStream. 18 tests, all passing.
