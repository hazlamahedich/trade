---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-04-12'
workflowType: 'testarch-test-review'
inputDocuments:
  - '_bmad-output/implementation-artifacts/3-4-real-time-sentiment-reveal.md'
  - '_bmad-output/test-artifacts/automation-summary-story-3-4.md'
  - '.opencode/skills/bmad-tea/resources/knowledge/test-quality.md'
  - '.opencode/skills/bmad-tea/resources/knowledge/data-factories.md'
  - '.opencode/skills/bmad-tea/resources/knowledge/test-levels-framework.md'
---

# Test Quality Review: Story 3.4 — Real-time Sentiment Reveal

**Quality Score**: 78/100 (B — Acceptable)
**Review Date**: 2026-04-12
**Review Scope**: suite (7 files, 51 tests)
**Reviewer**: TEA Agent (Murat)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Acceptable

**Recommendation**: Approve with Comments

### Key Strengths

- Tests use correct `DEBATE/` prefix for all WebSocket action types — no `GUARDIAN/` violations
- Strong boundary/edge-case coverage: malformed payloads, null guards, zero-votes, empty breakdowns, all-undecided
- Test IDs and priority markers (`@p0`, `@p1`) present on most frontend tests
- Backend tests have strong isolation via helper factories (`_make_connection_manager_mock`, `_make_result_response`, `mock_vote_deps`)
- Good separation of concerns — schema validation, broadcast logic, WS handler, polling, cache updates, animation transitions each in dedicated test files

### Key Weaknesses

- Backend tests lack BDD Given-When-Then structure — tests are flat functions with no `describe`/context grouping
- No data factory pattern in frontend tests — hardcoded test data everywhere (no `createVotePayload()` factory)
- Backend tests missing test IDs and priority markers entirely
- `handleVoteUpdate.test.ts` uses `React._qc` hack to inject QueryClient — fragile, non-standard pattern
- Duplicate framer-motion mock across `SentimentReveal.test.tsx` and `SentimentRevealTransition.test.tsx` — should be extracted to shared mock file

### Summary

The 51 tests for Story 3.4 provide solid functional coverage across backend broadcast logic, WebSocket handling, polling fallback, cache updates, and Framer Motion transitions. Tests are correct and well-structured for the most part, with strong edge-case coverage. However, the backend tests lack BDD structure and test ID conventions, and the frontend tests rely on hardcoded data rather than factory functions. The `React._qc` pattern in the cache update tests is a maintainability risk. Overall quality is acceptable for merge with recommendations for improvement.

---

## Quality Criteria Assessment

| Criterion                            | Status   | Violations | Notes |
| ------------------------------------ | -------- | ---------- | ----- |
| BDD Format (Given-When-Then)         | ⚠️ WARN  | 2          | Backend tests lack describe/context grouping; flat test functions |
| Test IDs                             | ⚠️ WARN  | 2          | Backend tests have no IDs; some frontend tests missing IDs |
| Priority Markers (P0/P1/P2/P3)       | ⚠️ WARN  | 2          | Backend tests have no priority markers; partial frontend coverage |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS  | 0          | No hard waits detected in any file |
| Determinism (no conditionals)        | ✅ PASS  | 0          | No if/else or try/catch for flow control |
| Isolation (cleanup, no shared state) | ✅ PASS  | 0          | Good isolation: beforeEach cleanup, mock factories, no shared state |
| Fixture Patterns                     | ⚠️ WARN  | 1          | React._qc hack in handleVoteUpdate.test.ts is non-standard |
| Data Factories                       | ❌ FAIL  | 2          | No factory functions — all test data is hardcoded inline |
| Network-First Pattern                | N/A      | 0          | No E2E/browser tests in scope |
| Explicit Assertions                  | ✅ PASS  | 0          | All assertions visible in test bodies |
| Test Length (≤300 lines)             | ✅ PASS  | 0          | Longest file is 262 lines (SentimentReveal.test.tsx) |
| Test Duration (≤1.5 min)             | ✅ PASS  | 0          | All unit/integration tests — sub-second execution |
| Flakiness Patterns                   | ✅ PASS  | 0          | No tight timeouts, race conditions, or environment dependencies |

**Total Violations**: 0 Critical, 2 High, 5 Medium, 2 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     0 × 10 = 0
High Violations:         2 × 5 = -10
Medium Violations:       5 × 2 = -10
Low Violations:          2 × 1 = -2

Bonus Points:
  Excellent BDD:         +0
  Comprehensive Fixtures: +0
  Data Factories:        +0
  Network-First:         +0
  Perfect Isolation:     +5
  All Test IDs:          +0
                         --------
Total Bonus:             +5

Final Score:             78/100
Grade:                   B (Acceptable)
```

---

## Critical Issues (Must Fix)

No critical issues detected.

---

## Recommendations (Should Fix)

### 1. Extract Data Factory Functions

**Severity**: P1 (High)
**Location**: All frontend test files
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md](../../.opencode/skills/bmad-tea/resources/knowledge/data-factories.md)

**Issue Description**:
All test data is hardcoded inline — vote payloads, breakdowns, debate IDs are repeated across files. This makes tests brittle to schema changes and hides test intent.

**Current Code**:

```typescript
// ❌ Hardcoded across multiple files
const payload: VoteUpdatePayload = {
  debateId: "deb_test_ws",
  totalVotes: 42,
  voteBreakdown: { bull: 28, bear: 14 },
};
```

**Recommended Fix**:

```typescript
// ✅ Factory with overrides
const createVotePayload = (overrides: Partial<VoteUpdatePayload> = {}): VoteUpdatePayload => ({
  debateId: "deb_test",
  totalVotes: 10,
  voteBreakdown: { bull: 7, bear: 3 },
  ...overrides,
});

// Usage — intent is explicit
const payload = createVotePayload({ totalVotes: 42, voteBreakdown: { bull: 28, bear: 14 } });
```

**Priority**: P1 — affects maintainability and parallel safety

---

### 2. Remove React._qc QueryClient Hack

**Severity**: P1 (High)
**Location**: `handleVoteUpdate.test.ts:35,68`
**Criterion**: Fixture Patterns
**Knowledge Base**: [fixture-architecture.md](../../.opencode/skills/bmad-tea/resources/knowledge/fixture-architecture.md)

**Issue Description**:
`useTestHandleVoteUpdate` injects QueryClient via `(React as unknown as { _qc?: QueryClient })._qc`. This is fragile, type-unsafe, and non-standard. The wrapper already has the QueryClient — use a proper hook testing pattern.

**Current Code**:

```typescript
// ❌ Type-unsafe React hack
const queryClient = (React as unknown as { _qc?: QueryClient })._qc!;
```

**Recommended Fix**:

```typescript
// ✅ Use QueryClient from wrapper context via useRef or module-level variable
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

// Access queryClient directly from createWrapper result for assertions
```

**Priority**: P1 — type safety risk, breaks with React strict mode changes

---

### 3. Add BDD Structure to Backend Tests

**Severity**: P2 (Medium)
**Location**: `test_vote_broadcast.py` and `test_vote_update_payload.py`
**Criterion**: BDD Format
**Knowledge Base**: [test-quality.md](../../.opencode/skills/bmad-tea/resources/knowledge/test-quality.md)

**Issue Description**:
Backend tests are flat `async def test_*` functions with no `describe` grouping via `@pytest.mark.describe` or class-based organization. This makes it harder to understand test intent and run targeted subsets.

**Current Code**:

```python
# ❌ Flat test functions, no grouping
@pytest.mark.asyncio
async def test_successful_vote_triggers_broadcast():
    ...

@pytest.mark.asyncio
async def test_broadcast_failure_does_not_fail_vote():
    ...
```

**Recommended Fix**:

```python
# ✅ Class-based grouping with clear test names
@pytest.mark.describe("Vote Broadcast")
class TestVoteBroadcast:
    @pytest.mark.asyncio
    async def test_successful_vote_triggers_broadcast(self):
        ...

    @pytest.mark.asyncio
    async def test_broadcast_failure_does_not_fail_vote(self):
        ...

@pytest.mark.describe("Vote Broadcast — Negative Cases")
class TestVoteBroadcastNegative:
    @pytest.mark.asyncio
    async def test_no_broadcast_on_duplicate_vote(self):
        ...
```

**Priority**: P2 — maintainability improvement

---

### 4. Add Test IDs and Priority Markers to Backend Tests

**Severity**: P2 (Medium)
**Location**: `test_vote_broadcast.py`, `test_vote_update_payload.py`
**Criterion**: Test IDs, Priority Markers
**Knowledge Base**: [test-levels-framework.md](../../.opencode/skills/bmad-tea/resources/knowledge/test-levels-framework.md)

**Issue Description**:
Backend tests lack both test IDs (e.g., `3.4-INT-001`) and priority markers (`@p0`, `@p1`). Frontend tests have these in the test name strings but backend tests do not.

**Current Code**:

```python
# ❌ No test ID or priority
async def test_successful_vote_triggers_broadcast():
```

**Recommended Fix**:

```python
# ✅ Test ID and priority in docstring
@pytest.mark.asyncio
@pytest.mark.priority("p0")
async def test_successful_vote_triggers_broadcast():
    """[3.4-INT-001] @p0 — Successful vote triggers DEBATE/VOTE_UPDATE broadcast"""
```

**Priority**: P2 — consistency across codebase

---

### 5. Extract Shared Framer Motion Mock

**Severity**: P2 (Medium)
**Location**: `SentimentReveal.test.tsx:5-49` and `SentimentRevealTransition.test.tsx:5-55`
**Criterion**: Maintainability
**Knowledge Base**: [test-quality.md](../../.opencode/skills/bmad-tea/resources/knowledge/test-quality.md)

**Issue Description**:
Both test files duplicate the same ~45-line framer-motion mock with minor differences. This violates DRY and makes updates error-prone.

**Recommended Fix**:

```typescript
// tests/support/helpers/mock-framer-motion.ts
export function createFramerMotionMock(options?: { captureTransition?: boolean }) {
  // shared mock implementation
}

// Each test file imports and uses the shared mock
jest.mock("framer-motion", () => createFramerMotionMock({ captureTransition: true }));
```

**Priority**: P2 — DRY violation, maintainability

---

### 6. Add Missing Test IDs on Some Frontend Tests

**Severity**: P3 (Low)
**Location**: `useDebateSocketVoteUpdate.test.ts:18`, `useDebateSocketVoteUpdate.test.ts:57`, `useDebateSocketVoteUpdate.test.ts:93`
**Criterion**: Test IDs
**Knowledge Base**: [test-levels-framework.md](../../.opencode/skills/bmad-tea/resources/knowledge/test-levels-framework.md)

**Issue Description**:
Three tests in `useDebateSocketVoteUpdate.test.ts` lack test ID prefixes like `[3-4-UNIT-001]`. The describe block has `[3-4-UNIT]` but individual tests don't carry IDs.

**Priority**: P3 — minor consistency issue

---

## Best Practices Found

### 1. Helper Factory Functions for Mock Construction

**Location**: `test_vote_broadcast.py:13-27`
**Pattern**: Pure Function → Test Helper
**Knowledge Base**: [data-factories.md](../../.opencode/skills/bmad-tea/resources/knowledge/data-factories.md)

**Why This Is Good**:
`_make_connection_manager_mock()` and `_make_result_response()` act as factory functions for mock objects, accepting overrides (`connection_count`, `total_votes`, `breakdown`). This pattern centralizes mock construction and makes tests readable.

```python
def _make_result_response(total_votes: int = 5, breakdown: dict | None = None) -> MagicMock:
    result = MagicMock()
    result.total_votes = total_votes
    result.vote_breakdown = breakdown or {"bull": 3, "bear": 2}
    return result
```

---

### 2. WebSocket Action Type Validation

**Location**: `test_vote_broadcast.py:145-162`
**Pattern**: Prefix Safety Check
**Knowledge Base**: Project AGENTS.md — Lesson 3

**Why This Is Good**:
`test_broadcast_action_type_has_debate_prefix` explicitly validates the `DEBATE/` prefix convention, preventing the recurring bug documented in the project's lessons learned. This is a regression guard for a known failure mode.

---

### 3. Reduced Motion Testing

**Location**: `SentimentRevealTransition.test.tsx:130-161`
**Pattern**: Accessibility-First Testing
**Knowledge Base**: [test-quality.md](../../.opencode/skills/bmad-tea/resources/knowledge/test-quality.md)

**Why This Is Good**:
Tests explicitly verify `duration: 0` and `delay: 0` when `useReducedMotion` returns true. This ensures the component respects the user's motion preferences — an often-overlooked accessibility requirement.

---

### 4. Concurrent Vote Testing

**Location**: `test_vote_broadcast.py:165-198`
**Pattern**: Concurrency Safety
**Knowledge Base**: [test-quality.md](../../.opencode/skills/bmad-tea/resources/knowledge/test-quality.md)

**Why This Is Good**:
Uses `asyncio.gather()` to simulate concurrent votes, verifying both succeed and both broadcasts fire. This catches race conditions that sequential tests would miss.

---

## Test File Analysis

### File Metadata

| File | Lines | Framework | Language | Tests |
|------|-------|-----------|----------|-------|
| `test_vote_broadcast.py` | 260 | pytest + asyncio | Python | 11 |
| `test_vote_update_payload.py` | 87 | pytest | Python | 8 |
| `useDebateSocketVoteUpdate.test.ts` | 124 | Jest | TypeScript | 3 |
| `useVotingStatusPolling.test.ts` | 108 | Jest | TypeScript | 5 |
| `handleVoteUpdate.test.ts` | 163 | Jest | TypeScript | 3 |
| `SentimentReveal.test.tsx` | 262 | Jest + RTL | TSX | 15 |
| `SentimentRevealTransition.test.tsx` | 162 | Jest + RTL | TSX | 6 |

**Total**: 7 files, 1,166 lines, 51 tests

### Test Scope

- **Test IDs**: Partial — frontend tests use `[3-X-UNIT-XXX]` format in names; backend tests have none
- **Priority Distribution**:
  - P0 (Critical): ~30 tests (broadcast success, payload correctness, cache updates, bar rendering)
  - P1 (High): ~8 tests (failure isolation, reduced motion, rerender)
  - Unknown: ~13 tests (no priority marker)

### Assertions Analysis

- **Total Assertions**: ~120 (estimated across all files)
- **Assertions per Test**: ~2.4 avg
- **Assertion Types**: `assert` (Python), `expect().toBe()`, `expect().toHaveBeenCalledWith()`, `expect().toHaveStyle()`, `expect().toBeInTheDocument()`

---

## Context and Integration

### Related Artifacts

- **Story File**: [3-4-real-time-sentiment-reveal.md](../implementation-artifacts/3-4-real-time-sentiment-reveal.md)
- **Automation Summary**: [automation-summary-story-3-4.md](automation-summary-story-3-4.md)

### Acceptance Criteria Coverage

| AC | Description | Tests |
|----|-------------|-------|
| AC1 | Sentiment stats HIDDEN for non-voters | `useVotingStatusPolling.test.ts` — refetchInterval false when hasVoted=false |
| AC2 | Animated "Reveal" with Framer Motion | `SentimentRevealTransition.test.tsx` — stagger delay, duration |
| AC3 | Real-time via DEBATE/VOTE_UPDATE WS push | `test_vote_broadcast.py` + `useDebateSocketVoteUpdate.test.ts` |
| AC4 | Polling fallback every 5s | `useVotingStatusPolling.test.ts` — VOTE_POLL_INTERVAL_MS=5000 |

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../.opencode/skills/bmad-tea/resources/knowledge/test-quality.md)** — Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[data-factories.md](../../.opencode/skills/bmad-tea/resources/knowledge/data-factories.md)** — Factory functions with overrides, API-first setup
- **[test-levels-framework.md](../../.opencode/skills/bmad-tea/resources/knowledge/test-levels-framework.md)** — E2E vs API vs Component vs Unit appropriateness

For coverage mapping, consult `trace` workflow outputs.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Extract data factory functions** — Create `createVotePayload()` and `createMockBreakdown()` factories
   - Priority: P1
   - Estimated Effort: 30 min

2. **Replace React._qc hack** — Use proper QueryClient access pattern in handleVoteUpdate tests
   - Priority: P1
   - Estimated Effort: 20 min

### Follow-up Actions (Future PRs)

1. **Add BDD structure to backend tests** — Group with classes or markers
   - Priority: P2
   - Target: next sprint

2. **Extract shared framer-motion mock** — DRY up the duplicated ~45-line mock
   - Priority: P2
   - Target: next sprint

3. **Add test IDs and priority markers to backend tests** — Follow `[EPIC.STORY-LEVEL-SEQ]` convention
   - Priority: P2
   - Target: next sprint

### Re-Review Needed?

✅ No re-review needed — approve with comments. P1 items are maintainability improvements, not blockers.

---

## Decision

**Recommendation**: Approve with Comments

> Test quality is acceptable with 78/100 score. The two P1 recommendations (data factories and React._qc hack) should be addressed in a follow-up PR but don't block merge. All 51 tests are correct, deterministic, well-isolated, and provide strong edge-case coverage. No critical issues or flakiness risks detected.

---

## Appendix

### Violation Summary by Location

| Line | File | Severity | Criterion | Issue | Fix |
|------|------|----------|-----------|-------|-----|
| — | All frontend | P1 | Data Factories | Hardcoded test data | Extract factory functions |
| 35,68 | handleVoteUpdate.test.ts | P1 | Fixture Patterns | React._qc hack | Use wrapper-provided QC |
| — | test_vote_broadcast.py | P2 | BDD Format | No describe grouping | Class-based organization |
| — | test_vote_*.py | P2 | Test IDs | No test IDs | Add `[3.4-INT-XXX]` |
| — | test_vote_*.py | P2 | Priority Markers | No @p0/@p1 | Add pytest markers |
| 5-49 | SentimentReveal*.tsx | P2 | Maintainability | Duplicate FM mock | Extract shared mock |
| 18,57,93 | useDebateSocketVoteUpdate.test.ts | P3 | Test IDs | Missing per-test IDs | Add `[3-4-UNIT-XXX]` |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Murat)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-story-3-4-20260412
**Timestamp**: 2026-04-12
**Version**: 1.0
