---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-19'
---

# Test Design: Epic 1 - Live Market Reasoning (Story 1-3)

**Date:** 2026-02-19
**Author:** team mantis a
**Status:** Approved
**Story:** 1-3-debate-engine-core-langgraph
**Focus:** LangGraph-based Debate Engine Core (Bull/Bear Agent Orchestration)

---

## Executive Summary

**Scope:** Targeted test design for Story 1-3 (Debate Engine Core) within Epic 1 - Live Market Reasoning

**Risk Summary:**

- Total risks identified: 6
- High-priority risks (≥6): 4
- Critical categories: TECH, DATA, BUS

**Coverage Summary:**

- P0 scenarios: 7 (existing: 7, gaps: 0)
- P1 scenarios: 7 (existing: 4, gaps: 3)
- P2/P3 scenarios: 5 (existing: 1, gaps: 4)
- **Total effort**: 7-11 hours (~1-2 days)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **WebSocket Streaming (Story 1-4)** | Separate story with dedicated test plan | Story 1-4 test design will cover streaming |
| **Debate Stream UI (Story 1-5)** | Frontend component tested separately | E2E tests in Story 1-5 |
| **Market Data Provider APIs** | External third-party services | Mock responses in integration tests |
| **Production LLM API** | Non-deterministic, rate-limited | Mock LLM in unit tests; integration tests use test fixtures |
| **Performance Benchmarks** | Not in MVP scope | Deferred to post-MVP |

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | - | ------ | ----- | ---------- | ----- | -------- |
| R-3.1 | TECH | LLM produces non-deterministic output making assertions brittle | 3 | 2 | 6 | Mock LLM responses in unit tests; use semantic assertions in E2E | QA | Complete |
| R-3.2 | DATA | Stale market data not properly detected in edge cases | 2 | 3 | 6 | Add time-provider interface for testability; test boundary conditions (59s/61s) | Dev | In Progress |
| R-3.3 | TECH | LangGraph state corruption during concurrent debates | 2 | 3 | 6 | Verify MemorySaver isolation; add concurrent debate test | Dev | Pending |
| R-3.4 | BUS | Forbidden phrases slip through regex filter (compliance) | 2 | 3 | 6 | Expand forbidden phrase test matrix; add case-insensitivity tests | QA | In Progress |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
| ------- | -------- | ----------- | - | ------ | ----- | ---------- | ----- |
| R-3.5 | TECH | Agent turn order violated (Bull→Bear→Bull pattern breaks) | 2 | 2 | 4 | State machine tests already cover; add property-based tests | QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | P | I | Score | Action |
| ------- | -------- | ----------- | - | ------ | ----- | ------ |
| R-3.6 | OPS | Market data service dependency fails | 1 | 2 | 2 | Mock service in tests; integration tests use test fixtures |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, compliance)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] Requirements and assumptions agreed upon by QA, Dev, PM
- [x] Test environment provisioned and accessible
- [x] Test data factories and fixtures ready (`conftest.py`)
- [x] Feature deployed to test environment
- [x] Mock LLM fixture available for deterministic testing
- [x] Market data service mock available

## Exit Criteria

- [x] All P0 tests passing
- [x] All P1 tests passing (or failures triaged)
- [x] No open high-priority / high-severity bugs
- [x] Test coverage agreed as sufficient
- [ ] All high-priority risks mitigated (2/4 complete)

---

## Test Coverage Plan

**Note: P0/P1/P2/P3 = priority/risk classification, NOT execution timing. See Execution Strategy section for timing.**

### P0 (Critical)

**Criteria**: Blocks core journey + High risk (≥6) + No workaround

| ID | Requirement | Test Level | Risk Link | Status | File |
| -- | ----------- | ---------- | --------- | ------ | ---- |
| 1.3-P0-001 | Bull agent generates argument with market data | Unit | R-3.1 | ✅ Existing | test_agents.py |
| 1.3-P0-002 | Bear agent references Bull's argument | Unit | R-3.1 | ✅ Existing | test_agents.py |
| 1.3-P0-003 | State transitions Bull→Bear→Bull correctly | Unit | R-3.5 | ✅ Existing | test_engine.py |
| 1.3-P0-004 | Debate stops at max_turns | Unit | R-3.5 | ✅ Existing | test_engine.py |
| 1.3-P0-005 | Stale data blocks debate start | Unit | R-3.2 | ✅ Existing | test_service.py |
| 1.3-P0-006 | POST /api/debate/start returns valid response | API | All | ✅ Existing | test_routes/test_debate.py |
| 1.3-P0-007 | Full debate flow end-to-end | Integration | All | ✅ Existing | test_service.py |

**Total P0**: 7 tests, all existing

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| ID | Requirement | Test Level | Risk Link | Status | File |
| -- | ----------- | ---------- | --------- | ------ | ---- |
| 1.3-P1-001 | Forbidden phrase redaction works | Unit | R-3.4 | ✅ Existing | test_agents.py |
| 1.3-P1-002 | Graph structure contains bull/bear nodes | Unit | R-3.5 | ✅ Existing | test_engine.py |
| 1.3-P1-003 | No market data blocks debate | Unit | R-3.2 | ✅ Existing | test_service.py |
| 1.3-P1-004 | LLM provider error returns 503 | API | R-3.1 | ✅ Existing | test_routes/test_debate.py |
| 1.3-P1-005 | Stale data boundary (59s/61s threshold) | Unit | R-3.2 | ⚠️ Gap | - |
| 1.3-P1-006 | Concurrent debate isolation | Integration | R-3.3 | ⚠️ Gap | - |
| 1.3-P1-007 | Forbidden phrase case-insensitivity | Unit | R-3.4 | ⚠️ Gap | - |

**Total P1**: 7 tests (4 existing, 3 gaps)

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| ID | Requirement | Test Level | Risk Link | Status | File |
| -- | ----------- | ---------- | --------- | ------ | ---- |
| 1.3-P2-001 | Bull references previous Bear argument | Unit | R-3.5 | ✅ Existing | test_agents.py |
| 1.3-P2-002 | Empty messages list handled gracefully | Unit | - | ⚠️ Gap | - |
| 1.3-P2-003 | Invalid asset returns error | API | - | ⚠️ Gap | - |

**Total P2**: 3 tests (1 existing, 2 gaps)

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| ID | Requirement | Test Level | Risk Link | Status | File |
| -- | ----------- | ---------- | --------- | ------ | ---- |
| 1.3-P3-001 | Unicode in agent arguments handled | Unit | R-3.4 | ⚠️ Gap | - |
| 1.3-P3-002 | Very long market context handled | Unit | - | ⚠️ Gap | - |

**Total P3**: 2 tests (0 existing, 2 gaps)

---

## Execution Order

**Philosophy**: Run everything in PRs unless expensive/long-running. Playwright parallelization enables 100s of tests in 10-15 min.

### PR Execution (~2-3 min)

**Includes**: All P0 + P1 existing tests

- Unit tests: `pytest tests/services/debate/ -v`
- API tests: `pytest tests/routes/test_debate.py -v`

### Nightly/Weekly Execution (~10 min)

**Includes**: All tests including P1-P3 gaps

- Full test suite with coverage report
- Integration tests with concurrent scenarios

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| -------- | ----- | ---------- | ----------- | ----- |
| P0 | 7 | 0 | 0h | All existing |
| P1 | 7 | 0.5-1 | 1.5-3h | 3 new scenarios |
| P2 | 3 | 0.5-1 | 1-2h | 2 new scenarios |
| P3 | 2 | 0.5-1 | 1-2h | 2 new scenarios |
| **Total** | **19** | **-** | **3.5-7h** | **~0.5-1 day** |

### Prerequisites

**Test Data:**

- `mock_llm` fixture - deterministic LLM responses
- `mock_market_service` fixture - fresh market data
- `stale_market_service` fixture - stale data scenarios

**Tooling:**

- pytest + pytest-asyncio for async tests
- unittest.mock for LLM/service mocking

**Environment:**

- Python 3.11+ with langgraph, langchain-openai
- No external API keys required (mocked)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥80% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths**: ≥80%
- **Business logic**: ≥70%
- **Edge cases**: ≥50%

### Non-Negotiable Requirements

- [x] All P0 tests pass
- [ ] No high-risk (≥6) items unmitigated (2/4 complete)
- [ ] Forbidden phrase filter tests pass (case-insensitivity needed)

---

## Mitigation Plans

### R-3.1: LLM Non-Deterministic Output (Score: 6)

**Mitigation Strategy:**
1. Use `mock_llm` fixture returning deterministic content
2. Semantic assertions check key phrases, not exact strings
3. Integration tests use fixed seed responses

**Owner:** QA
**Timeline:** Complete
**Status:** ✅ Complete
**Verification:** All 24 existing tests use mock_llm

### R-3.2: Stale Data Edge Cases (Score: 6)

**Mitigation Strategy:**
1. Add `TimeProvider` interface for test injection
2. Create tests at 59s (fresh) and 61s (stale) boundaries
3. Test race conditions around staleness check

**Owner:** Dev
**Timeline:** In Progress
**Status:** ⚠️ Partial
**Verification:** Existing test covers basic staleness; need boundary tests

### R-3.3: Concurrent Debate State Corruption (Score: 6)

**Mitigation Strategy:**
1. Verify MemorySaver creates isolated state per debate
2. Add concurrent debate integration test
3. Document threading model in architecture

**Owner:** Dev
**Timeline:** Pending
**Status:** ⚠️ Not Started
**Verification:** No test exists for concurrent debates

### R-3.4: Forbidden Phrase Bypass (Score: 6)

**Mitigation Strategy:**
1. Expand test matrix with additional forbidden phrases
2. Add case-insensitivity tests ("GUARANTEED", "Guaranteed")
3. Add Unicode bypass attempt tests

**Owner:** QA
**Timeline:** In Progress
**Status:** ⚠️ Partial
**Verification:** Basic test exists; need case/Unicode tests

---

## Assumptions and Dependencies

### Assumptions

1. LLM responses can be deterministically mocked for unit tests
2. MemorySaver provides adequate isolation for concurrent debates
3. Market data service mock accurately represents production behavior
4. Forbidden phrase list is stable and complete

### Dependencies

1. Story 1-2 Market Data Service - Required for integration tests
2. Mock middleware pattern - Required for LLM failover testing

### Risks to Plan

- **Risk**: Concurrent debate isolation insufficient
  - **Impact**: May require database-backed state persistence
  - **Contingency**: Escalate to Dev for MemorySaver replacement

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **Market Data Service (Story 1-2)** | Input dependency | `test_market_service.py` must pass |
| **Debate Routes** | API contract | `test_routes/test_debate.py` must pass |
| **LangGraph Workflow** | State machine | `test_engine.py` must pass |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd.md`
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 1)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Story: `_bmad-output/implementation-artifacts/1-3-debate-engine-core-langgraph.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (BMad v6)
