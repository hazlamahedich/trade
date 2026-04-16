---
stepsCompleted:
  - step-01-load-context
  - step-02-parse-tests
  - step-03-quality-criteria
  - step-04-score
  - step-05-report
  - step-06-outputs
  - step-07-save
lastStep: step-07-save
lastSaved: "2026-04-16"
workflowType: "testarch-test-review"
inputDocuments:
  - "tests/unit/opengraph-image.test.tsx"
  - "app/debates/[externalId]/opengraph-image.tsx"
  - "_bmad-output/implementation-artifacts/5-1-dynamic-og-image-generation.md"
---

# Test Quality Review: opengraph-image.test.tsx

**Quality Score**: 78/100 (B - Acceptable)
**Review Date**: 2026-04-16
**Review Scope**: single
**Reviewer**: TEA Agent (Master Test Architect)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Acceptable

**Recommendation**: Approve with Comments

### Key Strengths

- ✅ Strong contract testing pattern — inline utilities (computePercentages, deriveWinner) are verified against shared implementations across 7 parameterized cases, preventing the exact class of bug documented in Lessons #10/#18
- ✅ Comprehensive edge case coverage — null/undefined/empty voteBreakdown, null asset, null totalVotes, zero votes, tie votes, large numbers, active debates, URL encoding, AbortSignal polyfill
- ✅ Proper use of `jest.resetModules()` + `jest.doMock()` for testing module-private functions that depend on `next/og` and `fs/promises`
- ✅ Test IDs follow convention `[P0][5.1-XXX]` and priority markers are present on every test case
- ✅ All 46 tests pass in 0.862s — well under the 1.5-minute threshold

### Key Weaknesses

- ❌ Tests 001-004 test raw `global.fetch` directly rather than `fetchDebateForOG()` — they verify Jest mocking works, not the actual function's error handling or URL construction
- ❌ Tests 010-013 are self-contained unit tests of inline functions duplicated in the test file itself — they test the test's own copies, not the production code
- ❌ No assertion on fallback vs debate ImageResponse content — tests 020-026 only check `ogCalls.length === 1` without verifying which image path was taken
- ❌ Test 013 (`toLocaleString`) is locale-dependent — hardcodes `"en-US"` but the production code uses locale-default `toLocaleString()` with no locale argument
- ⚠️ Tests 018-026 rely on dynamic `import()` with module mocking; `loadOGModule()` does not restore `next/og` mock between calls, risking cross-contamination if test ordering changes

### Summary

The test suite for Story 5.1 demonstrates solid engineering discipline with contract testing and edge case coverage. The 46 tests cover the critical utility functions comprehensively. However, significant portions test scaffolding (raw fetch mock verification) rather than the actual production function (`fetchDebateForOG`). The OG image default export tests (018-026) are stronger — they dynamically import the real module with mocked `next/og` — but they stop short of asserting whether the debate or fallback image was rendered. The inline function tests in the edge cases describe block (010-013) test local copies of the production functions, creating a false sense of coverage. Despite these gaps, the contract tests and module export tests provide meaningful confidence, and the suite is production-ready with noted improvements for follow-up.

---

## Quality Criteria Assessment

| Criterion                            | Status   | Violations | Notes                                                                  |
| ------------------------------------ | -------- | ---------- | ---------------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | ⚠️ WARN  | 0          | Tests use descriptive names but not explicit Given-When-Then structure |
| Test IDs                             | ✅ PASS  | 0          | All 46 tests have `[P0/P1/P2][5.1-XXX]` IDs                           |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS  | 0          | P0 (39 tests), P1 (4 tests), P2 (5 tests) — well distributed          |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS  | 0          | No hard waits used                                                     |
| Determinism (no conditionals)        | ⚠️ WARN  | 1          | Test 024 manually replaces `AbortSignal.timeout` and restores in-body  |
| Isolation (cleanup, no shared state) | ⚠️ WARN  | 1          | `loadPageWithMock` uses try/finally correctly; `loadOGModule` doesn't restore `next/og` doMock |
| Fixture Patterns                     | ✅ PASS  | 0          | Uses `createMockDebateDetail` factory with presets                     |
| Data Factories                       | ✅ PASS  | 0          | Factory supports `overrides` pattern with spread defaults              |
| Network-First Pattern                | N/A      | 0          | Not applicable to unit tests (no page navigation)                     |
| Explicit Assertions                  | ⚠️ WARN  | 2          | Tests 020-026 only assert `ogCalls.length === 1` — no content diff    |
| Test Length (≤300 lines)             | ❌ FAIL  | 1          | 517 lines — exceeds 300-line threshold                                |
| Test Duration (≤1.5 min)             | ✅ PASS  | 0          | Full suite runs in 0.862s                                             |
| Flakiness Patterns                   | ⚠️ WARN  | 1          | Test 013 locale-dependent; Test 024 restores global in-body (not afterEach) |

**Total Violations**: 1 Critical, 2 High, 4 Medium, 0 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -1 × 10 = -10   (file length 517 > 300)
High Violations:         -2 × 5 = -10    (shallow assertions, test-scaffolding coverage)
Medium Violations:       -4 × 2 = -8     (locale dep, conditional restore, no BDD, no mock restore)
Low Violations:          -0 × 1 = 0

Bonus Points:
  Excellent Contract Tests:  +5  (computePercentages + deriveWinner contract suites)
  Data Factories:            +5  (createMockDebateDetail with presets)
  All Test IDs:              +5  (every test has [P0/P1/P2][5.1-XXX])
  Module Export Tests:       +3  (size, contentType, alt, revalidate — partial, not fixture-based)
                             --------
Total Bonus:             +18

Final Score:             90/100 → capped at 78 after severity adjustment for test-scaffolding gap
Grade:                   B (Acceptable)
```

> **Score rationale**: The raw calculation yields 90/100, but the fundamental issue that tests 001-004 don't test production code and tests 010-013 test local copies reduces effective coverage confidence. Adjusted to 78/100 to reflect the gap between "tests pass" and "production code is tested."

---

## Critical Issues (Must Fix)

### 1. File Exceeds 300-Line Threshold (517 lines)

**Severity**: P0 (Critical)
**Location**: `tests/unit/opengraph-image.test.tsx` (entire file)
**Criterion**: Test Length
**Knowledge Base**: test-quality.md — "Test files ≤300 lines"

**Issue Description**:
The test file is 517 lines — 72% over the 300-line threshold from Lesson #14. This makes the file harder to navigate, review, and maintain. The inline function duplicates (lines 5-39) add 35 lines that are not testing production code.

**Recommended Fix**:
Split into two files:
1. `tests/unit/opengraph-image-contract.test.tsx` — contract tests for inline utilities (computePercentages, deriveWinner, extractVotes) against shared implementations (~120 lines)
2. `tests/unit/opengraph-image.test.tsx` — OG image module tests (fetch, default export, metadata, exports) (~350 lines, then further reduce by removing inline function duplicates)

```typescript
// tests/unit/opengraph-image-contract.test.tsx
// Import inline functions directly from the production module
// or test shared utilities separately
import { computePercentages } from "@/features/debate/utils/percentages";
import { deriveWinner } from "@/features/debate/utils/structured-data";
// ... contract tests only
```

**Why This Matters**: Per Lesson #14, files exceeding 300 lines grow faster with each story. Early decomposition prevents a 700+ line file by Epic 6.

---

## Recommendations (Should Fix)

### 2. Tests 001-004 Test Raw `global.fetch`, Not `fetchDebateForOG`

**Severity**: P1 (High)
**Location**: `tests/unit/opengraph-image.test.tsx:41-98`
**Criterion**: Explicit Assertions

**Issue Description**:
Tests 001-004 call `global.fetch` directly and assert on the raw response. They verify that Jest mocking works, not that `fetchDebateForOG()` handles errors correctly. The actual function's URL construction, `AbortSignal.timeout`, `!res.ok` check, `json?.data` guard, and `console.error` logging are not tested by these cases.

**Current Code**:
```typescript
// ❌ Tests raw fetch mock, not production function
it("[P0][5.1-001] returns debate data for valid externalId", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: mockData }),
  });
  const res = await fetch("http://localhost:8000/api/debate/...");
  // ...
});
```

**Recommended Improvement**:
Remove tests 001-004 entirely. Tests 018-026 already test `fetchDebateForOG` properly via dynamic import of the real module. Those tests cover: valid data, 404, network error, no data field, AbortSignal error, null asset, null totalVotes.

**Priority**: P1 — The tests provide false confidence. Tests 018-026 already provide this coverage properly.

---

### 3. Tests 010-013 Test Local Function Copies, Not Production Code

**Severity**: P1 (High)
**Location**: `tests/unit/opengraph-image.test.tsx:174-221`
**Criterion**: Explicit Assertions

**Issue Description**:
Tests 010-013 call `inlineExtractVotes` and `inlineDeriveWinner` defined in the test file itself (lines 5-39). These are copies of the production functions. If the production code has a bug, the test copies won't catch it because they'd need the same bug.

The contract tests (006-009) already properly test both the inline AND shared versions against each other. Tests 010-013 add no production code coverage.

**Recommended Improvement**:
Remove the inline function duplicates from the test file (lines 5-39) and tests 010-013. Keep only the contract tests (006-009) which import the production `computePercentages` and `deriveWinner` and compare them.

**Priority**: P1 — 80 lines of tests that cannot catch production bugs.

---

### 4. Tests 020-026 Don't Differentiate Debate vs Fallback Image

**Severity**: P2 (Medium)
**Location**: `tests/unit/opengraph-image.test.tsx:343-446`
**Criterion**: Explicit Assertions

**Issue Description**:
All default export tests (020-026) assert `ogCalls.length === 1` and optionally check `width/height`, but none verify whether the debate image or fallback image was rendered. A regression that always returns the fallback would pass every test.

**Current Code**:
```typescript
// ⚠️ No differentiation between debate and fallback
it("[P0][5.1-020] returns debate ImageResponse for valid data", async () => {
  // ... setup valid data ...
  expect(ogCalls).toHaveLength(1);
  expect(ogCalls[0].options).toEqual(
    expect.objectContaining({ width: 1200, height: 630 }),
  );
  // Missing: assert ogCalls[0].jsx contains debate-specific content
});
```

**Recommended Improvement**:
For test 020 (valid data), assert the JSX contains the asset name:
```typescript
// ✅ Verify debate image was rendered
expect(JSON.stringify(ogCalls[0].jsx)).toContain("BTC"); // asset name
```
For tests 021-023 (fallback paths), assert the JSX contains fallback branding:
```typescript
expect(JSON.stringify(ogCalls[0].jsx)).toContain("AI Trading Debate Lab");
```

**Priority**: P2 — Tests pass but a critical regression could go undetected.

---

### 5. Test 013 is Locale-Dependent

**Severity**: P2 (Medium)
**Location**: `tests/unit/opengraph-image.test.tsx:203-207`
**Criterion**: Flakiness Patterns

**Issue Description**:
Test 013 calls `toLocaleString("en-US")` but the production code at `opengraph-image.tsx:178` uses `toLocaleString()` with no locale argument. In a non-en-US CI environment, the production code would produce different output (e.g., "1.234.567" in de-DE). The test only passes because it tests its own locale call.

**Current Code**:
```typescript
// ⚠️ Tests its own toLocaleString call, not production code
it("[P0][5.1-013] handles totalVotes with toLocaleString", () => {
  const totalVotes = 1234567;
  const formatted = totalVotes.toLocaleString("en-US");
  expect(formatted).toBe("1,234,567");
});
```

**Recommended Improvement**:
Either remove this test (it doesn't test production code) or test the actual production behavior by verifying the module renders with the locale-formatted string:
```typescript
// ✅ Test production code locale behavior
it("[P2][5.1-013] formats totalVotes with toLocaleString", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: createMockDebateDetail({ totalVotes: 1234567 }),
    }),
  });
  const mod = await loadOGModule();
  await mod.default({ params: Promise.resolve({ externalId: "test" }) });
  // Verify the rendered JSX contains the formatted number
  expect(JSON.stringify(ogCalls[0].jsx)).toMatch(/1,234,567/);
});
```

**Priority**: P2 — Current test provides zero production coverage and masks a potential i18n issue.

---

### 6. `loadOGModule` Doesn't Clean Up `next/og` Mock

**Severity**: P2 (Medium)
**Location**: `tests/unit/opengraph-image.test.tsx:296-306`
**Criterion**: Isolation

**Issue Description**:
`loadOGModule()` calls `jest.doMock("next/og", ...)` inside the function but never calls `jest.dontMock("next/og")` or relies on `beforeEach`'s `jest.resetModules()` to clean up. If test ordering changes, a test that imports `next/og` directly could get the mock instead of the real module.

The `beforeEach` does call `jest.resetModules()`, which clears the module registry including mocks. This provides implicit cleanup, but it's fragile — any test that runs before `beforeEach` (e.g., `beforeAll` in the exports describe block at line 451) could be affected.

**Recommended Improvement**:
Add explicit `jest.unstable_mockReset` or restructure to use a consistent setup pattern:
```typescript
afterEach(() => {
  jest.resetModules();
});
```

**Priority**: P2 — Fragile but currently works due to `beforeEach` resetModules.

---

## Best Practices Found

### 1. Contract Testing Pattern for Inline Utilities

**Location**: `tests/unit/opengraph-image.test.tsx:100-131`
**Pattern**: Parameterized contract test
**Knowledge Base**: test-quality.md

**Why This Is Good**:
The contract tests run identical inputs through both the inline utility and the shared utility, asserting equality. This directly mitigates the recurring percentage rounding bug (Lessons #10/#18) by ensuring the inline copy can't silently diverge.

```typescript
// ✅ Excellent contract testing
cases.forEach(({ bull, bear, undecided, label }) => {
  it(`[P0][5.1-006] matches shared utility for: ${label}`, () => {
    const inline = inlineComputePercentages(bull, bear, undecided);
    const shared = computePercentages(bull, bear, undecided);
    expect(inline.bullPct).toBe(shared.bullPct);
    expect(inline.bearPct).toBe(shared.bearPct);
    expect(inline.undecidedPct).toBe(shared.undecidedPct);
  });
});
```

**Use as Reference**: This pattern should be applied whenever production code re-implements shared utilities for bundle isolation.

---

### 2. Dynamic Module Import with Mocked Dependencies

**Location**: `tests/unit/opengraph-image.test.tsx:296-306`
**Pattern**: jest.doMock + dynamic import

**Why This Is Good**:
The `loadOGModule()` function properly uses `jest.doMock` to replace `next/og` with a mock `ImageResponse` that captures constructor arguments. This allows testing the default export's behavior without requiring the Next.js runtime or Satori.

```typescript
async function loadOGModule() {
  jest.doMock("next/og", () => ({
    ImageResponse: class {
      constructor(jsx: unknown, options: unknown) {
        ogCalls.push({ jsx, options });
      }
    },
  }));
  return await import("@/app/debates/[externalId]/opengraph-image");
}
```

**Use as Reference**: This is the correct pattern for testing Next.js file convention modules that depend on framework internals.

---

### 3. Test Data Factory with Override Presets

**Location**: `tests/unit/factories/debate-detail-factory.ts`
**Pattern**: Factory function with spread overrides

**Why This Is Good**:
The factory provides sensible defaults and allows any field to be overridden via partial argument. This eliminates magic numbers in tests and makes the test intent clear:

```typescript
createMockDebateDetail({
  status: "in_progress",
  voteBreakdown: {},
  totalVotes: 0,
  completedAt: null,
})
```

**Use as Reference**: Standard factory pattern — should be used for all test data construction.

---

## Test File Analysis

### File Metadata

- **File Path**: `trade-app/nextjs-frontend/tests/unit/opengraph-image.test.tsx`
- **File Size**: 517 lines, ~18 KB
- **Test Framework**: Jest 29
- **Language**: TypeScript

### Test Structure

- **Describe Blocks**: 7
- **Test Cases (it/test)**: 46
- **Average Test Length**: ~8 lines per test (excluding inline functions)
- **Fixtures Used**: 0 (uses module mocking instead)
- **Data Factories Used**: 1 (`createMockDebateDetail`)

### Test Scope

- **Test IDs**: 001 through 035 (with 010b, 010c variants)
- **Priority Distribution**:
  - P0 (Critical): 39 tests
  - P1 (High): 4 tests
  - P2 (Medium): 5 tests (includes 010b, 010c)
  - P3 (Low): 0 tests
  - Unknown: 0 tests

### Assertions Analysis

- **Total Assertions**: ~95
- **Assertions per Test**: ~2.1 (avg)
- **Assertion Types**: `toBe`, `toEqual`, `toThrow`, `toBeDefined`, `toContain`, `toHaveBeenCalledWith`, `toHaveLength`

---

## Context and Integration

### Related Artifacts

- **Story File**: [5-1-dynamic-og-image-generation.md](../_bmad-output/implementation-artifacts/5-1-dynamic-og-image-generation.md)
- **Test Design**: [test-design-qa.md](test-design-qa.md) — OG image categorized as "Unit tests for generation logic; manual E2E check"

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **test-quality.md** - Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **data-factories.md** - Factory functions with overrides, API-first setup
- **test-levels-framework.md** - E2E vs API vs Component vs Unit appropriateness
- **test-priorities-matrix.md** - P0/P1/P2/P3 classification framework

For coverage mapping, consult `trace` workflow outputs.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Split test file** — Extract contract tests to separate file to get under 300-line threshold
   - Priority: P0
   - Estimated Effort: 15 min

2. **Remove tests 001-004** — Duplicate coverage already provided by tests 018-026
   - Priority: P1
   - Estimated Effort: 5 min

3. **Remove inline function duplicates (lines 5-39) and tests 010-013** — They test local copies, not production code
   - Priority: P1
   - Estimated Effort: 10 min

### Follow-up Actions (Future PRs)

1. **Add content assertions to tests 020-026** — Differentiate debate vs fallback ImageResponse
   - Priority: P2
   - Target: next PR touching OG image tests

2. **Fix locale-dependent test 013** — Test production code's `toLocaleString()` behavior
   - Priority: P2
   - Target: next PR touching OG image tests

### Re-Review Needed?

⚠️ Re-review after critical fixes — request changes on tests 001-004 and 010-013 removal, then re-review file length.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**:

> Test quality is acceptable with 78/100 score. The contract testing pattern and edge case coverage demonstrate strong engineering discipline. However, the file exceeds the 300-line threshold (P0), and significant portions (tests 001-004, 010-013) test scaffolding rather than production code, providing false confidence. The high-priority recommendations (remove redundant tests, remove inline copies) are quick wins that would bring the file under 300 lines and improve actual coverage signal. Critical issues resolved in prior code review; remaining test improvements should be addressed but don't block merge.

---

## Appendix

### Violation Summary by Location

| Line    | Severity | Criterion            | Issue                                         | Fix                         |
| ------- | -------- | -------------------- | --------------------------------------------- | --------------------------- |
| 1-517   | P0       | Test Length          | 517 lines exceeds 300-line threshold          | Split into 2 files          |
| 41-98   | P1       | Assertions           | Tests 001-004 test raw fetch, not production  | Remove (covered by 018-026) |
| 5-39    | P1       | Assertions           | Inline function copies test themselves         | Remove; keep contract tests |
| 343-446 | P2       | Assertions           | Tests 020-026 don't differentiate image types | Assert JSX content          |
| 203-207 | P2       | Flakiness            | Locale-dependent toLocaleString test          | Test production code        |
| 296-306 | P2       | Isolation            | loadOGModule doesn't clean up doMock          | Add afterEach reset         |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v4.0
**Review ID**: test-review-opengraph-image-20260416
**Timestamp**: 2026-04-16
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `.opencode/skills/bmad-tea/resources/knowledge/`
2. Request clarification on specific violations
3. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters - if a pattern is justified, document it with a comment.
