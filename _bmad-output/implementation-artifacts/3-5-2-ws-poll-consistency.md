# Story 3.5.2: WS/Poll Consistency — Pure Gate

Status: done

## Story

As a User,
I want sentiment data to always reflect the freshest available source,
So that I never see stale polling data overwrite a fresher WebSocket update.

## Acceptance Criteria

1. **AC1: Polling Suppressed When WS Connected** — Given the WebSocket is connected, When I view sentiment data, Then HTTP polling is disabled (`refetchInterval: false`). The WebSocket is the sole data source.
2. **AC2: Polling Resumes on WS Disconnect** — Given the WebSocket disconnects, When I am viewing sentiment data and have voted, Then HTTP polling activates within one interval cycle (5s) as fallback.
3. **AC3: No Concurrent Writers** — At no point should both WebSocket handler and polling response write to the React Query cache simultaneously. The `wsConnected` state determines which path is active.

## Tasks

- [ ] Task 1: Expose `isConnected` boolean from useDebateSocket (AC: #1, #2)
  - [ ] `useDebateSocket` already returns `isConnected: status === "connected"` at line 359
  - [ ] No changes needed — `isConnected` is already available
- [ ] Task 2: Gate polling in useVotingStatus based on WS connection state (AC: #1, #2, #3)
  - [ ] Accept `wsConnected: boolean` parameter in `useVotingStatus`
  - [ ] Change `refetchInterval` to: `hasVoted && !wsConnected ? VOTE_POLL_INTERVAL_MS : false`
  - [ ] Keep `refetchIntervalInBackground: false`
  - [ ] Keep `enabled: !!debateId` unchanged
- [ ] Task 3: Wire wsConnected from DebateStream to useVotingStatus (AC: #1, #2, #3)
  - [ ] In DebateStream, extract `isConnected` from `useDebateSocket` return value (already available as `status === "connected"` or the `isConnected` property)
  - [ ] Pass `wsConnected` to `useVotingStatus(debateId, { wsConnected })`
  - [ ] Actually — useVotingStatus is a simple hook that takes `debateId`. Add optional second param or use a context. Simplest: add `wsConnected` as optional second param with default `false` (safe fallback — polls when WS state unknown)
- [ ] Task 4: Write tests (AC: #1, #2, #3)
  - [ ] `test_poll_suppressed_when_ws_connected` — refetchInterval is false when wsConnected=true and hasVoted=true
  - [ ] `test_poll_active_when_ws_disconnected_and_voted` — refetchInterval is VOTE_POLL_INTERVAL_MS when wsConnected=false and hasVoted=true
  - [ ] `test_poll_inactive_when_not_voted_regardless_of_ws` — refetchInterval is false when hasVoted=false (both wsConnected states)
  - [ ] `test_ws_connected_overrides_voted_state` — even when hasVoted=true, wsConnected=true suppresses polling

## Dev Notes

### Architecture Decision (Party Mode Consensus)

**Pure gate approach** — Winston's recommendation, approved by John, Amelia, Murat.

- WS connected → polling OFF. Single writer (WS handler via handleVoteUpdate).
- WS disconnected → polling ON. Single writer (HTTP refetch).
- No concurrent writes. No sequence IDs needed.
- Zero backend changes. Zero schema changes.

Amelia's sequence_id proposal was architecturally sound but solves a problem our system doesn't have (no message replay on reconnect). Deferred indefinitely.

### Implementation

```typescript
// useVotingStatus.ts — updated signature
export function useVotingStatus(debateId: string, options?: { wsConnected?: boolean }) {
  const wsConnected = options?.wsConnected ?? false;
  // ...
  const shouldPoll = hasVoted && !wsConnected;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.debateResult(debateId),
    queryFn: () => fetchDebateResult(debateId),
    enabled: !!debateId,
    refetchInterval: shouldPoll ? VOTE_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}

// DebateStream.tsx — wire it
const { status, sendGuardianAck } = useDebateSocket({ ... });
const wsConnected = status === "connected";
const { hasVoted, voteCounts, totalVotes, serverStatus } = useVotingStatus(debateId, { wsConnected });
```

### Default Behavior

When `wsConnected` is not provided (default `false`), polling is active when `hasVoted=true`. This is the safe fallback — if a consumer doesn't pass WS state, it polls as before. No breaking change to existing call sites.

### What This Story Must NOT Create

- Do NOT add sequence_id to WebSocket payloads
- Do NOT add timestamp-based cache guards
- Do NOT modify the backend in any way
- Do NOT change the `useDebateSocket` hook (it already exposes `isConnected`)

## Change Log

- 2026-04-12: Story created from Story 3.4 party-mode implementation review (consensus: Winston arch, Amelia dev, Murat test, John PM).
