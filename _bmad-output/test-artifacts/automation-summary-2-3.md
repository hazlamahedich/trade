---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
  - step-04-validate
lastStep: step-04-validate
lastSaved: '2026-04-11'
---

# Test Automation Summary — Story 2.3: Guardian UI Overlay (The Freeze)

**Execution Mode:** BMad-Integrated
**Coverage Strategy:** critical-paths
**Date:** 2026-04-11

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total New E2E Tests** | 3 |
| **P0 Tests** | 3 |
| **Tests Passing** | 3/3 (all browsers) |
| **Existing Tests Updated** | 7 (2-2 E2E suite) |
| **Test Files Created** | 1 |
| **Test Files Modified** | 2 |
| **Helper Files Modified** | 1 |
| **Unit Test Regressions** | 0 (178/178 pass) |
| **E2E Regressions** | 0 (10/10 pass on chromium) |

---

## E2E Tests Generated (3 tests)

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| 2-3-E2E-001 | Visual freeze — grayscale + overlay with correct content (verdict, reason, fallacy badge, buttons) | P0 | Passing |
| 2-3-E2E-002 | Click-outside and Escape blocking for critical (no ignore button, "debate ended" text, overlay persists) | P0 | Passing |
| 2-3-E2E-003 | Full interrupt → acknowledge → resume flow (grayscale applied, overlay visible, understand click, DEBATE_RESUMED clears overlay + grayscale, new arguments resume) | P0 | Passing |

**File:** `trade-app/nextjs-frontend/tests/e2e/guardian-ui-overlay-freeze.spec.ts` (NEW)

**Cross-browser:** All 15 tests (3 x 5 browsers: chromium, firefox, webkit, mobile-chrome, mobile-safari) pass.

---

## Existing Tests Updated (7 tests)

The Story 2.2 E2E test suite was updated to reflect the Story 2.3 UI changes:

| Change | Old Assertion | New Assertion |
|--------|---------------|---------------|
| Ring styling | `ring-violet-600` class on stream | `grayscale(60%)` CSS filter on stream |
| Paused indicator | `[data-testid="debate-paused-indicator"]` with "awaiting your acknowledgment" | GuardianOverlay modal with verdict + reason |
| Acknowledge button | `[data-testid^="ack-guardian-"]` inline button | `[data-testid="guardian-understand-btn"]` in overlay |
| Critical text | `page.getByText(/Critical risk detected/)` inline | Overlay contains "Critical risk detected — debate ended" |
| State cleared | Paused indicator disappears + ring class removed | Overlay not visible + filter === "none" |

**File:** `trade-app/nextjs-frontend/tests/e2e/guardian-pause-resume.spec.ts` (MODIFIED)

---

## Helper Enhancements

Added outgoing WebSocket message capture to the WS interceptor:

- `getSentWebSocketMessages(page)` — returns messages sent via `ws.send()`
- `clearSentWebSocketMessages(page)` — clears the sent messages buffer
- `__WS_SENT_MESSAGES__` window property added to interceptor

**File:** `trade-app/nextjs-frontend/tests/support/helpers/ws-helpers.ts` (MODIFIED)

---

## Validation Results

### Playwright E2E (chromium)

```
✓ 10 passed (18.6s)
```

### Playwright E2E (all browsers)

```
✓ 15 passed (42.7s) — guardian-ui-overlay-freeze
✓ 35 passed — all browsers combined for both suites
```

### Jest Unit Tests

```
✓ 178 passed, 26 test suites (4.2s)
```

---

## Acceptance Criteria Coverage

| AC | Description | E2E Test |
|----|-------------|----------|
| #1 | Grayscale(60%) filter applied to debate stream | 2-3-E2E-001, 2-3-E2E-003 |
| #2 | Modal overlay with warning, verdict, context, fallacy badge | 2-3-E2E-001 |
| #3 | Non-critical: "I Understand" + "Ignore Risk" + Escape | 2-3-E2E-001 |
| #4 | Critical: "I Understand" only, no Escape, no click-outside | 2-3-E2E-002 |
| #5 | Triggering argument quoted in overlay | (unit: UNIT-018) |
| #6 | Second interrupt replaces overlay content | (unit: UNIT-021) |
| #7 | Error state with Retry | (unit: UNIT-019, UNIT-020) |
| #8 | Reduced motion suppresses animations | (unit: UNIT-011, UNIT-012) |
| #9 | Mobile: stacked buttons, 44px touch targets | (unit: UNIT-026) |

---

## Files Changed

**NEW:**
- `trade-app/nextjs-frontend/tests/e2e/guardian-ui-overlay-freeze.spec.ts`

**MODIFIED:**
- `trade-app/nextjs-frontend/tests/e2e/guardian-pause-resume.spec.ts` (updated for Story 2.3 UI)
- `trade-app/nextjs-frontend/tests/support/helpers/ws-helpers.ts` (added outgoing message capture)
