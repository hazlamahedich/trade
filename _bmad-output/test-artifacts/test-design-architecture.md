---
stepsCompleted: []
lastStep: ''
lastSaved: ''
---

# Test Design for Architecture: AI Trading Debate Lab (System-Level)

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-02-18
**Author:** BMad TEA Agent
**Status:** Architecture Review Pending
**Project:** trade
**PRD Reference:** _bmad-output/planning-artifacts/prd.md
**ADR Reference:** _bmad-output/planning-artifacts/architecture.md

---

## Executive Summary

**Scope:** The "AI Trading Debate Lab" is a high-frequency, split-stack application (Next.js + FastAPI) where AI agents debate crypto assets in real-time. Core scope includes live WebSocket streaming, AI orchestration, voting mechanisms, and strictly regulated financial compliance (Guardian Agent).

**Business Context** (from PRD):

- **Revenue/Impact:** Retention via "Cognitive Offloading" and viral sharing.
- **Problem:** Users face "Analysis Paralysis" in crypto markets.
- **GA Launch:** MVP Target.

**Architecture** (from ADR):

- **Key Decision 1:** Split Stack (Vercel Frontend + Railway Backend) over Native WebSockets.
- **Key Decision 2:** LangGraph for stateful agent orchestration.
- **Key Decision 3:** Redis for hot caching and Pub/Sub.

**Expected Scale** (from ADR):

- **50,000 concurrent viewers** (READ)
- **10,000 concurrent voters** (WRITE)

**Risk Summary:**

- **Total risks**: 5
- **High-priority (≥6)**: 4 risks requiring immediate mitigation
- **Test effort**: ~60-85 hours (1 QA Engineer, ~2 weeks setup + 2-3 weeks implementation)

---

## Quick Guide

### 🚨 BLOCKERS - Team Must Decide (Can't Proceed Without)

**Sprint 0 Critical Path** - These MUST be completed before QA can write integration tests:

1. **TC-1: Mock Market Service** - Architecture must provide a "Mock Mode" or DI interface for the Market Data Service to inject deterministic prices and timestamps. (Backend Team)
2. **TC-3: Time Provider Interface** - Logic relies on `now() - timestamp < 60s`. Architecture must use a `TimeProvider` interface to allow tests to "time travel" and verify stale data pauses. (Backend Team)
3. **TC-4: WebSocket Observability** - WebSocket messages must follow a standard Redux-Action-like structure (`type`, `payload`) to allow Playwright to intercept and assert on them reliably. (Architecture)

**What we need from team:** Complete these 3 items in Sprint 0 or test development is blocked.

---

### ⚠️ HIGH PRIORITY - Team Should Validate (We Provide Recommendation, You Approve)

1. **R-01: AI Hallucination Strategy** - We recommend using "Adversarial Red Teaming" scripts (batch running prompts) to validate the Guardian's catch rate. (Approve: Product/Security)
2. **R-02: Load Testing Strategy** - We recommend k6 tests simulating 50k users on the WebSocket endpoint. If Railway fails, we need a horizontal scaling plan (Redis Pub/Sub). (Approve: DevOps)
3. **ASR-01: Regex Filter Placement** - The "Forbidden Phrase" filter must run *after* LLM generation and *before* WebSocket emission, in a deterministic code block. (Approve: Tech Lead)

**What we need from team:** Review recommendations and approve (or suggest changes).

---

### 📋 INFO ONLY - Solutions Provided (Review, No Decisions Needed)

1. **Test strategy**: E2E for "Happy Path" & "Safety Checks"; Integration for API/Voting; Unit for Agent Logic/Regex.
2. **Tooling**: Playwright (E2E/Comp), Pytest (Backend Unit/Int), k6 (Load).
3. **Quality gates**: 100% P0 Pass Rate, <1.2s LCP, Zero "Open" Critical Risks.
4. **Coverage**: ~15 P0-P2 scenarios prioritized by risk.

**What we need from team:** Just review and acknowledge (we already have the solution).

---

## For Architects and Devs - Open Topics 👷

### Risk Assessment

**Total risks identified**: 5 (4 high-priority score ≥6, 1 medium, 0 low)

#### High-Priority Risks (Score ≥6) - IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---|---|---|---|---|---|---|---|---|
| **R-01** | **SEC / BUS** | **AI Hallucination / Financial Advice:** Agents give specific, bad trade advice. | 2 | 3 | **6 (High)** | **1.** Guardian Agent Interruption.<br>**2.** Prominent Disclaimers.<br>**3.** "Forbidden Phrase" Regex Filter. | Backend | MVP |
| **R-02** | **PERF / OPS** | **WebSocket Connection Saturation:** 50k users overwhelm the single Railway container. | 2 | 3 | **6 (High)** | **1.** Load Testing (k6).<br>**2.** Horizontal scaling (Redis Pub/Sub).<br>**3.** Graceful degradation. | DevOps | MVP |
| **R-03** | **BUS** | **LLM Cost Explosion:** High traffic = massive token usage. | 3 | 2 | **6 (High)** | **1.** Aggressive Caching (Redis).<br>**2.** Rate limit debates per user.<br>**3.** Smaller models for trivial turns. | Product | Post-MVP |
| **R-04** | **TECH** | **E2E Flakiness (WebSockets):** Streaming tests fail due to network timing. | 3 | 2 | **6 (High)** | **1.** "Network-First" test architecture.<br>**2.** Deterministic "End of Message" signals. | QA | Sprint 1 |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|---|
| R-05 | DATA | **Stale Data Trading:** Users act on old prices. | 1 | 3 | 3 | **1.** UI "Data Stale" Warning.<br>**2.** Backend "Circuit Breaker". | Backend |

#### Risk Category Legend

- **TECH**: Technical/Architecture
- **SEC**: Security
- **PERF**: Performance
- **DATA**: Data Integrity
- **BUS**: Business Impact
- **OPS**: Operations

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS - Architecture Team Must Address**

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
|---|---|---|---|---|
| **TC-1: Live Market Data** | Flaky, non-deterministic tests | **MockMarketService** interface allowing injection of static price/time data. | Backend | Sprint 0 |
| **TC-3: Time-Based Logic** | Slow tests (waiting 1m); Flaky timeout tests | **TimeProvider** interface to allow tests to control system time. | Backend | Sprint 0 |

#### 2. Architectural Improvements Needed (WHAT SHOULD BE CHANGED)

1.  **TC-4: WebSocket Observability**
    -   **Current problem**: Binary or unstructured WS messages are hard to assert on in Playwright.
    -   **Required change**: Adopt a strict JSON envelope for all WS messages (e.g., `{ type: 'AGENT_THOUGHT', payload: {...} }`).
    -   **Impact if not fixed**: Tests will be brittle "UI-only" tests that break on minor UI changes.
    -   **Owner**: Architecture
    -   **Timeline**: Sprint 0

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

**Purpose**: Detailed mitigation strategies for all 4 high-priority risks.

#### R-01: AI Hallucination / Financial Advice (Score: 6) - CRITICAL

**Mitigation Strategy:**
1.  **Guardian Agent**: Separate LLM call to vet content before release.
2.  **Regex Safety Net**: Hardcoded list of banned terms ("guaranteed", "100x gem") runs as a final check.
3.  **UI Disclaimers**: Static text warning on every view.

**Owner:** Backend Lead
**Timeline:** MVP
**Status:** Planned
**Verification:** Unit tests for Regex; Adversarial E2E tests for Guardian.

#### R-02: WebSocket Connection Saturation (Score: 6) - CRITICAL

**Mitigation Strategy:**
1.  **Benchmark**: Run k6 script to find breaking point of single container.
2.  **Scale**: Implement Redis Pub/Sub to allow multiple backend instances to broadcast to connected clients.
3.  **Degrade**: If load > X, disable new connections or switch to polling.

**Owner:** DevOps
**Timeline:** MVP
**Status:** Planned
**Verification:** k6 Load Test (50k VUs).

---

### Assumptions and Dependencies

#### Assumptions
1.  Railway supports the required number of concurrent WebSocket connections (or can be scaled).
2.  LLM latency (Anthropic/OpenAI) will remain within acceptable limits for "Live" feel (<1s per token).

#### Dependencies
1.  **MockMarketService**: Required by Sprint 1 for P0 tests.
2.  **Dev/Staging Environments**: Required by Sprint 1.

#### Risks to Plan
-   **Risk**: LLM Provider outage during automated tests.
    -   **Impact**: CI failure.
    -   **Contingency**: Use VCR/Polly to record/replay LLM responses for non-logic tests.

---

**End of Architecture Document**

**Next Steps for Architecture Team:**
1.  Review Quick Guide (🚨/⚠️/📋) and prioritize blockers.
2.  Assign owners and timelines for high-priority risks.
3.  Validate assumptions and dependencies.

**Next Steps for QA Team:**
1.  Wait for Sprint 0 blockers (MockMarketService) resolution.
2.  Refer to companion QA doc (`test-design-qa.md`) for test scenarios.
3.  Begin Playwright setup.
