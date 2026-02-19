---
stepsCompleted: []
lastStep: ''
lastSaved: ''
---

# Test Design for QA: AI Trading Debate Lab (System-Level)

**Purpose:** Test execution recipe for QA team. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-02-18
**Author:** BMad TEA Agent
**Status:** Draft
**Project:** trade

**Related:** See Architecture doc (`test-design-architecture.md`) for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** Testing the full "Live Debate" lifecycle: Data Ingestion -> Agent Debate -> Guardian Safety -> WebSocket Stream -> Frontend UI -> Voting -> Archival.

**Risk Summary:**

- Total Risks: 5 (4 high-priority score ≥6, 1 medium, 0 low)
- Critical Categories: SEC (Hallucination), PERF (WebSocket Scale), BUS (Cost)

**Coverage Summary:**

- P0 tests: ~4 (Core Flow + Critical Safety)
- P1 tests: ~3 (Resilience + UX Critical)
- P2 tests: ~2 (Retention + Perf Goals)
- **Total**: ~9 Scenarios (~60-85 hours with 1 QA)

---

## Not in Scope

**Components or systems explicitly excluded from this test plan:**

| Item | Reasoning | Mitigation |
|---|---|---|
| **Admin Dashboard UI** | Internal-only tool (Epic 6), lower risk than public facing debate. | Manual validation by internal users. |
| **Social Sharing (OG Images)** | Third-party dependency (Satori/Edge), difficult to test E2E. | Unit tests for generation logic; manual E2E check. |

**Note:** Items listed here have been reviewed and accepted as out-of-scope by QA, Dev, and PM.

---

## Dependencies & Test Blockers

**CRITICAL:** QA cannot proceed without these items from other teams.

### Backend/Architecture Dependencies (Sprint 0)

**Source:** See Architecture doc "Quick Guide" for detailed mitigation plans

1. **Mock Market Service** - Backend - Sprint 0
   - Need DI interface to inject `static_price` and `static_timestamp`.
   - Blocks all P0 tests (Debate Flow depends on data).

2. **Time Provider Interface** - Backend - Sprint 0
   - Need ability to "Advance Time" by 60s.
   - Blocks P1 Stale Data tests.

### QA Infrastructure Setup (Sprint 0)

1. **Test Data Factories** - QA
   - `UserFactory` (via Clerk/NextAuth mock or backend bypass)
   - `DebateFactory` (seed DB with past debates)

2. **Test Environments** - DevOps
   - CI/CD: GitHub Actions with `act` local runner compatibility.
   - Staging: Railway environment mirroring prod config.

---

## Risk Assessment

**Note:** Full risk details in Architecture doc. This section summarizes risks relevant to QA test planning.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Score | QA Test Coverage |
|---|---|---|---|---|
| **R-01** | SEC / BUS | **AI Hallucination:** Agents give bad advice. | **6** | Adversarial E2E tests (inject "guaranteed" prompts). |
| **R-02** | PERF / OPS | **WebSocket Saturation:** 50k users crash backend. | **6** | k6 Load Test (Nightly). |
| **R-04** | TECH | **E2E Flakiness:** WS tests fail randomly. | **6** | Network interception pattern (assert on WS frames, not just UI). |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
|---|---|---|---|---|
| R-05 | DATA | **Stale Data Trading:** Users act on old prices. | 3 | Integration test with `MockTimeProvider` (+61s). |

---

## Entry Criteria

**QA testing cannot begin until ALL of the following are met:**

- [ ] Mock Market Service implemented and deployable
- [ ] Test environment available on Railway (Staging)
- [ ] Requirements for "Guardian" logic finalized (regex list)

## Exit Criteria

**Testing phase is complete when ALL of the following are met:**

- [ ] 100% P0 tests passing
- [ ] 95% P1 tests passing
- [ ] No OPEN High-Priority Risks (Score 6) without waiver
- [ ] Load Test: Sustains 10k users nominal load

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level**, NOT execution timing.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (≥6) + No workaround + Affects majority of users

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| **P0-001** | **Guardian Interruption:** Inject "Forbidden Phrase" -> Verify WebSocket stream Redaction (Story 2.4). | Unit / Int | **R-01** | Critical for regulatory compliance. |
| **P0-002** | **Live Debate Flow:** Connect WS -> Receive "active" stream -> Verify UI updates (Story 1.5). | E2E | - | MVP Core Value. |
| **P0-003** | **Vote Limiting:** 2 votes from same IP -> Expect 429 Error (Story 3.1). | Integration | - | Spam prevention. |
| **P0-004** | **Market Data Connection:** Data Fetch -> Cache (Redis) -> API Response (Story 1.2). | Integration | - | Foundation dependency. |

**Total P0:** ~4 tests

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows + Workaround exists but difficult

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| **P1-001** | **Stale Data Pause:** Inject Timestamp > 60s ago -> Verify Debate Paused (Story 1.6). | Integration | **R-05** | Requires TimeProvider. |
| **P1-002** | **Guardian UI Freeze:** Send "Interrupt" event -> Verify UI Overlay appears (Story 2.3). | E2E | - | UX Critical Safety. |
| **P1-003** | **Reconnection:** Disconnect WebSocket -> Reconnect -> Verify state recovery (Story 1.4). | E2E | **R-04** | Network resilience. |

**Total P1:** ~3 tests

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases + Regression prevention

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| **P2-001** | **Debate Archival:** End debate -> Verify DB record exists (Story 4.1). | Integration | - | Data retention. |
| **P2-002** | **Landing Page Perf:** Visit `/` -> Verify LCP < 1.2s (NFR-02). | E2E | - | SEO/Conversion. |

**Total P2:** ~2 tests

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless there's significant infrastructure overhead.

**Organized by TOOL TYPE:**

### Every PR: Playwright Tests (~10-15 min)

**All functional tests** (from any priority level):

- All P0, P1, P2 functional tests using Playwright
- Parallelized across 3 shards
- Total: ~9 Playwright tests

**Why run in PRs:** Fast feedback, prevents regression of safety features.

### Nightly: k6 Performance Tests (~30-60 min)

**All performance tests** (from any priority level):

- Load Test (R-02): 10k -> 50k Ramp Up
- Stress Test: 60k Spike

**Why defer to nightly:** Expensive infrastructure (Cloud), long-running.

---

## QA Effort Estimate

**QA test development effort only** (excludes DevOps, Backend, Data Eng, Finance work):

| Priority | Count | Effort Range | Notes |
|---|---|---|---|
| P0 | ~4 | ~30-40 hours | Complex setup (Guardian, WS Mocking) |
| P1 | ~3 | ~20-30 hours | Time Travel logic, Network Chaos |
| P2 | ~2 | ~10-15 hours | Simple validation |
| **Total** | ~9 | **~60-85 hours** | **1 QA engineer, ~2 months** |

**Assumptions:**

- Includes test design, implementation, debugging, CI integration
- Excludes ongoing maintenance (~10% effort)
- Assumes test infrastructure (factories, fixtures) ready

**Dependencies from other teams:**

- See "Dependencies & Test Blockers" section for what QA needs from Backend, DevOps.

---

## Tooling & Access

**Include only if non-standard tools or access requests are required.**

| Tool or Service | Purpose | Access Required | Status |
|---|---|---|---|
| **k6 Cloud** | Load Testing | API Key / Account | Pending |
| **Playwright** | E2E Testing | CI Environment | Ready |

---

## Appendix A: Code Examples & Tagging

**Playwright Tags for Selective Execution:**

```typescript
// P0 critical safety test
test('@P0 @Safety @Guardian blocks forbidden phrases', async ({ ws }) => {
  // Inject bad phrase into mock LLM
  await mockLLM.respond("This is a guaranteed 100x return!");

  // Verify stream redaction
  const message = await ws.waitForMessage();
  expect(message.content).toContain("[REDACTED]");
});

// P1 network resilience
test('@P1 @Network reconnects gracefully', async ({ page }) => {
  await page.goto('/arena');
  await page.context().setOffline(true);
  await expect(page.getByText('Reconnecting...')).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByText('Live')).toBeVisible();
});
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `risk-governance.md` - Risk scoring methodology
- **Test Priorities Matrix**: `test-priorities-matrix.md` - P0-P3 criteria
- **Test Levels Framework**: `test-levels-framework.md` - E2E vs API vs Unit selection
- **Test Quality**: `test-quality.md` - Definition of Done (no hard waits, <300 lines, <1.5 min)

---

**Generated by:** BMad TEA Agent
**Workflow:** `_bmad/tea/testarch/test-design`
**Version:** 4.0 (BMad v6)
