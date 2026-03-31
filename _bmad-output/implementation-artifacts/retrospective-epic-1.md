# Retrospective: Epic 1 — Live Market Reasoning (The Arena - MVP Core)

**Date:** 2026-03-30
**Epic:** Epic 1 — Live Market Reasoning (The Arena - MVP Core)
**Team:** team mantis a
**Participants:** Bob (Scrum Master), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), Winston (Architect), team mantis a (Project Lead)

---

## Epic Summary

### Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 7 |
| Stories completed | 7 (100%) |
| Code review rounds | 8 (Story 1-3 had 2 rounds) |
| QA automation workflows | All 7 stories passed qa-automate |
| Deployment | **NOT deployed** — Railway/Vercel skipped |

### Quality Metrics

| Metric | Value |
|--------|-------|
| Backend tests (start → end) | 27 → 201 |
| Frontend tests (start → end) | 31 → 107 |
| Total verified tests | 308 |
| Code review issues found/fixed | 24 HIGH, 22 MEDIUM, 7 LOW |
| Test quality scores | 82–95 (A range) |
| Production incidents | 0 (not deployed) |
| Technical debt items | 6 documented |

### Stories Delivered

| Story | Title | Key Deliverable |
|-------|-------|-----------------|
| 1-1 | Project Initialization & Infrastructure | Monorepo, FastAPI + Next.js scaffolding, Docker, CI |
| 1-2 | Market Data Service | Redis-cached market data provider with freshness tracking |
| 1-3 | Debate Engine Core (LangGraph) | Bull/Bear agents, LangGraph StateGraph, sanitization module |
| 1-4 | WebSocket Streaming Layer | Token streaming, ConnectionManager (50k viewers), reconnection |
| 1-5 | Debate Stream UI (The Arena) | Chat interface, virtualization, Framer Motion animations |
| 1-6 | Stale Data Guard | 60-second freshness threshold, mid-debate pause, grayscale freeze UI |
| 1-7 | Visual Reasoning Graph | React Flow graph, 4 node types, winning path highlighting |

### Business Outcomes

| Requirement | Status |
|-------------|--------|
| FR-01 (Live debate streaming) | ✅ Covered |
| FR-02 (Bull agent arguments) | ✅ Covered |
| FR-03 (Bear agent counter-arguments) | ✅ Covered |
| FR-15 (Decision visualization) | ✅ Covered |
| FR-16 (Stale data pause) | ✅ Covered |
| Journey-Req-1 (Start → View debate) | ✅ Covered |
| NFR-01 (Stream latency <500ms) | ✅ Structured for (TTFT infrastructure in place) |
| NFR-03 (50k concurrent viewers) | ✅ ConnectionManager broadcast pattern |
| NFR-07 (LLM failover) | ✅ Implemented (Action 5 — llm_provider.py with OpenAI/Anthropic failover) |

---

## What Went Well

### 1. Story Detail and Intelligence Transfer

Each story's Dev Notes provided exact file paths, import statements, code review learnings, and explicit "build upon" sections. Story 1-7 referenced patterns from six previous stories. This cross-story continuity is rare for a first epic and directly enabled 100% delivery.

**Evidence:** Every story file contains a "Previous Story Intelligence" section with exact imports, learned patterns, and pitfalls to avoid.

### 2. Test Culture and Infrastructure

Test count grew from 58 baseline to 308 verified tests (432% growth). Test quality scores remained consistently in the A range (82–95). The testarch-automate and qa-automate workflows caught issues that code review missed.

**Evidence:** Story 1-1 established pytest + Jest patterns; every subsequent story added comprehensive test suites. QA reviews scored: 92, 95, 85, 82, 88, 84.

### 3. Forward-Thinking Architecture

The LangGraph workflow was designed with a Guardian node placeholder (Story 1-3). The WebSocket action schema was extensible (7 initial types, grew to 10 without refactoring). The RiskCheck node component was pre-built in Story 1-7. These decisions reduced Epic 2 integration risk.

**Evidence:** Story 1-3 Dev Notes: "Current architecture supports adding node between turns." Story 1-7: "Risk Check Node is Placeholder for Epic 2."

### 4. Shared Sanitization Module

Extracted in Story 1-3 code review from duplicated Bull/Bear code. Pre-compiled regex for performance. Already structured for Epic 2's forbidden phrase filter to extend.

**Evidence:** `trade-app/fastapi_backend/app/services/debate/sanitization.py` — used by both agents, 5 case-insensitivity tests.

### 5. WebSocket Action Architecture

Redux-style pattern (`{ type, payload, timestamp }`) established in Story 1-4 with SCREAMING_SNAKE naming. Cleanly extended by Stories 1-6 (DATA_STALE, DATA_REFRESHED) and 1-7 (REASONING_NODE) without breaking changes.

**Evidence:** `ws_schemas.py` — 10 action types, all following identical pattern.

---

## What Didn't Go Well

### 1. Testing Anti-Patterns Were Recurring (5 of 7 stories affected)

| Story | Issue | Root Cause |
|-------|-------|------------|
| 1-3 | Case-insensitive sanitization bug | Tests didn't cover uppercase forbidden phrases |
| 1-4 | 3 incomplete test implementations | Tests existed but had empty/stub bodies |
| 1-5 | 7 instances of `waitForTimeout()` hard waits | Known anti-pattern not enforced |
| 1-6 | 6 backend + 1 frontend test failures in qa-automate | Dependency version conflict (fastapi-pagination) |
| 1-6 | MockHeadersMiddleware rewrite needed | BaseHTTPMiddleware incompatible with test patterns |
| 1-7 | Infinite re-render in useReasoningGraph | `useEffect` array dependency anti-pattern |

**Pattern:** We identified anti-patterns (hard waits, wrong mocks, missing edge cases) but had no enforcement mechanism beyond manual code review.

### 2. Zero Deployment — No Production Validation

Seven stories of working code exist only locally. Docker configs were built but Railway/Vercel accounts never set up. No staging environment. No real-world performance data.

**Impact:** NFR-01 (TTFT <500ms) and NFR-03 (50k concurrent viewers) are structurally supported but never measured under real conditions.

### 3. Deprecated APIs Kept Recurring

`datetime.utcnow()` was caught in Story 1-3 code review (Round 1), fixed. Then appeared again in Story 1-6 code review (Round 2), fixed again. Same anti-pattern, two stories.

**Pattern:** No automated enforcement — relied on reviewer memory.

### 4. Technical Debt Accumulated (6 items)

| ID | Debt | Impact |
|----|------|--------|
| TD-1 | Pre-existing LSP errors in conftest.py, bear.py, bull.py | IDE noise, masks real issues |
| TD-2 | E2E tests require running backend | 11+ tests can't run in CI |
| TD-3 | MemorySaver instead of PostgresSaver | Won't persist across restarts |
| TD-4 | LLM failover is structure-only | NFR-07 not truly met |
| TD-5 | Test files exceeding 300-line guideline | Maintainability concern |
| TD-6 | Winning path highlights ALL paths | Deferred to Epic 3 |

### 5. Missing Barrel Exports

Story 1-6 forgot to export `StaleDataWarning` from barrel files. Caught by Story 1-7 code review. Indicates a gap in the code review checklist.

---

## Proposed Improvements (All Passed Vote)

### Proposal 1: Shared Test Patterns Document ✅ UNANIMOUS

**Owner:** Charlie (Senior Dev)
**Timeline:** Before Epic 2, Story 1

Document approved test patterns in `project-context.md`:
- Frontend: Use `waitForFunction()`, never `waitForTimeout()`. Use Jest (`jest.fn()`), never Vitest (`vi.fn()`). Use `jest.runAllTimersAsync()` for async.
- Backend: Use `AsyncMock` for async functions. Mock all external services. Use `freezer` or `time_machine` for time-dependent tests.
- E2E: Use `waitForResponse()` before assertions. Max 300 lines per test file.

### Proposal 2: Pre-Commit Anti-Pattern Hooks ✅ UNANIMOUS

**Owner:** Elena (Junior Dev)
**Timeline:** Before Epic 2, Story 1

Add pre-commit hooks (via `lefthook` or `husky`) that grep for:
- `waitForTimeout` in `.ts/.tsx` files → fail
- `datetime.utcnow` in `.py` files → fail
- `vi.fn()` / `vi.mock()` in `.ts/.tsx` files → fail
- Inline lambda alias generators in `.py` files → warn

### Proposal 3: Technical Debt Sprint ✅ UNANIMOUS

**Owner:** Winston (Architect)
**Timeline:** Before Epic 2 begins

| Priority | Debt Item | Effort | Blocks Epic 2? |
|----------|-----------|--------|----------------|
| P0 | Fix pre-existing LSP errors (conftest.py, bear.py, bull.py) | Small | No (noise) |
| P0 | Upgrade MemorySaver → configurable (prep PostgresSaver) | Medium | Yes — Guardian needs persistent state |
| P1 | Make E2E tests runnable without live backend (mock mode) | Medium | No |
| P1 | Implement LLM failover (NFR-07, structure → real) | Medium | Yes — Guardian needs failover |
| P2 | Split oversized test files (>300 lines) | Small | No |
| P2 | Add placeholder winning-path logic | Small | No |

### Proposal 4: Deploy Epic 1 to Staging ✅ PASSED (6-1, parallel track)

**Owner:** Alice (Product Owner)
**Timeline:** Parallel with debt sprint

- Set up Railway account (backend)
- Set up Vercel account (frontend)
- Deploy MVP to staging
- Validate NFR-01 (TTFT) and NFR-03 (concurrent viewers) under real conditions

### Proposal 5: Barrel Export Checklist ✅ UNANIMOUS

**Owner:** Elena (Junior Dev)
**Timeline:** Immediate — add to code review template

Add to code review checklist:
- [ ] All new components exported from `index.ts`
- [ ] All new hooks exported from `hooks/index.ts`
- [ ] All new types exported from relevant type file

---

## Epic 2 Preview — Risk Guardian Protection

### Dependencies on Epic 1

| Epic 1 Story | Epic 2 Dependency |
|--------------|-------------------|
| 1-3 Debate Engine | Guardian integrates as LangGraph node |
| 1-4 WebSocket Streaming | Guardian Interrupt broadcasts via WebSocket |
| 1-5 Debate Stream UI | Freeze overlay builds on existing UI |
| 1-7 Reasoning Graph | RiskCheck node currently placeholder |

### Risks Identified for Epic 2

1. **TD-3 (MemorySaver)** — Guardian needs persistent state for audit trail. Must upgrade before Story 2-1.
2. **TD-4 (LLM Failover)** — Guardian adds a third LLM call per turn. Failover becomes critical.
3. **No deployment** — Guardian's moderation accuracy can't be validated without real traffic.

---

## Action Items Summary

| # | Action | Owner | Priority | Timeline | Status |
|---|--------|-------|----------|----------|--------|
| 1 | Add test patterns to project-context.md | Charlie | HIGH | Before Epic 2 | ✅ Done |
| 2 | Set up pre-commit anti-pattern hooks | Elena | HIGH | Before Epic 2 | ✅ Done (lefthook.yml created) |
| 3 | Fix LSP errors (conftest.py, bear.py, bull.py) | Winston | P0 | Debt sprint | ✅ Done |
| 4 | Upgrade MemorySaver → configurable | Winston | P0 | Debt sprint | ✅ Done (get_checkpointer factory) |
| 5 | Implement LLM failover (NFR-07) | Charlie | P1 | Debt sprint | ✅ Done (llm_provider.py) |
| 6 | E2E tests runnable without backend | Dana | P1 | Debt sprint | ✅ Done (api-mock.ts) |
| 7 | Split oversized test files | Dana | P2 | Debt sprint | ✅ Done (2→7 files) |
| 8 | Add winning-path placeholder logic | Elena | P2 | Debt sprint | ✅ Done (all nodes is_winning) |
| 9 | Deploy Epic 1 to staging (Railway + Vercel) | Alice | HIGH | Parallel | ✅ Scripts ready (deploy.sh) |
| 10 | Add barrel export checklist to code review | Elena | HIGH | Immediate | ✅ Done (checklist.md updated) |

---

## Closing Remarks

Bob (Scrum Master): "Strong first epic, team. 7 for 7 delivery with solid architecture. The testing pain was real but the outcome — 308 verified tests — speaks for itself. Our job now is to clear the debt and enforce the patterns we learned before Epic 2 adds complexity."

Alice (Product Owner): "Let's get this thing deployed. Working software is the primary measure of progress."

Charlie (Senior Dev): "The debt sprint is non-negotiable. Epic 2's Guardian has hard dependencies on MemorySaver and failover. Let's fix the foundation before building the second floor."

Winston (Architect): "The architecture held up well. The extensible patterns — LangGraph nodes, WebSocket actions, feature modules — were validated by 7 stories of incremental extension. That's our strongest asset going into Epic 2."

Elena (Junior Dev): "I'll get the pre-commit hooks and barrel export checklist done this week. Small things that prevent big problems."

---

_Retro conducted: 2026-03-30_
_Next retro: After Epic 2 completion_
