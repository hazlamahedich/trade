---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
  - step-04-validate-and-summarize
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-03-30'
---

# Test Automation Summary: Story 1-6 - Stale Data Guard

**Date:** 2026-03-30
**Author:** team mantis a
**Story:** 1-6-stale-data-guard
**Focus:** Stale market data detection (>60s) blocking debate start and pausing active debates

---

## Executive Summary

**Scope:** Test automation for Story 1-6 (Stale Data Guard) within Epic 1 - Live Market Reasoning

**Framework Verified:**
- Playwright config: `trade-app/nextjs-frontend/playwright.config.ts` ✅
- Test dependencies: `@playwright/test`, `@testing-library/react`, `@faker-js/faker` ✅
- Test structure: `tests/e2e/`, `tests/api/`, `tests/unit/` ✅

**Execution Mode:** BMad-Integrated (using story artifacts and test-design patterns)

**Coverage Summary:**

| Priority | E2E Scenarios | API Scenarios | Total New |
|----------|---------------|---------------|-----------|
| P0 | 2 | 5 | 7 |
| P1 | 3 | 3 | 6 |
| P2 | 2 | 2 | 4 |
| **Total** | **7** | **10** | **17** |

**Total Effort:** ~2-3 hours

---

## Step 1: Preflight & Context

### Framework Verification ✅

- Playwright config exists at `trade-app/nextjs-frontend/playwright.config.ts`
- Multi-browser projects: chromium, firefox, webkit, mobile-chrome, mobile-safari
- All test dependencies installed in package.json

### Mode Determined

**BMad-Integrated Mode** - Using:
- Story artifact: `_bmad-output/implementation-artifacts/1-6-stale-data-guard.md`
- Epic document: `_bmad-output/planning-artifacts/epics.md`
- Test design: `_bmad-output/test-artifacts/test-design-epic-1.md`

### Knowledge Fragments Loaded

**Core:**
- `test-levels-framework.md` - Test level selection (E2E vs API vs Unit)
- `test-priorities-matrix.md` - P0-P3 prioritization
- `data-factories.md` - Factory patterns for test data
- `selective-testing.md` - Tag-based execution
- `ci-burn-in.md` - CI optimization strategies
- `test-quality.md` - Quality gate criteria
- `fixture-architecture.md` - Fixture composition patterns
- `overview.md` - Playwright Utils overview

---

## Step 2: Automation Targets

### Acceptance Criteria → Test Scenarios

| AC | Requirement | Test Level | Priority | Gap Status |
|----|-------------|------------|----------|------------|
| 1 | Stale data (>60s) blocks new debate start with 400 STALE_DATA | API | P0 | ⚠️ Partial (existing in debate-api.spec.ts as 1-3-API-006) |
| 1 | Stale block works across all valid assets | API | P0 | ⚠️ Gap |
| 2 | Active debate pauses with visible "Data Stale" warning modal | E2E | P0 | ❌ Missing |
| 2 | Debate stream applies grayscale CSS when stale | E2E | P0 | ❌ Missing |
| 2 | DATA_REFRESHED WebSocket action restores normal state | E2E | P1 | ❌ Missing |
| 2 | Acknowledge button dismisses stale warning | E2E | P1 | ❌ Missing |
| 2 | Focus trap on stale warning modal | E2E | P1 | ❌ Missing |
| - | Freshness endpoint GET /api/debate/{asset}/freshness | API | P0 | ❌ Missing |
| - | Stale error envelope matches standard format | API | P1 | ❌ Missing |
| - | ARIA dialog attributes on stale warning | E2E | P2 | ❌ Missing |
| - | Auto-focus on acknowledge button | E2E | P2 | ❌ Missing |

### Existing Coverage Analysis

**Existing tests that partially cover Story 1-6:**

1. `tests/unit/StaleDataWarning.test.tsx` (5 tests):
   - Component rendering, visibility, acknowledge callback, ARIA attributes, description text

2. `tests/unit/useDebateSocketStale.test.ts` (2 tests):
   - DATA_STALE and DATA_REFRESHED action handling in hook

3. `tests/api/debate-api.spec.ts` (1-3-API-006):
   - Single P1 test for stale block on POST /api/debate/start

4. Backend pytest tests:
   - `test_stale_data_guardian.py` (8 tests) - is_data_stale, check_data_freshness, get_freshness_status
   - `test_engine_stale.py` (2 tests) - blocks on stale, proceeds with fresh
   - `test_engine_edge_cases.py` (5 tests) - monitor_freshness, cancellation, no-data
   - `test_data_stale_ws.py` (3 tests) - WS action format

**Gap Analysis:**
- No E2E tests for stale warning modal in live UI
- No E2E tests for grayscale freeze state
- No API tests for freshness endpoint
- No E2E accessibility tests for stale warning dialog

---

## Step 3: Generated Tests

### E2E Test File: `tests/e2e/stale-data-guard.spec.ts`

**Created:** 2026-03-30
**Total Tests:** 7
**Priority Coverage:** P0: 2, P1: 3, P2: 2

**Test Cases:**

| ID | Test Name | Priority | AC Link |
|----|-----------|----------|---------|
| 1-6-E2E-001 | Stale data warning modal appears when DATA_STALE received during active debate | P0 | AC2 |
| 1-6-E2E-002 | Debate stream shows grayscale freeze state when data is stale | P0 | AC2 |
| 1-6-E2E-003 | DATA_REFRESHED WebSocket action removes stale state and restores normal stream | P1 | AC2 |
| 1-6-E2E-004 | Acknowledge button dismisses stale data warning and restores stream | P1 | AC2 |
| 1-6-E2E-005 | Focus trap confines Tab key to acknowledge button within modal | P1 | AC2 |
| 1-6-E2E-006 | Stale data warning renders with correct ARIA dialog attributes in page context | P2 | - |
| 1-6-E2E-007 | Acknowledge button receives auto-focus when stale warning appears | P2 | - |

### API Test File: `tests/api/stale-data-api.spec.ts`

**Created:** 2026-03-30
**Total Tests:** 10
**Priority Coverage:** P0: 5, P1: 3, P2: 2

**Test Cases:**

| ID | Test Name | Priority | AC Link |
|----|-----------|----------|---------|
| 1-6-API-001 | POST /api/debate/start returns 400 when market data is stale | P0 | AC1 |
| 1-6-API-002 | POST /api/debate/start returns 400 for {asset} when data is stale (parameterized × 3) | P0 | AC1 |
| 1-6-API-003 | GET /api/debate/{asset}/freshness returns freshness status when data is fresh | P0 | - |
| 1-6-API-004 | POST /api/debate/start with invalid asset returns 422 | P0 | AC1 |
| 1-6-API-005 | GET freshness returns stale status when data is >60s old | P1 | - |
| 1-6-API-006 | GET freshness returns fresh status when data is <60s threshold | P1 | - |
| 1-6-API-007 | Stale error response format matches debate-api error pattern | P1 | - |
| 1-6-API-008 | Freshness response for invalid asset returns 400 | P1 | - |
| 1-6-API-009 | Freshness endpoint returns valid response for {asset} (parameterized × 3) | P2 | - |
| 1-6-API-010 | Freshness response latency is reasonable | P2 | - |

---

## Step 4: Validation & Summary

### Test Files Generated

```
tests/
├── e2e/
│   └── stale-data-guard.spec.ts     # NEW: 7 E2E tests (P0×2, P1×3, P2×2)
├── api/
│   └── stale-data-api.spec.ts       # NEW: 10 API tests (P0×5, P1×3, P2×2)
└── unit/
    ├── StaleDataWarning.test.tsx     # EXISTING: 5 unit tests
    └── useDebateSocketStale.test.ts  # EXISTING: 2 unit tests
```

### Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript compilation | ✅ | Zero errors in generated files (pre-existing errors in DebateStream.tsx, websocket-streaming.spec.ts) |
| ESLint | ✅ | Zero errors in generated files (pre-existing: unused var in debate-api.spec.ts) |
| Playwright test listing | ✅ | All 105 test instances discovered (17 unique × 5 browser projects) |
| `@faker-js/faker` usage | ✅ | Used in E2E file for debateId, asset, ageSeconds |
| `data-testid` selectors | ✅ | All selectors use `data-testid` (stale-data-warning, stale-acknowledge-btn, debate-stream) |
| No `waitForTimeout()` | ✅ | All waits use `expect` with timeout or `waitForFunction` |
| No hardcoded data | ✅ | All test data generated via faker or parameterized |
| Given-When-Then format | ✅ | All tests include structured comments |
| Priority tags | ✅ | All tests tagged with `@p0`, `@p1`, `@p2` in test name |
| Network-first pattern | ✅ | Route interception set before navigation in E2E helper |

### Quality Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| All P0 tests generated | ✅ | 2 P0 E2E + 5 P0 API = 7 critical path tests |
| All P1 tests generated | ✅ | 3 P1 E2E + 3 P1 API = 6 important tests |
| Knowledge fragments applied | ✅ | Network-first, selector-resilience, fixture-architecture, data-factories |
| TypeScript strict mode | ✅ | All tests properly typed |
| Accessibility coverage | ✅ | ARIA dialog, focus trap, auto-focus tests included |
| Duplicate coverage guard | ✅ | Unit tests handle component internals; E2E tests handle user journey |

### Execution Commands

```bash
# Run Story 1-6 E2E tests (all browsers)
npx playwright test tests/e2e/stale-data-guard.spec.ts

# Run Story 1-6 API tests
npx playwright test tests/api/stale-data-api.spec.ts

# Run both Story 1-6 test files
npx playwright test tests/e2e/stale-data-guard.spec.ts tests/api/stale-data-api.spec.ts

# Run P0 only (smoke)
npx playwright test --grep "@p0" tests/e2e/stale-data-guard.spec.ts tests/api/stale-data-api.spec.ts

# Run single browser
npx playwright test tests/e2e/stale-data-guard.spec.ts --project=chromium

# Run unit tests (existing)
npm run test -- tests/unit/StaleDataWarning.test.tsx tests/unit/useDebateSocketStale.test.ts
```

### Estimated Execution Time

| Test Level | Count | Time/Test | Total |
|------------|-------|-----------|-------|
| E2E | 7 | ~3-5s | ~30-45s |
| API | 10 | ~1-2s | ~15-20s |
| Unit (existing) | 7 | ~0.1s | ~1s |

### Key Assumptions & Risks

**Assumptions:**
1. The freshness endpoint `GET /api/debate/{asset}/freshness` exists and returns the documented envelope
2. The mock header `X-Mock-Stale-Data: true` triggers stale behavior (same pattern as existing debate-api.spec.ts)
3. The StaleDataWarning component uses `data-testid="stale-data-warning"` and `data-testid="stale-acknowledge-btn"`
4. The DebateStream applies a `grayscale` CSS class when stale
5. The WebSocket mock in E2E tests correctly simulates `DEBATE/DATA_STALE` and `DEBATE/DATA_REFRESHED`

**Risks:**
1. API tests for the freshness endpoint may need URL adjustment if the route differs from `/api/debate/{asset}/freshness`
2. E2E tests depend on actual page routing (`/debates/{debateId}`) — may need adjustment if routes differ
3. The parameterized API-002/API-009 tests expand to 3 test cases each (one per asset), increasing total count
4. Mobile browser E2E tests may need viewport-specific adjustments for modal rendering

### Next Steps

1. **Run generated tests** against running frontend + backend to verify selectors and assertions
2. **Validate freshness endpoint** exists in FastAPI router at expected path
3. **Run `test-review` workflow** for peer review of generated tests
4. **Sync with Beads** to mark story as tests-generated

---

## References

- Story: `_bmad-output/implementation-artifacts/1-6-stale-data-guard.md`
- Epic: `_bmad-output/planning-artifacts/epics.md` (Story 1.6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Test Design: `_bmad-output/test-artifacts/test-design-epic-1.md`
- Source: `features/debate/components/StaleDataWarning.tsx`
- Source: `features/debate/components/DebateStream.tsx`
- Source: `features/debate/hooks/useDebateSocket.ts`
- Backend: `fastapi_backend/app/services/market/stale_data_guardian.py`

---

**Generated by:** BMad TEA Agent - Test Architect Module
**Workflow:** `_bmad/tea/testarch/automate`
**Version:** 5.0 (BMad v6)
