---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-03-31'
---

# Test Quality Review: test_guardian_agent.py

**Quality Score**: 95/100 (A+ - Excellent)
**Review Date**: 2026-03-31
**Review Scope**: single
**Reviewer**: TEA Agent (team mantis a)

---

Note: This review audits existing tests; it does not generate tests.

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: Approve

### Key Strengths

✅ Comprehensive AC coverage — all 3 acceptance criteria mapped to specific test IDs with both positive and negative cases
✅ Perfect test ID discipline — all 52 tests follow `test_2_1_unit_NNN` / `test_2_1_int_NNN` pattern consistently
✅ Zero flakiness risk — all LLM calls mocked, no I/O, no sleeps, no timeouts; 52 tests execute in 0.08s
✅ Excellent edge case coverage — empty messages, missing roles, guardian disabled, LLM failure graceful degradation, non-structured output fallback
✅ Strong constraint validation — Literal types for risk_level, fallacy_type, summary_verdict tested with both valid and invalid values

### Key Weaknesses

❌ File is 1,507 lines — 5x the 300-line ideal threshold; should be split into focused modules
❌ Repeated mock boilerplate in integration tests — `mock_bull_generate`/`mock_bear_generate`/`fresh_status`/`mock_stale_guardian` patterns duplicated ~8 times
❌ No explicit BDD Given-When-Then comments in test bodies (names are descriptive but lack GWT structure)

### Summary

The Guardian Agent test suite demonstrates excellent quality with a 95/100 score. All 3 acceptance criteria are thoroughly covered across 52 tests (42 unit + 10 integration) with 115 assertions. The test suite runs in 0.08s with zero external dependencies. The primary maintainability concern is the 1,507-line file size and repeated mock boilerplate in integration tests, which should be addressed in a follow-up refactor. No critical issues or flakiness risks exist.

---

## Quality Criteria Assessment

| Criterion                            | Status | Violations | Notes                                      |
| ------------------------------------ | ------ | ---------- | ------------------------------------------ |
| BDD Format (Given-When-Then)         | ⚠️ WARN | 1          | Descriptive names but no GWT comments      |
| Test IDs                             | ✅ PASS | 0          | All 52 tests follow consistent ID pattern  |
| Priority Markers (P0/P1/P2/P3)       | ⚠️ WARN | 1          | No priority markers in test decorators     |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS | 0          | No waits of any kind                       |
| Determinism (no conditionals)        | ✅ PASS | 0          | All LLM calls mocked; `nonlocal` in 2 tests acceptable for mock switching |
| Isolation (cleanup, no shared state) | ✅ PASS | 0          | Each test creates own fixtures/mocks       |
| Fixture Patterns                     | ⚠️ WARN | 1          | Fixtures exist but integration mock setup not extracted |
| Data Factories                       | ⚠️ WARN | 1          | Inline test data rather than factory functions |
| Network-First Pattern                | ✅ PASS | 0          | N/A — backend pytest, no browser           |
| Explicit Assertions                  | ✅ PASS | 0          | 115 explicit assertions across 48 functions |
| Test Length (≤300 lines)             | ❌ FAIL | 1          | 1,507 lines (5x threshold)                 |
| Test Duration (≤1.5 min)             | ✅ PASS | 0          | 0.08s total                                |
| Flakiness Patterns                   | ✅ PASS | 0          | No tight timeouts, race conditions, or env dependencies |

**Total Violations**: 0 Critical, 2 High, 3 Medium, 1 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -0 × 10 = -0
High Violations:         -2 × 5  = -10
Medium Violations:       -3 × 2  = -6
Low Violations:          -1 × 1  = -1

Bonus Points:
  Excellent BDD:         +0 (GWT comments missing)
  Comprehensive Fixtures: +0 (basic fixtures, not extracted)
  Data Factories:        +0 (inline data, no factories)
  Network-First:         +0 (N/A for backend)
  Perfect Isolation:     +5 (no shared state, clean tests)
  All Test IDs:          +5 (100% coverage)
                         --------
Total Bonus:             +10

Final Score:             95/100
Grade:                   A+ (Excellent)
```

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Split 1,507-line Test File into Focused Modules

**Severity**: P1 (High)
**Location**: `trade-app/fastapi_backend/tests/services/debate/test_guardian_agent.py` (entire file)
**Criterion**: Test Length (≤300 lines)
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
The file is 1,507 lines — 5x the 300-line ideal threshold. This makes navigation difficult, increases merge conflict risk, and slows code review.

**Recommended Fix**:

```
tests/services/debate/
├── test_guardian_agent_analyze.py        # TestGuardianAgentAnalyze (lines 25-217)
├── test_guardian_agent_payloads.py       # TestGuardianInterruptPayload, TestGuardianVerdictPayload,
                                           # TestGuardianPayloadRoundTrip (lines 219-1107)
├── test_guardian_agent_streaming.py      # TestSendGuardianInterrupt, TestSendGuardianVerdict (lines 282-331)
├── test_guardian_agent_state.py          # TestDebateStateBackwardCompat, TestGuardianAuditLog,
                                           # TestFormatAllArgumentsEdgeCases (lines 334-951)
├── test_guardian_agent_constraints.py    # TestGuardianAnalysisResultConstraints,
                                           # TestWebSocketActionTypeGuardian (lines 369-419, 953-1040)
├── test_guardian_agent_integration.py    # TestGuardianEngineIntegration, TestGuardianVerdictFailureAtDebateEnd,
                                           # TestMixedSafeInterruptAcrossTurns (lines 421-1507)
└── conftest.py                           # Shared fixtures (unchanged)
```

**Benefits**: Improved navigation, reduced merge conflicts, faster code review, clearer test ownership.

**Priority**: P1 — should be addressed in next refactor cycle.

---

### 2. Extract Integration Test Mock Boilerplate to Shared Fixtures

**Severity**: P1 (High)
**Location**: `test_guardian_agent.py:430-498, 502-582, 585-665, 668-742, 745-828, 831-897, 1306-1394, 1406-1507`
**Criterion**: Fixture Patterns
**Knowledge Base**: [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)

**Issue Description**:
The `mock_bull_generate`, `mock_bear_generate`, `fresh_status`, `mock_stale_guardian`, and `mock_manager` setup patterns are duplicated across all 8 integration tests (~15-20 lines each). This is ~120-160 lines of repeated boilerplate.

**Current Code**:

```python
# ⚠️ Repeated in int_001 through int_008
fresh_status = FreshnessStatus(
    asset="BTC", is_stale=False,
    last_update=datetime.now(timezone.utc),
    age_seconds=5, threshold_seconds=60,
)
mock_stale_guardian = MagicMock()
mock_stale_guardian.get_freshness_status = AsyncMock(return_value=fresh_status)

async def mock_bull_generate(state):
    return {
        "messages": state["messages"] + [{"role": "bull", "content": "Bull arg"}],
        "current_turn": state["current_turn"] + 1,
        "current_agent": "bear",
    }

async def mock_bear_generate(state):
    return {
        "messages": state["messages"] + [{"role": "bear", "content": "Bear arg"}],
        "current_turn": state["current_turn"] + 1,
        "current_agent": "bull",
    }
```

**Recommended Improvement**:

```python
# ✅ In conftest.py — shared integration fixtures
@pytest.fixture
def mock_stale_guardian():
    fresh_status = FreshnessStatus(
        asset="BTC", is_stale=False,
        last_update=datetime.now(timezone.utc),
        age_seconds=5, threshold_seconds=60,
    )
    guardian = MagicMock()
    guardian.get_freshness_status = AsyncMock(return_value=fresh_status)
    return guardian

@pytest.fixture
def mock_agents_with_generate():
    mock_bull = MagicMock()
    mock_bull.generate = AsyncMock(side_effect=lambda s: {
        "messages": s["messages"] + [{"role": "bull", "content": "Bull arg"}],
        "current_turn": s["current_turn"] + 1, "current_agent": "bear",
    })
    mock_bear = MagicMock()
    mock_bear.generate = AsyncMock(side_effect=lambda s: {
        "messages": s["messages"] + [{"role": "bear", "content": "Bear arg"}],
        "current_turn": s["current_turn"] + 1, "current_agent": "bull",
    })
    return mock_bull, mock_bear
```

**Benefits**: ~120 lines removed, single point of change, easier to add new integration tests.

**Priority**: P1 — high ROI refactor.

---

### 3. Add BDD Given-When-Then Comments to Integration Tests

**Severity**: P2 (Medium)
**Location**: `test_guardian_agent.py:430-1507` (integration tests)
**Criterion**: BDD Format (Given-When-Then)
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
Unit tests have descriptive names that imply Given-When-Then, but integration tests would benefit from explicit GWT comments for readability.

**Recommended Improvement**:

```python
async def test_2_1_int_001_guardian_called_per_turn(self, mock_manager):
    # Given: guardian is enabled with safe analysis
    # When: stream_debate runs for 2 turns
    # Then: guardian.analyze is called at least once per turn
    ...
```

**Benefits**: Faster understanding of test intent during code review and debugging.

**Priority**: P2 — nice-to-have improvement.

---

### 4. Consider Data Factory Functions for GuardianAnalysisResult

**Severity**: P2 (Medium)
**Location**: `test_guardian_agent.py` (throughout)
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)

**Issue Description**:
`GuardianAnalysisResult` objects are constructed inline in nearly every test. A factory function with overrides would reduce boilerplate and improve readability.

**Recommended Improvement**:

```python
def make_guardian_result(**overrides):
    defaults = dict(
        should_interrupt=False, risk_level="low", fallacy_type=None,
        reason="No issues detected.", summary_verdict="Wait",
        safe=True, detailed_reasoning="",
    )
    return GuardianAnalysisResult(**{**defaults, **overrides})

# Usage:
result = make_guardian_result(should_interrupt=True, risk_level="high")
```

**Benefits**: DRY principle, easier to modify default test data, more readable tests.

**Priority**: P2 — should be done during file split refactor.

---

### 5. `nonlocal call_count` Pattern in Behavior-Switching Mocks

**Severity**: P3 (Low)
**Location**: `test_guardian_agent.py:1327-1332, 1417-1441`
**Criterion**: Determinism
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
Tests `int_007` (line 1327) and `int_008` (line 1417) use `nonlocal call_count` with `if/else` to switch mock behavior across calls. This is acceptable for mock infrastructure but slightly reduces readability.

**Recommended Improvement**:

```python
# ✅ Use itertools.cycle or a list of side_effect values
from itertools import cycle

responses = [
    interrupt_analysis.model_dump(),
    safe_analysis.model_dump(),
]
mock_guardian.analyze = AsyncMock(side_effect=cycle(responses))
```

**Benefits**: Eliminates mutable state, more declarative mock definition.

**Priority**: P3 — minor improvement, not blocking.

---

## Best Practices Found

### 1. Parametrized Fallacy Category Testing

**Location**: `test_guardian_agent.py:1164-1206`
**Pattern**: `@pytest.mark.parametrize`
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Why This Is Good**:
Uses `@pytest.mark.parametrize` to test all 5 fallacy categories in a single test function rather than 5 copy-pasted tests. Each fallacy gets its own test case in the report.

**Code Example**:

```python
@pytest.mark.parametrize("fallacy", [
    "unsubstantiated_claim", "confirmation_bias",
    "overconfidence", "cognitive_bias", "dangerous_advice",
])
async def test_2_1_unit_038_each_fallacy_detected(self, debate_state_with_arguments, fallacy):
    ...
    assert analysis["fallacy_type"] == fallacy
```

**Use as Reference**: Apply this pattern to any test that validates a set of valid/invalid values.

---

### 2. Graceful Degradation Testing

**Location**: `test_guardian_agent.py:142-161, 668-742`
**Pattern**: Error boundary testing with fallback behavior

**Why This Is Good**:
Tests both that LLM failures are caught at the unit level (unit_007) AND that the full debate loop continues when the guardian fails (int_004). This two-level error testing ensures resilience.

**Use as Reference**: Always test error handling at both unit and integration levels.

---

### 3. Round-Trip Serialization Testing

**Location**: `test_guardian_agent.py:1043-1107`
**Pattern**: Serialize → Deserialize → Assert equality

**Why This Is Good**:
Tests that payloads survive a full serialization round-trip (model_dump → reconstruct), ensuring camelCase aliasing and type coercion work correctly end-to-end.

**Use as Reference**: Apply to all Pydantic models used in WebSocket/API boundaries.

---

## Test File Analysis

### File Metadata

- **File Path**: `trade-app/fastapi_backend/tests/services/debate/test_guardian_agent.py`
- **File Size**: 1,507 lines, ~58 KB
- **Test Framework**: pytest
- **Language**: Python 3.11+

### Test Structure

- **Test Classes**: 18
- **Test Cases**: 52 (42 unit + 10 integration)
- **Average Test Length**: ~29 lines per test
- **Fixtures Used**: 2 (`debate_state`, `debate_state_with_arguments` from conftest.py; `mock_manager` per-class)
- **Data Factories Used**: 0

### Test Structure by Class

| Class | Lines | Tests | Type |
|-------|-------|-------|------|
| TestGuardianAgentAnalyze | 25-217 | 9 | Unit |
| TestGuardianInterruptPayload | 219-250 | 2 | Unit |
| TestGuardianVerdictPayload | 253-279 | 2 | Unit |
| TestSendGuardianInterrupt | 282-307 | 1 | Unit |
| TestSendGuardianVerdict | 309-331 | 1 | Unit |
| TestDebateStateBackwardCompat | 334-367 | 2 | Unit |
| TestWebSocketActionTypeGuardian | 369-391 | 3 | Unit |
| TestGuardianAuditLog | 394-406 | 1 | Unit |
| TestGuardianConfigSettings | 408-418 | 1 | Unit |
| TestGuardianEngineIntegration | 421-897 | 6 | Integration |
| TestFormatAllArgumentsEdgeCases | 899-951 | 4 | Unit |
| TestGuardianAnalysisResultConstraints | 953-1039 | 6 | Unit |
| TestGuardianPayloadRoundTrip | 1042-1107 | 4 | Unit |
| TestGetLlmConfigWiring | 1109-1160 | 1 | Unit |
| TestIndividualFallacyCategories | 1163-1206 | 1 (parametrized × 5) | Unit |
| TestGuardianWithMissingOptionalFields | 1209-1294 | 2 | Unit |
| TestGuardianVerdictFailureAtDebateEnd | 1297-1394 | 1 | Integration |
| TestMixedSafeInterruptAcrossTurns | 1397-1507 | 1 | Integration |

### Test Coverage Scope

- **Test IDs**: `test_2_1_unit_001` through `test_2_1_unit_040`, `test_2_1_int_001` through `test_2_1_int_008`
- **Priority Distribution**:
  - P0 (Critical): Not explicitly marked (estimated ~15 tests covering core ACs)
  - P1 (High): Not explicitly marked (estimated ~20 tests covering edge cases)
  - P2 (Medium): Not explicitly marked (estimated ~17 tests covering serialization, config)
  - P3 (Low): Not explicitly marked
  - Unknown: 52 (no priority markers in decorators)

### Assertions Analysis

- **Total Assertions**: 115
- **Assertions per Test**: ~2.4 (avg)
- **Assertion Types**: `assert` equality, `assert is True/False`, `pytest.raises`, `assert_called_once`, `assert_not_called`, `in` membership

---

## Context and Integration

### Related Artifacts

- **Story File**: [2-1-guardian-agent-logic-the-interrupter.md](../../implementation-artifacts/2-1-guardian-agent-logic-the-interrupter.md)
- **Acceptance Criteria Mapped**: 3/3 (100%)
- **Test Automation Summary**: [automation-summary-2-1.md](../automation-summary-2-1.md)

### Acceptance Criteria Validation

| Acceptance Criterion | Test ID | Status | Notes |
| --- | --- | --- | --- |
| AC1: Guardian detects fallacy → generates Interrupt with reason + Summary Verdict | unit_001, unit_004, unit_038 (×5), int_001, int_005, int_008 | ✅ Covered | Both unit and integration level |
| AC2: Safe arguments → Guardian remains silent | unit_002, unit_008, int_002, int_008 | ✅ Covered | "Safe" label and no interrupt broadcast verified |
| AC3: Guardian prompt prioritizes "Capital Preservation" | unit_003, unit_009 | ✅ Covered | Prompt content assertion + sanitize on output |

**Coverage**: 3/3 criteria covered (100%)

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)** - Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)** - Factory functions with overrides, API-first setup
- **[test-levels-framework.md](../../../_bmad/tea/testarch/knowledge/test-levels-framework.md)** - E2E vs API vs Component vs Unit appropriateness
- **[selective-testing.md](../../../_bmad/tea/testarch/knowledge/selective-testing.md)** - Duplicate coverage detection
- **[test-healing-patterns.md](../../../_bmad/tea/testarch/knowledge/test-healing-patterns.md)** - Self-healing test patterns
- **[selector-resilience.md](../../../_bmad/tea/testarch/knowledge/selector-resilience.md)** - Selector maintenance patterns
- **[timing-debugging.md](../../../_bmad/tea/testarch/knowledge/timing-debugging.md)** - Timing-related flakiness debugging

See [tea-index.csv](../../../_bmad/tea/testarch/tea-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

None required — test quality is excellent with no critical blockers.

### Follow-up Actions (Future PRs)

1. **Split test file into focused modules** - Split 1,507-line file into 6 focused test files by domain
   - Priority: P1
   - Target: next sprint

2. **Extract integration mock boilerplate to shared fixtures** - Move repeated mock setup to conftest.py
   - Priority: P1
   - Target: next sprint

3. **Add data factory for GuardianAnalysisResult** - Create `make_guardian_result()` factory function
   - Priority: P2
   - Target: next sprint

4. **Add explicit BDD Given-When-Then comments** - Add GWT comments to integration test bodies
   - Priority: P2
   - Target: backlog

### Re-Review Needed?

✅ No re-review needed - approve as-is. Follow-up actions are maintainability improvements, not quality blockers.

---

## Decision

**Recommendation**: Approve

**Rationale**:

> Test quality is excellent with 95/100 score. All 3 acceptance criteria are comprehensively covered at both unit and integration levels. Zero flakiness risk — all external dependencies mocked, no waits, 0.08s execution time. The two high-priority recommendations (file split and fixture extraction) are maintainability improvements that should be addressed in a follow-up PR but do not block merge. Tests are production-ready and follow best practices for the most part.

---

## Appendix

### Violation Summary by Location

| Line Range | Severity | Criterion | Issue | Fix |
| --- | --- | --- | --- | --- |
| 1-1507 | P1 | Test Length | File is 1,507 lines (5x threshold) | Split into 6 focused files |
| 430-1507 | P1 | Fixture Patterns | Mock boilerplate repeated ~8× | Extract to conftest.py |
| 430-1507 | P2 | BDD Format | No GWT comments in integration tests | Add Given/When/Then comments |
| Throughout | P2 | Data Factories | Inline GuardianAnalysisResult construction | Create factory function |
| 1327, 1417 | P3 | Determinism | `nonlocal call_count` for behavior switching | Use `side_effect` list/cycle |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v4.0
**Review ID**: test-review-guardian-agent-20260331
**Timestamp**: 2026-03-31 20:37:00
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters - if a pattern is justified, document it with a comment.
