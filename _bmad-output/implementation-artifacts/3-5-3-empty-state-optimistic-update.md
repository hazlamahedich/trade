# Story 3.5.3: Empty State Emotional Arc + Optimistic Update

Status: done

## Story

As a User,
I want immediate, trustworthy feedback when I vote,
So that I feel my participation matters and I can trust what I see.

## Acceptance Criteria

1. **AC1: Optimistic Bar Renders Immediately** — Given I cast a vote, When the vote mutation fires, Then my vote appears in the sentiment bar within 200ms — before server confirmation. The optimistic segment shows a shimmer overlay.
2. **AC2: Confirmed State Replaces Optimistic Seamlessly** — Given my optimistic vote is displayed, When the server confirms (via WS push or poll), Then the shimmer stops, opacity transitions 0.85→1.0 over 200ms, and no visual flicker occurs.
3. **AC3: Reconciliation Failure Shows Correction** — Given my optimistic vote is displayed, When the server returns different data, Then the bar transitions to the correct state over 300ms, and a non-blocking toast appears: "Vote Updated — Your vote was adjusted to match the recorded result." (auto-dismiss 4s).
4. **AC4: Timeout Shows Retry Prompt** — Given my optimistic vote is displayed, When no server response arrives within 8 seconds, Then shimmer stops, opacity drops to 0.6, and a toast appears: "Still Counting — Your vote is being processed. We'll update shortly." with [Try Again] action (auto-dismiss 6s).
5. **AC5: Shimmer Respects Reduced Motion** — Given `prefers-reduced-motion` is active, When optimistic state is shown, Then no shimmer animation plays — only the opacity change (0.85) distinguishes optimistic from confirmed.

## Tasks

- [ ] Task 1: Add optimistic state props to SentimentReveal (AC: #1-#5)
  - [ ] Add `optimisticSegment?: "bull" | "bear" | null` prop
  - [ ] Add `optimisticStatus?: "pending" | "confirmed" | "failed" | "timeout"` prop
  - [ ] Apply shimmer CSS overlay on the optimistic segment when status is "pending"
  - [ ] Apply opacity 0.85 when pending, 1.0 on confirmed, 0.6 on timeout
  - [ ] Skip shimmer when `shouldReduceMotion` is true (use opacity only)
- [ ] Task 2: Add shimmer CSS keyframes (AC: #1)
  - [ ] Add `@keyframes optimism-shimmer` animation
  - [ ] Shimmer is a `::after` pseudo-element or overlay div on the bar segment
  - [ ] Only the optimistic segment shimmers — other segments stay solid
- [ ] Task 3: Add reconciliation toast component (AC: #3, #4)
  - [ ] Create or use existing toast system for vote reconciliation messages
  - [ ] Toast for failure: "Vote Updated" with amber icon
  - [ ] Toast for timeout: "Still Counting" with retry action
- [ ] Task 4: Wire optimistic state in DebateStream (AC: #1-#4)
  - [ ] Track optimistic state: segment + status
  - [ ] On vote action → set optimistic to "pending" with user's choice
  - [ ] On WS/poll confirmation → transition to "confirmed"
  - [ ] On mismatch → transition to "failed" + toast
  - [ ] On 8s timeout → transition to "timeout" + toast
- [ ] Task 5: Write tests (AC: #1-#5)
  - [ ] `test_optimistic_state_shows_immediately_on_user_action` (P0)
  - [ ] `test_confirmed_state_replaces_optimistic_without_visual_flicker` (P0)
  - [ ] `test_reconciliation_failure_shows_error_toast_and_reverts_state` (P0)
  - [ ] `test_rapid_actions_queue_reconciliation_correctly` (P1)
  - [ ] `test_empty_state_cleans_up_timers_on_unmount` (P1)

## Dev Notes

### Sally's Visual Spec (Party Mode Consensus)

**Optimistic state:** Shimmer overlay (left-to-right light sweep, 2s loop) on the voted segment only. Opacity 0.85.

**Confirmed:** Shimmer stops. Opacity 0.85→1.0 over 200ms. No toast.

**Failed (server disagrees):** Shimmer stops. Bar transitions to server state over 300ms. Toast: "Vote Updated — Your vote was adjusted to match the recorded result."

**Timeout (8s no response):** Shimmer continues up to 8s. Then opacity drops to 0.6. Toast: "Still Counting — Your vote is being processed." with [Try Again].

### Component Contract

```tsx
<SentimentReveal
  voteBreakdown={voteCounts}
  totalVotes={totalVotes}
  optimisticSegment="bull"
  optimisticStatus="pending"
/>
```

### What This Story Must NOT Create

- Do NOT implement first-voter celebration/AC-E (deferred to Story 3.6)
- Do NOT modify the vote mutation logic in useVote.ts
- Do NOT add new API endpoints

## Change Log

- 2026-04-12: Story created from Story 3.4 party-mode review. ACs from Sally (UX) + John (PM) consensus. Visual spec by Sally.
