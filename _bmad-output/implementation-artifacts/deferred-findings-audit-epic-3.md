# Deferred Review Findings Audit — Epic 3

**Date:** 2026-04-13
**Purpose:** Assess which deferred findings from Epic 3 carry risk into Epic 4

---

## High-Risk Items (Address Before/During Epic 4)

| # | Item | Story | File | Risk to Epic 4 |
|---|------|-------|------|----------------|
| H1 | **DebateStream god component (414+ lines)** | 3-2 | `DebateStream.tsx` | Epic 4 history page features will add more wiring. Must decompose before Epic 4 stories touch it. |
| H2 | **B3: Vote mutability** — Allow vote changes during active debates, lock on completion | 3-1 | Backlog | If Epic 4 shows historical debates with vote revisions, data model must support it. Product decision pending. |
| H3 | **B7: Guardian hooks for vote events** — Debate state reacts to sentiment shifts | 3-1 | Backlog | If Epic 4 has Guardian reacting to post-vote sentiment, this is a prerequisite. |

## Medium-Risk Items (Evaluate During Epic 4 Planning)

| # | Item | Story | File | Risk to Epic 4 |
|---|------|-------|------|----------------|
| M1 | **B1: Capacity model redesign** — Redis SET/SADD for unique voters | 3-1 | `rate_limiter.py:100-107` | Current INCR counter measures throughput not unique voters. At scale with multi-debate, could miscount. |
| M2 | **B4: Vote instrumentation** — duplicate_rejection_rate, vote_latency_p99 | 3-1 | Backlog | Observability gap. Would help diagnose Epic 4 integration issues. |
| M3 | **Voter fingerprint trivially spoofable** | 3-2 | `api.ts:104-114` | Anonymous-first design accepted per spec. Rate limiting mitigates. No Epic 4 impact. |
| M4 | **Vote in-flight during Guardian freeze** — Error toast obscured by overlay | 3-2 | `VoteControls.tsx:26` | Minor UX glitch. Could cause confusion if Guardian interactions increase in Epic 4. |

## Low-Risk / No-Block Items (Carry Forward)

| # | Item | Story | Notes |
|---|------|-------|-------|
| L1 | Lazy limiter init not thread-safe | 3-1 | CPython GIL + single-event-loop makes this safe. Accepted. |
| L2 | B2: Rename VOTE_CAPACITY_LIMIT | 3-1 | Pure rename. No functional impact. |
| L3 | B5: Rate-limit tuning spike | 3-1 | Operational tuning. Needs production data. |
| L4 | B6: Vote-change audit trail UI | 3-1 | Dependent on B3. Independent of Epic 4. |
| L5 | No CSRF protection on vote POST | 3-2 | Anonymous-first design. Rate limiting is the guard. |
| L6 | fetchDebateResult doesn't validate response shape | 3-2 | Codebase-wide pattern. |
| L7 | crypto.randomUUID in non-secure context | 3-2 | Deployment assumption holds. |
| L8 | useMutation object in useCallback dependency | 3-2 | Memoization technically ineffective but harmless. |
| L9 | sessionStorage fails when full/disabled | 3-2 | Edge case accepted for MVP. |
| L10 | Benchmark tests repo layer not HTTP endpoint | 3-3 | Test architecture choice. |
| L11 | String-based query detection fragile | 3-3 | Will break on SQLAlchemy major upgrade only. |
| L12 | Future scaling path (Redis INCR / covering index) | 3-3 | Only needed at >10K concurrent. |
| L13 | Amelia's sequence_id proposal deferred | 3-5-2 | Deliberate decision. May revisit if WS replay added. |
| L14 | AnimatePresence exit animation never fires | 3-6 | Cosmetic. Badge self-hides before AnimatePresence detects unmount. |
| L15 | Test coverage gaps (P1) — ariaLabel pending, bar opacity | 3-6 | Runtime code correct. |

## Resolved During Epic 3 (No Longer Deferred)

| Original Finding | Resolved In |
|-----------------|-------------|
| DB write consumes capacity on failure | Story 3-1 party-mode review (RateLimiter.release()) |
| useVotingStatus never refetches | Story 3-4 (refetchInterval) |
| Percentage rounding overflow | Story 3-5-1 (complement-based calculation) |
| WS/Poll stale overwrite | Story 3-5-2 (single-writer gate pattern) |
| E2E voting.spec.ts stale data | Story 3-2 test review remediation |

---

## Recommendation for Epic 4

**Must fix before Epic 4:** H1 (DebateStream decomposition)

**Must evaluate during Epic 4 planning:** H2, H3 (product decisions about vote mutability and Guardian-vote integration)

**Can carry forward:** All M and L items
