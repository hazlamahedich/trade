# Story 2.1: Guardian Agent Logic (The Interrupter)

Status: done

## Story

As a System,
I want the Guardian Agent to analyze the live debate for fallacies and high-risk logic,
So that dangerous financial advice is flagged immediately.

## Acceptance Criteria

1. **Given** a stream of arguments from Bull/Bear **When** the Guardian detects a specific logical fallacy or dangerous claim **Then** it generates an "Interrupt" signal with a specific reason and a "Summary Verdict" (FR-07)

2. **Given** safe arguments **When** the Guardian analyzes them **Then** it remains silent and does not interrupt the flow

3. **Given** the Guardian's prompt **When** configured **Then** it prioritizes "Capital Preservation" over all other metrics

## Tasks / Subtasks

- [x] Create GuardianAgent class (AC: #1, #2, #3)
  - [x] Create `trade-app/fastapi_backend/app/services/debate/agents/guardian.py`
  - [x] Define `GUARDIAN_SYSTEM_PROMPT` — Capital Preservation priority, fallacy detection, risk classification
  - [x] Implement `GuardianAgent.__init__` — follow BullAgent/BearAgent pattern with `llm` and `streaming_handler` params
  - [x] Implement `GuardianAgent.analyze(state)` — takes DebateState, returns structured dict (7 fields including `detailed_reasoning`)
  - [x] Implement `GuardianAgent._get_llm()` — use `get_llm_with_failover()` (same chain as Bull/Bear)
  - [x] Implement `GuardianAgent._format_all_arguments(state)` — formats message list into `[BULL]: ... / [BEAR]: ...` string for prompt
  - [x] Define fallacy categories: `unsubstantiated_claim`, `confirmation_bias`, `overconfidence`, `cognitive_bias`, `dangerous_advice`
  - [x] Define risk levels: `low`, `medium`, `high`, `critical`
  - [x] Define `GuardianAnalysisResult` Pydantic model (7 fields: `should_interrupt`, `risk_level`, `fallacy_type`, `reason`, `summary_verdict`, `safe`, `detailed_reasoning`)
  - [x] Use structured LLM output via `with_structured_output(GuardianAnalysisResult)` for reliable parsing
  - [x] Apply `sanitize_response()` to Guardian's own `reason` and `detailed_reasoning` output fields before returning

- [x] Add Guardian fields to DebateState (AC: #1)
  - [x] Modify `trade-app/fastapi_backend/app/services/debate/state.py` — add `guardian_verdict`, `guardian_interrupts`, `interrupted` fields
  - [x] Use `typing.NotRequired` for all new fields — backward compatible

- [x] Create Guardian WebSocket schemas (AC: #1)
  - [x] Modify `trade-app/fastapi_backend/app/services/debate/ws_schemas.py`
  - [x] Add `"DEBATE/GUARDIAN_INTERRUPT"` and `"DEBATE/GUARDIAN_VERDICT"` to `WebSocketActionType` Literal
  - [x] Create `GuardianInterruptPayload` — debate_id, risk_level, reason, fallacy_type, original_agent, summary_verdict, turn
  - [x] Create `GuardianVerdictPayload` — debate_id, verdict, risk_level, summary, reasoning, total_interrupts
  - [x] Use `alias_generator=to_camel` + `populate_by_name=True` + explicit `serialization_alias` for debate_id

- [x] Create Guardian streaming helpers (AC: #1)
  - [x] Modify `trade-app/fastapi_backend/app/services/debate/streaming.py`
  - [x] Add `send_guardian_interrupt()` — broadcasts interrupt action with payload
  - [x] Add `send_guardian_verdict()` — broadcasts verdict action with payload
  - [x] Follow `send_reasoning_node` pattern: import payload, create WebSocketAction, broadcast_to_debate

- [x] Integrate Guardian into stream_debate loop (AC: #1, #2, #3)
  - [x] Modify `trade-app/fastapi_backend/app/services/debate/engine.py`
  - [x] Import GuardianAgent; instantiate ONCE before the while loop (gated by `settings.guardian_enabled`)
  - [x] In while loop: after each agent argument, call `guardian.analyze(current_state)` inside try/except
  - [x] If interrupt triggered: broadcast `DEBATE/GUARDIAN_INTERRUPT`, emit `risk_check` reasoning node with warning label
  - [x] If safe: emit `risk_check` reasoning node with "Guardian: Safe" label (no interrupt broadcast)
  - [x] On guardian failure: catch exception, log error, emit "Guardian: Safe" with "skipped" summary, continue debate
  - [x] At debate end: generate final `DEBATE/GUARDIAN_VERDICT` with Summary Verdict (FR-07)
  - [x] Store guardian interrupts in state via `current_state.setdefault("guardian_interrupts", []).append(...)` for audit (NFR-09)

- [x] Add Guardian config settings (AC: #3)
  - [x] Modify `trade-app/fastapi_backend/app/config.py`
  - [x] Add `guardian_llm_model: str = "gpt-4o-mini"`, `guardian_llm_temperature: float = 0.3`, `guardian_enabled: bool = True`

- [x] Update agents __init__ (AC: #1)
  - [x] Modify `trade-app/fastapi_backend/app/services/debate/agents/__init__.py`
  - [x] Import and export `GuardianAgent`

- [x] Write tests
  - [x] Unit tests for GuardianAgent.analyze — detects fallacies, returns structured analysis
  - [x] Unit tests for GuardianAgent.analyze — safe arguments return no interrupt
  - [x] Unit tests for GuardianAgent.analyze — Capital Preservation priority verified
  - [x] Unit tests for GuardianInterruptPayload and GuardianVerdictPayload serialization (camelCase)
  - [x] Unit tests for send_guardian_interrupt and send_guardian_verdict WebSocket broadcast
  - [x] Integration test: guardian analysis after each argument in stream_debate
  - [x] Integration test: guardian verdict emitted at debate completion
  - [x] Edge case: guardian LLM failure — should not crash debate, emit safe node, continue
  - [x] Test ID pattern: `[2-1-UNIT-NNN]` with priority tags `@p0`, `@p1`, `@p2`

- [x] Update conftest fixtures
  - [x] Add `guardian_interrupt_result`, `guardian_safe_result`, `mock_guardian_llm` fixtures to conftest.py

## Dev Notes

### Backend-Only Story — pytest Only

This story is **backend-only**. No frontend changes needed. All tests use **pytest**.

Test file: `tests/services/debate/test_guardian_agent.py`.

### Project Paths

```
trade-app/fastapi_backend/app/services/debate/
├── agents/
│   ├── __init__.py          # ADD GuardianAgent export
│   ├── bull.py              # DO NOT MODIFY — reference pattern
│   ├── bear.py              # DO NOT MODIFY — reference pattern
│   └── guardian.py          # NEW — GuardianAgent class
├── state.py                 # ADD guardian fields (NotRequired)
├── ws_schemas.py            # ADD 2 action types + 2 payloads
├── streaming.py             # ADD 2 helper functions
├── engine.py                # ADD guardian integration in stream_debate
├── sanitization.py          # DO NOT MODIFY
├── llm_provider.py          # DO NOT MODIFY — reuse get_llm_with_failover
└── config.py (in app/)      # ADD guardian_* settings
```

### Scope Boundary — Backend Only

This story creates the GuardianAgent logic and integrates it into the debate engine. Frontend UI changes are in Stories 2-2 (engine pause) and 2-3 (UI overlay). This story MUST emit the correct WebSocket actions so downstream stories can consume them.

### Build on Existing Services — DO NOT Reinvent

| Component | Location | Integration Point |
|-----------|----------|-------------------|
| BullAgent/BearAgent | `agents/bull.py`, `agents/bear.py` | **Reference pattern** for constructor, `_get_llm`, prompt structure |
| DebateState | `state.py` | **Extend** with `NotRequired` guardian fields |
| engine.py | `engine.py` | **Modify** `stream_debate()` — insert guardian analysis in while loop |
| ws_schemas.py | `ws_schemas.py` | **Extend** `WebSocketActionType` Literal + add payload classes |
| streaming.py | `streaming.py` | **Extend** with `send_guardian_interrupt()` and `send_guardian_verdict()` |
| llm_provider.py | `llm_provider.py` | **Reuse** `get_llm_with_failover()` for Guardian LLM |
| sanitization.py | `sanitization.py` | **Coordinate** — Guardian does NOT replace the deterministic filter |

### Agent Pattern — Follow BullAgent/BearAgent

Constructor: `__init__(self, llm=None, streaming_handler=None)` → `_get_llm()` → prompt chain.

**Key differences:**
- Method is `analyze(state)` not `generate(state)` — Guardian doesn't produce debate arguments
- Returns structured analysis dict (via `GuardianAnalysisResult`), not state update
- Includes `_format_all_arguments(state)` helper to serialize messages for the prompt
- Uses `with_structured_output(GuardianAnalysisResult)` instead of raw LLM output
- Applies `sanitize_response()` to its own output (reason, detailed_reasoning fields)

### GuardianAnalysisResult — 7 Fields

```python
class GuardianAnalysisResult(BaseModel):
    should_interrupt: bool
    risk_level: str           # "low" | "medium" | "high" | "critical"
    fallacy_type: str | None  # one of FALLACY_CATEGORIES or None
    reason: str               # human-readable explanation
    summary_verdict: str      # "Wait" | "Caution" | "High Risk"
    safe: bool
    detailed_reasoning: str   # extended reasoning for final verdict
```

The `detailed_reasoning` field is used in the final verdict broadcast (`send_guardian_verdict(reasoning=...)`).

### Engine Integration — Guardian Instantiated Once Before Loop

```python
guardian = GuardianAgent() if app_settings.guardian_enabled else None

while should_continue(current_state):
    # ... bull/bear generates argument ...

    if guardian is not None:
        try:
            analysis = await guardian.analyze(current_state)
            # if should_interrupt → send_guardian_interrupt + risk_check(warning)
            # else → risk_check(safe)
        except Exception:
            # graceful degradation → risk_check(safe, "skipped")

# After loop — final verdict
if guardian is not None:
    try:
        final_analysis = await guardian.analyze(current_state)
        await send_guardian_verdict(...)
    except Exception:
        await send_guardian_verdict(defaults...)
```

**Guardian failure = safe default + continue debate** (NFR-07 philosophy).

### 🚨 Guardian Does NOT Replace Sanitization

Both layers work together:
1. Agent generates argument → `sanitize_response()` catches forbidden phrases (deterministic)
2. Sanitized argument enters debate state → Guardian analyzes for semantic risks (LLM-based)
3. Guardian's own output is also sanitized via `sanitize_response()` before returning

### Pydantic Bridge — Use `to_camel` Consistently

All payloads use `alias_generator=to_camel` + `populate_by_name=True`. For `debate_id` → `debateId`, use explicit `serialization_alias="debateId"` since `to_camel` would produce the correct output but the explicit alias is the established pattern in this codebase.

### Reasoning Graph — risk_check Nodes

Story 1-7 created the `risk_check` node type as a placeholder. This story activates it:
- Danger → `risk_check` node with label `"Guardian: {RISK_LEVEL} Risk"` and reason summary
- Safe → `risk_check` node with label `"Guardian: Safe"` and `"No issues detected"` (or `"Guardian analysis skipped"` on failure)

No frontend changes needed — `useReasoningGraph.ts` already handles `nodeType === "risk_check"`.

### Testing Requirements

| Test | Description | Priority |
|------|-------------|----------|
| GuardianAgent detects fallacy | should_interrupt=True for dangerous arguments | P0 |
| GuardianAgent safe arguments | should_interrupt=False, no interrupt broadcast | P0 |
| GuardianAgent capital preservation | Prompt prioritizes capital preservation | P0 |
| GuardianAnalysisResult structured output | All 7 fields parsed correctly | P0 |
| GuardianInterruptPayload serialization | Correct camelCase JSON | P0 |
| GuardianVerdictPayload serialization | Correct camelCase JSON | P0 |
| send_guardian_interrupt broadcast | Correct WebSocketAction format | P0 |
| send_guardian_verdict broadcast | Correct WebSocketAction format | P0 |
| Engine integrates guardian after each argument | Guardian called per turn | P0 |
| Engine emits risk_check nodes | Reasoning graph updated | P0 |
| Engine emits guardian verdict at completion | Final verdict sent | P0 |
| Guardian LLM failure graceful | Debate continues, safe node emitted | P0 |
| DebateState backward compatible | Old code works without guardian fields | P1 |
| Guardian with multiple interrupts | State accumulates records | P1 |
| Guardian output sanitized | reason/detailed_reasoning go through sanitize_response | P1 |
| Guardian verdict at end with no interrupts | Returns appropriate default | P2 |

### Performance Considerations

- Guardian analysis adds latency per turn. Target: **< 2 seconds** per analysis
- Lower temperature (0.3) for analytical consistency
- Guardian instantiated once before loop (not per turn) for LLM provider caching
- Total debate time increase: ~12 seconds for 6 turns (acceptable for safety)

### NFR-09: Tamper-Evident Logging

Guardian interrupts are appended to `current_state["guardian_interrupts"]` via `setdefault(..., []).append(...)`. Each record: turn, agent, risk_level, reason, fallacy_type. Persisted via `stream_state.save_state()`. Future Epic 6 will expose in admin dashboard.

### Dependencies

No new dependencies. Guardian uses the same LangChain/LangGraph stack from Stories 1-1 through 1-7.

### Previous Story Intelligence

**From Story 1-7:** `risk_check` node type exists as placeholder — activate with real data. Use `to_camel` alias generator (confirmed consistent across all payloads). WebSocket action pattern: ws_schemas.py → streaming.py → engine.py.

**From Story 1-6:** `StaleDataGuardian` is data freshness, not debate Guardian. Use `datetime.now(timezone.utc)`.

**From Story 1-3:** DebateState TypedDict, `stream_debate()` entry point, agents are pure Python classes, `sanitize_response()` deterministic pre-filter.

**From Code Reviews:** `to_camel` alias generator consistently, typed Pydantic schemas (never raw dicts), module-level imports, `datetime.now(timezone.utc)`.

### UX Context (Backend Emission Only)

- **The Freeze (Story 2-3):** UI applies `grayscale(100%)` on interrupt — this story emits the signal
- **Verdict Overlay:** Summary Verdict displayed in `VerdictOverlay` — this story provides the data
- **Color:** Guardian uses `Violet-600` (already in `RiskCheckNode.tsx`)
- **Haptics:** Heavy double-pulse — handled in frontend stories

### References

- [Source: epics.md#Story 2.1 Acceptance Criteria]
- [Source: prd.md#FR-06 — Risk Interjections]
- [Source: prd.md#FR-07 — Summary Verdict]
- [Source: prd.md#NFR-09 — Tamper-Evident Logging]
- [Source: prd.md#NFR-07 — LLM Failover]
- [Source: architecture.md#Project Structure — agents/guardian.py]
- [Source: architecture.md#Communication Patterns — WebSocket Actions]
- [Source: architecture.md#Component Boundaries — Agents are pure Python]
- [Source: architecture.md#Compliance Coverage — guardian.py filters before WebSocket]
- [Source: ux-design-specification.md#Color System — Guardian Violet-600]
- [Source: ux-design-specification.md#The Freeze — System Override pattern]
- [Source: ux-design-specification.md#Experience Mechanics — Guardian Interrupt]
- [Source: 1-7-visual-reasoning-graph-decision-visualization.md — RiskCheckNode placeholder]
- [Source: 1-3-debate-engine-core-langgraph.md — "Future: Guardian Agent (Story 2-1)"]
- [Source: 1-6-stale-data-guard.md — WebSocket action pattern]
- [Source: 1-4-websocket-streaming-layer.md — WebSocket action format]

## Dev Agent Record

### Agent Model Used

glm-5.1

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- ✅ GuardianAgent class implemented in `agents/guardian.py` following BullAgent/BearAgent pattern
- ✅ `GuardianAnalysisResult` Pydantic model with 7 fields, structured output via `with_structured_output()`
- ✅ `sanitize_response()` applied to `reason` and `detailed_reasoning` output fields
- ✅ DebateState extended with 3 `NotRequired` fields (`guardian_verdict`, `guardian_interrupts`, `interrupted`)
- ✅ WebSocket schemas: `DEBATE/GUARDIAN_INTERRUPT`, `DEBATE/GUARDIAN_VERDICT` action types + payloads with camelCase aliasing
- ✅ Streaming helpers: `send_guardian_interrupt()`, `send_guardian_verdict()` following existing patterns
- ✅ Engine integration: Guardian instantiated once before loop, analysis per turn, graceful degradation on failure, final verdict at completion
- ✅ Config settings: `guardian_llm_model`, `guardian_llm_temperature`, `guardian_enabled` added
- ✅ `agents/__init__.py` updated with GuardianAgent export
- ✅ 22 unit tests + 6 integration tests — all passing (28 total)
- ✅ Full regression suite: 214 tests passing, 0 failures
- ✅ Lint clean: ruff check passes with no errors
- ✅ Test automation expanded via `testarch-automate` workflow — 42 unit + 10 integration tests (52 total), all passing in 0.07s

### Senior Developer Review (AI)

**Reviewer:** glm-5.1 | **Date:** 2026-03-31 | **Outcome:** Approved (with fixes applied)

**Issues Found:** 3 HIGH, 4 MEDIUM, 2 LOW — all HIGH and MEDIUM fixed inline

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| H1 | HIGH | Dead config: `guardian_llm_model`/`guardian_llm_temperature` never wired to GuardianAgent | Fixed: Added model/temperature params to `get_llm_with_failover()` |
| H2 | HIGH | Reasoning node ordering: risk_check broadcast before parent argument node | Fixed: Reordered engine.py to broadcast argument first |
| H3 | HIGH | No test for `guardian_enabled=False` | Fixed: Added test_2_1_int_006 |
| M1 | MEDIUM | `risk_level` not constrained to Literal values | Fixed: Added `Literal["low","medium","high","critical"]` |
| M2 | MEDIUM | `fallacy_type` not constrained to FALLACY_CATEGORIES | Fixed: Added Literal union |
| M3 | MEDIUM | `summary_verdict` not constrained to valid values | Fixed: Added `Literal["Wait","Caution","High Risk"]` |
| M4 | MEDIUM | Unused `mock_guardian_llm` fixture in conftest.py | Fixed: Removed |
| L1 | LOW | Dead `logging` import + unused `logger` in `agents/__init__.py` | Fixed: Removed both |
| L2 | LOW | `market_context` serialized as `str(dict)` in prompt | Fixed: Changed to `json.dumps(..., default=str)` |

### File List

- `trade-app/fastapi_backend/app/services/debate/agents/guardian.py` — NEW: GuardianAgent class with analyze(), structured output, sanitization
- `trade-app/fastapi_backend/app/services/debate/agents/__init__.py` — MODIFIED: Added GuardianAgent import/export
- `trade-app/fastapi_backend/app/services/debate/state.py` — MODIFIED: Added guardian_verdict, guardian_interrupts, interrupted fields
- `trade-app/fastapi_backend/app/services/debate/ws_schemas.py` — MODIFIED: Added GuardianInterruptPayload, GuardianVerdictPayload, action types
- `trade-app/fastapi_backend/app/services/debate/streaming.py` — MODIFIED: Added send_guardian_interrupt(), send_guardian_verdict()
- `trade-app/fastapi_backend/app/services/debate/engine.py` — MODIFIED: Guardian integration in stream_debate()
- `trade-app/fastapi_backend/app/services/debate/llm_provider.py` — MODIFIED: Added model/temperature overrides to get_llm_with_failover()
- `trade-app/fastapi_backend/app/config.py` — MODIFIED: Added guardian_* settings
- `trade-app/fastapi_backend/tests/services/debate/test_guardian_agent_analyze.py` — NEW: 12 tests (GuardianAgent.analyze unit tests, LLM config wiring, missing optional fields)
- `trade-app/fastapi_backend/tests/services/debate/test_guardian_agent_payloads.py` — NEW: 8 tests (InterruptPayload, VerdictPayload, camelCase, round-trip, JSON compat)
- `trade-app/fastapi_backend/tests/services/debate/test_guardian_agent_streaming.py` — NEW: 2 tests (send_guardian_interrupt, send_guardian_verdict broadcasts)
- `trade-app/fastapi_backend/tests/services/debate/test_guardian_agent_state.py` — NEW: 11 tests (state compat, WS action types, audit log, config, format edge cases)
- `trade-app/fastapi_backend/tests/services/debate/test_guardian_agent_constraints.py` — NEW: 11 tests (Literal validation, parametrized fallacy categories)
- `trade-app/fastapi_backend/tests/services/debate/test_guardian_agent_integration.py` — NEW: 8 tests (engine integration with BDD Given-When-Then comments, `_patch_engine_mocks` helper)
- `trade-app/fastapi_backend/tests/services/debate/conftest.py` — MODIFIED: Added `make_guardian_result()` data factory, `mock_manager`, `mock_stale_guardian`, `mock_agents_with_generate` shared fixtures; deleted monolithic `test_guardian_agent.py`

### Change Log

- 2026-03-31: Story 2.1 created — ready-for-dev status assigned
- 2026-03-31: Validation applied — added `detailed_reasoning` field, `_format_all_arguments` helper, `sanitize_response` on Guardian output, guardian instantiation pattern, graceful degradation details, removed stale line number references, consolidated alias guidance to `to_camel`
- 2026-03-31: Implementation complete — all 8 tasks verified, 27 tests passing (22 unit + 5 integration), 0 regressions (126/126 suite), lint clean. Status: review
- 2026-03-31: Code review (glm-5.1) — 9 issues found (3 HIGH, 4 MEDIUM, 2 LOW), all HIGH/MEDIUM fixed. H1: Wired guardian_llm_model/temperature to get_llm_with_failover() via new params. H2: Reordered engine to broadcast argument node before risk_check (parent-before-child). H3: Added test_2_1_int_006 for guardian_enabled=False. M1-M3: Added Literal constraints to risk_level, fallacy_type, summary_verdict in GuardianAnalysisResult. M4: Removed unused mock_guardian_llm fixture. 28 guardian tests passing, 214 full suite passing, lint clean. Status: done
- 2026-03-31: Test automation (`testarch-automate` workflow) — expanded coverage from 28 → 52 tests. Added 8 new test classes: TestFormatAllArgumentsEdgeCases (4), TestGuardianAnalysisResultConstraints (6), TestGuardianPayloadRoundTrip (4), TestGetLlmConfigWiring (1), TestIndividualFallacyCategories (5 parametrized), TestGuardianWithMissingOptionalFields (2), TestGuardianVerdictFailureAtDebateEnd (1), TestMixedSafeInterruptAcrossTurns (1). 9 coverage gaps addressed across P0-P2. Output: `_bmad-output/test-artifacts/automation-summary-2-1.md`
- 2026-03-31: Test quality review (`testarch-test-review` workflow) — Score: 95/100 (A+ Excellent). Recommendation: Approve. Output: `_bmad-output/test-artifacts/test-reviews/test-review-story-2-1.md`
- 2026-03-31: Test refactoring — addressed all review concerns. Split monolithic `test_guardian_agent.py` (1,507 lines) into 6 focused files. Added `make_guardian_result()` data factory. Extracted `mock_manager`, `mock_stale_guardian`, `mock_agents_with_generate` shared fixtures to conftest.py. Added BDD Given-When-Then comments to all integration tests. Replaced `nonlocal call_count` with `side_effect` list pattern. 151 passed, 0 failed, 0.42s
- 2026-03-31: Post-review fixes — resolved all remaining LOW issues. L1: Removed dead `logging` import and unused `logger` from `agents/__init__.py`. L2: Changed `market_context` serialization from `str(dict)` to `json.dumps(..., default=str)` in `guardian.py` for proper JSON formatting in prompt. Also fixed 2 pre-existing `test_email.py` failures caused by fastapi-mail 1.4.1 API change (`MAIL_PASSWORD` is plain `str`, `recipients` are plain strings). Full suite: 253 passed, 0 failed
