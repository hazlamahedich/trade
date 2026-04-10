---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03f-aggregate-scores
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: '2026-04-10'
---

# Test Quality Review: Story 2.2 — Debate Engine Integration (The Pause)

**Quality Score**: 93/100 (A - Excellent)
**Review Date**: 2026-04-10
**Review Scope**: suite (5 test files across 3 levels)
**Reviewer**: TEA Agent (team mantis a)

---

Note: This review audits existing tests; it does not generate tests.

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: Approve with Comments

### Key Strengths

- **Zero determinism violations** — No hard waits, no conditionals controlling test flow, no flakiness patterns detected across all 5 files
- **Zero performance violations** — All tests execute in under 2 seconds; backend suite runs 28 tests in 1.64s; no race conditions in E2E tests
- **100% acceptance criteria coverage** — All 3 ACs covered at multiple test levels (E2E + API + Component) with defense-in-depth
- **Proper isolation practices** — Every Python test class has setup/teardown; Jest tests use beforeEach cleanup; E2E tests use independent page contexts
- **Network-first pattern** — E2E tests correctly inject WebSocket interceptor BEFORE navigation, preventing race conditions

### Key Weaknesses

- **test_debate_pause.py is 704 lines** — Exceeds 300-line threshold by 134%; should be split into 4 focused files
- **24 of 28 backend tests missing @p priority markers** — Inconsistent with frontend tests which all have proper @p0/@p1/@p2 annotations
- **Minor shared-state risk** — Module-level `_DEFAULT_BULL_RETURN`/`_DEFAULT_BEAR_RETURN` dicts passed as `return_value` to AsyncMock could be mutated if stream_debate modifies them in-place
- **Missing edge-case tests** — No test for concurrent ACKs on same debate_id; no test for WS disconnect during pause

### Summary

Story 2.2 tests demonstrate excellent quality with a 93/100 score. The test suite covers all acceptance criteria at three levels (E2E, API/backend, Component) with 28 tests executing in under 2 seconds. The primary concern is maintainability — the main backend test file at 704 lines should be split into focused modules. Missing priority markers on backend tests should be added for consistency with the frontend convention. No blockers found; all issues are P2/P3 and can be addressed in follow-up PRs.

---

## Quality Criteria Assessment

| Criterion                            | Status       | Violations | Notes                                  |
| ------------------------------------ | ------------ | ---------- | -------------------------------------- |
| BDD Format (Given-When-Then)         | ⚠️ WARN      | 4          | 15+ backend tests lack G-W-T comments  |
| Test IDs                             | ⚠️ WARN      | 2          | API-003 uses "extended" suffix; INT-007 duplicates API-001 |
| Priority Markers (P0/P1/P2/P3)       | ⚠️ WARN      | 25         | 24 backend tests + 1 route test missing @p tags |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS       | 0          | No violations detected                 |
| Determinism (no conditionals)        | ✅ PASS       | 0          | All control flow is deterministic      |
| Isolation (cleanup, no shared state) | ✅ PASS       | 1 (P2)     | Shared mutable dict in mock return_value |
| Fixture Patterns                     | ⚠️ WARN      | 1 (P2)     | Inline MagicMock vs conftest fixture inconsistency |
| Data Factories                       | ⚠️ WARN      | 1 (P2)     | Inline dict constants should be factory fixtures |
| Network-First Pattern                | ✅ PASS       | 0          | WS interceptor injected before navigate |
| Explicit Assertions                  | ✅ PASS       | 0          | All assertions visible in test bodies  |
| Test Length (≤300 lines)             | ❌ FAIL       | 2 (P1+P3)  | test_debate_pause.py: 704 lines; E2E spec: 301 lines |
| Test Duration (≤1.5 min)             | ✅ PASS       | 0          | All tests execute in <2 seconds each   |
| Flakiness Patterns                   | ✅ PASS       | 0          | No tight timeouts, race conditions, or retry logic |

**Total Violations**: 0 Critical, 2 High, 34 Medium, 1 Low

---

## Quality Score Breakdown

```
Starting Score:                    100
Critical (P0) Violations:         -0 × 10 = -0
High (P1) Violations:             -2 × 5  = -10
Medium (P2) Violations:           -34 × 2 = -68
Low (P3) Violations:              -1 × 1  = -1

Bonus Points:
  Perfect Determinism:             +5
  Network-First E2E:               +5
  Perfect Performance:             +5
  Perfect Isolation (near):        +5
  100% AC Coverage:                +5
                                   --------
Total Bonus:                       +25

Weighted Dimension Scores:
  Determinism (25%):     100 × 0.25 = 25.00
  Isolation (25%):        98 × 0.25 = 24.50
  Maintainability (20%):  78 × 0.20 = 15.60
  Coverage (15%):         85 × 0.15 = 12.75
  Performance (15%):     100 × 0.15 = 15.00

Final Score:                       93/100
Grade:                             A
```

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Split test_debate_pause.py into focused files

**Severity**: P1 (High)
**Location**: `trade-app/fastapi_backend/tests/services/debate/test_debate_pause.py:1`
**Criterion**: Test Length
**Knowledge Base**: [test-quality.md](../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
The file is 704 lines, exceeding the 300-line threshold by 134%. It contains 7 test classes covering distinct concerns (event lifecycle, ACK waiting, broadcasting, serialization, engine integration) that should be in separate files.

**Recommended Fix**:

Split into:
- `test_pause_event_lifecycle.py` — UNIT-001 to UNIT-005 (~35 lines)
- `test_guardian_ack_wait.py` — UNIT-006 to UNIT-009 (~65 lines)
- `test_debate_broadcasting.py` — UNIT-010 to UNIT-013 (~75 lines)
- `test_debate_pause_integration.py` — INT-001 to INT-011, UNIT-016 (~430 lines, still over but significantly better with extracted helpers)
- `conftest.py` or `test_helpers.py` — Shared `_patched_debate_engine`, `_get_action_types`, `_schedule_ack`

**Benefits**: Improved maintainability, faster test discovery, clearer test intent per file.

---

### 2. Add @p priority markers to backend tests

**Severity**: P2 (Medium)
**Location**: `trade-app/fastapi_backend/tests/services/debate/test_debate_pause.py` (24 tests)
**Criterion**: Priority Markers
**Knowledge Base**: [selective-testing.md](../../_bmad/tea/testarch/knowledge/selective-testing.md)

**Issue Description**:
24 of 28 backend tests in test_debate_pause.py and 1 test in test_ws_guardian_ack.py lack `@p0`/`@p1`/`@p2` markers in their docstrings. This prevents selective test execution by priority (e.g., `pytest -k "@p0"`).

**Current Code**:
```python
def test_2_2_unit_001_set_pause_event(self):
    event = asyncio.Event()  # No docstring with @p marker
    _set_pause_event("deb_1", event)
    assert get_pause_event("deb_1") is event
```

**Recommended Fix**:
```python
def test_2_2_unit_001_set_pause_event(self):
    """[2-2-UNIT-001] @p2 Pause event can be set and retrieved.

    Given a fresh event store
    When _set_pause_event is called with a debate_id and event
    Then get_pause_event returns the same event object
    """
    event = asyncio.Event()
    _set_pause_event("deb_1", event)
    assert get_pause_event("deb_1") is event
```

Suggested priorities:
- UNIT-001 to UNIT-005 → @p2 (lifecycle edge cases)
- UNIT-006 to UNIT-009 → @p1 (core ACK behavior)
- UNIT-010 to UNIT-013 → @p2 (broadcast/serialization)
- INT-001 to INT-004 → @p0 (AC-critical engine behavior)
- INT-005 to INT-011 → @p1 (resilience/edge cases)
- API-003 → @p0 (core ACK unblocks waiter)

---

### 3. Convert shared dict constants to factory functions

**Severity**: P2 (Medium)
**Location**: `trade-app/fastapi_backend/tests/services/debate/test_debate_pause.py:25-38`
**Criterion**: Data Factories / Isolation
**Knowledge Base**: [data-factories.md](../../_bmad/tea/testarch/knowledge/data-factories.md)

**Issue Description**:
`_DEFAULT_BULL_RETURN` and `_DEFAULT_BEAR_RETURN` are module-level mutable dicts passed as `return_value` to AsyncMock. If `stream_debate` mutates the returned dict in-place (e.g., appending to messages list), subsequent tests receive the mutated object.

**Current Code**:
```python
_DEFAULT_BULL_RETURN = {
    "messages": [{"role": "bull", "content": "Test"}],
    "current_turn": 1,
    "current_agent": "bear",
}
# ...
mock_bull.generate = AsyncMock(return_value=_DEFAULT_BULL_RETURN)
```

**Recommended Fix**:
```python
def _default_bull_return():
    return {
        "messages": [{"role": "bull", "content": "Test"}],
        "current_turn": 1,
        "current_agent": "bear",
    }
# ...
mock_bull.generate = AsyncMock(side_effect=_default_bull_return)
```

---

### 4. Move UNIT-016 out of TestEnginePauseIntegration

**Severity**: P1 (High)
**Location**: `trade-app/fastapi_backend/tests/services/debate/test_debate_pause.py:676`
**Criterion**: Test IDs / Level Appropriateness
**Knowledge Base**: [test-levels-framework.md](../../_bmad/tea/testarch/knowledge/test-levels-framework.md)

**Issue Description**:
`test_2_2_unit_016_debate_state_backward_compatible` is a UNIT-level test placed inside `TestEnginePauseIntegration` (an INT-level class). This violates the test ID level classification.

**Recommended Fix**:
Move to a new class `TestDebateStateBackwardCompat` in the same file (or a dedicated `test_debate_state.py`), keeping the UNIT ID prefix.

---

### 5. Fix inconsistent test ID for API-003

**Severity**: P2 (Medium)
**Location**: `trade-app/fastapi_backend/tests/routes/test_ws_guardian_ack.py:89`
**Criterion**: Test IDs
**Knowledge Base**: [test-levels-framework.md](../../_bmad/tea/testarch/knowledge/test-levels-framework.md)

**Issue Description**:
Test method is named `test_2_2_api_003` but the docstring says `[2-2-API-001 extended]`. Should use the unique SEQ number (003).

**Recommended Fix**:
```python
"""[2-2-API-003] @p0 Verify ACK unblocks a coroutine waiting on the event.
```

---

### 6. Extract E2E payload builders to shared helpers

**Severity**: P3 (Low)
**Location**: `trade-app/nextjs-frontend/tests/e2e/guardian-pause-resume.spec.ts:35-89`
**Criterion**: Test Length / Maintainability
**Knowledge Base**: [test-quality.md](../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
File is 301 lines (just over threshold). Payload builder functions (guardianInterruptPayload, debatePausedPayload, debateResumedPayload, argumentCompletePayload) could be extracted for reuse across E2E specs.

**Recommended Fix**:
Move payload builders to `tests/support/helpers/debate-payloads.ts` to bring the spec file under 250 lines and enable reuse.

---

## Best Practices Found

### 1. Network-First WebSocket Interception Pattern

**Location**: `trade-app/nextjs-frontend/tests/e2e/guardian-pause-resume.spec.ts:22-31`
**Pattern**: Network-first (intercept before navigate)
**Knowledge Base**: [timing-debugging.md](../../_bmad/tea/testarch/knowledge/timing-debugging.md)

**Why This Is Good**:
The `navigateToTestDebate` helper injects the WebSocket interceptor via `page.addInitScript` BEFORE calling `page.goto`. This prevents race conditions where real WS messages arrive before the mock is ready.

**Code Example**:
```typescript
async function navigateToTestDebate(page: import('@playwright/test').Page) {
  await injectWebSocketInterceptor(page);  // Intercept FIRST
  await page.addInitScript(() => {         // Set up auth
    localStorage.setItem('accessToken', 'test-e2e-token');
  });
  await page.goto(`/test/debate-stream?debateId=${DEBATE_ID}`);  // Then navigate
  await waitForWebSocketConnection(page);
}
```

---

### 2. Proper Async Test Cleanup with ExitStack

**Location**: `trade-app/fastapi_backend/tests/services/debate/test_debate_pause.py:41-91`
**Pattern**: Context manager-based mocking with guaranteed cleanup
**Knowledge Base**: [test-quality.md](../../_bmad/tea/testarch/knowledge/test-quality.md)

**Why This Is Good**:
The `_patched_debate_engine` context manager uses `ExitStack` to ensure all patches are properly reversed, even if an exception occurs mid-test. This prevents state leakage between tests.

---

### 3. Deterministic Payload Factory Functions

**Location**: `trade-app/nextjs-frontend/tests/e2e/guardian-pause-resume.spec.ts:35-89`
**Pattern**: Factory functions with overrides
**Knowledge Base**: [data-factories.md](../../_bmad/tea/testarch/knowledge/data-factories.md)

**Why This Is Good**:
Each payload builder accepts `overrides` parameter for customization while providing sensible defaults. This makes tests readable (`guardianInterruptPayload({ riskLevel: 'critical' })` is self-documenting) and maintainable.

---

### 4. Component-Level Virtualizer Mock

**Location**: `trade-app/nextjs-frontend/tests/unit/DebateStreamPauseResume.test.tsx:37-48`
**Pattern**: Targeted mock for environment incompatibility
**Knowledge Base**: [test-healing-patterns.md](../../_bmad/tea/testarch/knowledge/test-healing-patterns.md)

**Why This Is Good**:
The `@tanstack/react-virtual` mock returns all items from `getVirtualItems()`, solving the JSDOM limitation where virtualizer needs a real scroll container. This is a well-documented healing pattern with a clear comment explaining why the mock exists.

---

## Test File Analysis

### File Metadata

| File | Lines | Framework | Language |
|------|-------|-----------|----------|
| `test_ws_guardian_ack.py` | 115 | pytest | Python |
| `test_debate_pause.py` | 704 | pytest | Python |
| `guardian-pause-resume.spec.ts` | 301 | Playwright | TypeScript |
| `DebateStreamPauseResume.test.tsx` | 289 | Jest | TypeScript |
| `ws-helpers.ts` | 98 | Playwright | TypeScript |

### Test Structure

- **Describe Blocks**: 10 (3 Python classes + 1 Playwright describe + 1 Jest describe + conftest + fixtures)
- **Test Cases**: 28
- **Test Level Distribution**:
  - E2E: 7 tests (2 @p0, 3 @p1, 2 @p2)
  - API/Backend: 17 tests (4 @p0, 13 @p1)
  - Component: 6 tests (1 @p0, 5 @p1)
- **Fixtures Used**: mock_manager, guardian_interrupt_result, mock_stale_guardian, critical_guardian_result, debate-stream fixtures, WS helpers
- **Data Factories Used**: guardianInterruptPayload, debatePausedPayload, debateResumedPayload, argumentCompletePayload, make_guardian_result

### Assertions Analysis

- **Total Assertions**: ~85
- **Assertions per Test**: ~3 (avg)
- **Assertion Types**: `assert` statements (Python), `expect()` calls (Jest/Playwright), `toHaveBeenCalledWith`, `toHaveTextContent`, `toBeVisible`, `toHaveLength`, `is_set()`, model property checks

---

## Context and Integration

### Related Artifacts

- **Automation Summary**: [automation-summary-2-2.md](../automation-summary-2-2.md)
- **Acceptance Criteria Mapped**: 3/3 (100%)
- **Test Framework**: Playwright (E2E), Jest (Component), pytest (Backend)
- **Conftest Fixtures**: `trade-app/fastapi_backend/tests/services/debate/conftest.py` (185 lines, 12 fixtures)

### Acceptance Criteria Validation

| Acceptance Criterion | Test ID | Status | Notes |
| -------------------- | ------- | ------ | ----- |
| Engine stops on Guardian interrupt | INT-001, E2E-001 | ✅ Covered | Verified at engine + UI level |
| Guardian warning injected as next message | INT-004, COMP-001, E2E-003 | ✅ Covered | 3-level defense-in-depth |
| User acknowledges → engine resumes/ends | INT-002, INT-003, API-001, COMP-004, E2E-001, E2E-002 | ✅ Covered | Both high-risk and critical paths tested |

**Coverage**: 3/3 criteria covered (100%)

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../_bmad/tea/testarch/knowledge/test-quality.md)** — Definition of Done for tests
- **[data-factories.md](../../_bmad/tea/testarch/knowledge/data-factories.md)** — Factory functions with overrides
- **[test-levels-framework.md](../../_bmad/tea/testarch/knowledge/test-levels-framework.md)** — E2E vs API vs Component vs Unit
- **[selective-testing.md](../../_bmad/tea/testarch/knowledge/selective-testing.md)** — Tag/grep priority-based execution
- **[test-healing-patterns.md](../../_bmad/tea/testarch/knowledge/test-healing-patterns.md)** — Virtualizer mock healing pattern
- **[selector-resilience.md](../../_bmad/tea/testarch/knowledge/selector-resilience.md)** — data-testid hierarchy
- **[timing-debugging.md](../../_bmad/tea/testarch/knowledge/timing-debugging.md)** — Network-first pattern

See [tea-index.csv](../../_bmad/tea/testarch/tea-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Add @p priority markers to backend tests** — Add docstrings with @p0/@p1/@p2 to all 25 backend tests missing them
   - Priority: P2
   - Owner: Developer
   - Estimated Effort: 30 min

### Follow-up Actions (Future PRs)

1. **Split test_debate_pause.py** — Break into 4 focused files under 300 lines each
   - Priority: P2
   - Target: Next sprint

2. **Convert dict constants to factory functions** — Replace `_DEFAULT_BULL_RETURN`/`_DEFAULT_BEAR_RETURN` with factory functions
   - Priority: P2
   - Target: Next sprint

3. **Extract E2E payload builders** — Move to shared helper file for reuse
   - Priority: P3
   - Target: Backlog

4. **Add edge-case tests** — Concurrent ACKs, WS disconnect during pause, high-risk timeout integration
   - Priority: P2
   - Target: Next sprint

### Re-Review Needed?

✅ No re-review needed — approve as-is. P2/P3 issues can be addressed in follow-up PRs.

---

## Decision

**Recommendation**: Approve with Comments

> Test quality is excellent with 93/100 score. The test suite achieves 100% acceptance criteria coverage across three test levels with zero determinism or performance violations. Two high-priority maintainability issues (file length, missing priority markers) should be addressed but don't block merge. Tests are production-ready and follow best practices for network-first E2E, proper async cleanup, and deterministic factory patterns.

---

## Appendix

### Violation Summary by Location

| File | Line | Severity | Criterion | Issue | Fix |
| ---- | ---- | -------- | --------- | ----- | --- |
| test_debate_pause.py | 1 | P1 | file_length | 704 lines > 300 threshold | Split into 4 files |
| test_debate_pause.py | 676 | P1 | test_ids | UNIT test in INT class | Move to separate class |
| test_debate_pause.py | 25 | P2 | shared_state | Mutable dict as return_value | Convert to factory function |
| test_debate_pause.py | 25 | P2 | factories | Inline dict constants | Move to conftest as factories |
| test_debate_pause.py | 205 | P2 | fixtures | Inline mock vs conftest fixture | Use mock_manager fixture |
| test_debate_pause.py | 114-704 | P2 | priority_markers | 24 tests missing @p tags | Add priority docstrings |
| test_debate_pause.py | 107-278 | P2 | bdd | 15+ tests lack G-W-T | Add Given-When-Then comments |
| test_debate_pause.py | 89 | P2 | test_ids | API-001-ext format | Change to API-003 |
| test_ws_guardian_ack.py | 89 | P2 | priority_markers | Missing @p tag | Add @p0 |
| guardian-pause-resume.spec.ts | 1 | P3 | file_length | 301 lines > 300 | Extract payload builders |

### Quality Trends

| Review Date | Score | Grade | Critical Issues | Status |
| ----------- | ----- | ----- | --------------- | ------ |
| 2026-04-10 | 93/100 | A | 0 | ✅ Approved |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-story-2-2-20260410
**Timestamp**: 2026-04-10
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `_bmad/tea/testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters — if a pattern is justified, document it with a comment.
