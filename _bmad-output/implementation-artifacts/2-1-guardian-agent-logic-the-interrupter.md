# Story 2.1: Guardian Agent Logic (The Interrupter)

Status: ready-for-dev

## Story

As a System,
I want the Guardian Agent to analyze the live debate for fallacies and high-risk logic,
So that dangerous financial advice is flagged immediately.

## Acceptance Criteria

1. **Given** a stream of arguments from Bull/Bear **When** the Guardian detects a specific logical fallacy or dangerous claim **Then** it generates an "Interrupt" signal with a specific reason and a "Summary Verdict" (FR-07)

2. **Given** safe arguments **When** the Guardian analyzes them **Then** it remains silent and does not interrupt the flow

3. **Given** the Guardian's prompt **When** configured **Then** it prioritizes "Capital Preservation" over all other metrics

## Tasks / Subtasks

- [ ] Create GuardianAgent class (AC: #1, #2, #3)
  - [ ] Create `trade-app/fastapi_backend/app/services/debate/agents/guardian.py`
  - [ ] Define `GUARDIAN_SYSTEM_PROMPT` — Capital Preservation priority, fallacy detection, risk classification
  - [ ] Implement `GuardianAgent.__init__` — follow BullAgent/BearAgent pattern with `llm` and `streaming_handler` params
  - [ ] Implement `GuardianAgent.analyze(state)` — takes DebateState, returns structured dict (7 fields including `detailed_reasoning`)
  - [ ] Implement `GuardianAgent._get_llm()` — use `get_llm_with_failover()` (same chain as Bull/Bear)
  - [ ] Implement `GuardianAgent._format_all_arguments(state)` — formats message list into `[BULL]: ... / [BEAR]: ...` string for prompt
  - [ ] Define fallacy categories: `unsubstantiated_claim`, `confirmation_bias`, `overconfidence`, `cognitive_bias`, `dangerous_advice`
  - [ ] Define risk levels: `low`, `medium`, `high`, `critical`
  - [ ] Define `GuardianAnalysisResult` Pydantic model (7 fields: `should_interrupt`, `risk_level`, `fallacy_type`, `reason`, `summary_verdict`, `safe`, `detailed_reasoning`)
  - [ ] Use structured LLM output via `with_structured_output(GuardianAnalysisResult)` for reliable parsing
  - [ ] Apply `sanitize_response()` to Guardian's own `reason` and `detailed_reasoning` output fields before returning

- [ ] Add Guardian fields to DebateState (AC: #1)
  - [ ] Modify `trade-app/fastapi_backend/app/services/debate/state.py` — add `guardian_verdict`, `guardian_interrupts`, `interrupted` fields
  - [ ] Use `typing.NotRequired` for all new fields — backward compatible

- [ ] Create Guardian WebSocket schemas (AC: #1)
  - [ ] Modify `trade-app/fastapi_backend/app/services/debate/ws_schemas.py`
  - [ ] Add `"DEBATE/GUARDIAN_INTERRUPT"` and `"DEBATE/GUARDIAN_VERDICT"` to `WebSocketActionType` Literal
  - [ ] Create `GuardianInterruptPayload` — debate_id, risk_level, reason, fallacy_type, original_agent, summary_verdict, turn
  - [ ] Create `GuardianVerdictPayload` — debate_id, verdict, risk_level, summary, reasoning, total_interrupts
  - [ ] Use `alias_generator=to_camel` + `populate_by_name=True` + explicit `serialization_alias` for debate_id

- [ ] Create Guardian streaming helpers (AC: #1)
  - [ ] Modify `trade-app/fastapi_backend/app/services/debate/streaming.py`
  - [ ] Add `send_guardian_interrupt()` — broadcasts interrupt action with payload
  - [ ] Add `send_guardian_verdict()` — broadcasts verdict action with payload
  - [ ] Follow `send_reasoning_node` pattern: import payload, create WebSocketAction, broadcast_to_debate

- [ ] Integrate Guardian into stream_debate loop (AC: #1, #2, #3)
  - [ ] Modify `trade-app/fastapi_backend/app/services/debate/engine.py`
  - [ ] Import GuardianAgent; instantiate ONCE before the while loop (gated by `settings.guardian_enabled`)
  - [ ] In while loop: after each agent argument, call `guardian.analyze(current_state)` inside try/except
  - [ ] If interrupt triggered: broadcast `DEBATE/GUARDIAN_INTERRUPT`, emit `risk_check` reasoning node with warning label
  - [ ] If safe: emit `risk_check` reasoning node with "Guardian: Safe" label (no interrupt broadcast)
  - [ ] On guardian failure: catch exception, log error, emit "Guardian: Safe" with "skipped" summary, continue debate
  - [ ] At debate end: generate final `DEBATE/GUARDIAN_VERDICT` with Summary Verdict (FR-07)
  - [ ] Store guardian interrupts in state via `current_state.setdefault("guardian_interrupts", []).append(...)` for audit (NFR-09)

- [ ] Add Guardian config settings (AC: #3)
  - [ ] Modify `trade-app/fastapi_backend/app/config.py`
  - [ ] Add `guardian_llm_model: str = "gpt-4o-mini"`, `guardian_llm_temperature: float = 0.3`, `guardian_enabled: bool = True`

- [ ] Update agents __init__ (AC: #1)
  - [ ] Modify `trade-app/fastapi_backend/app/services/debate/agents/__init__.py`
  - [ ] Import and export `GuardianAgent`

- [ ] Write tests
  - [ ] Unit tests for GuardianAgent.analyze — detects fallacies, returns structured analysis
  - [ ] Unit tests for GuardianAgent.analyze — safe arguments return no interrupt
  - [ ] Unit tests for GuardianAgent.analyze — Capital Preservation priority verified
  - [ ] Unit tests for GuardianInterruptPayload and GuardianVerdictPayload serialization (camelCase)
  - [ ] Unit tests for send_guardian_interrupt and send_guardian_verdict WebSocket broadcast
  - [ ] Integration test: guardian analysis after each argument in stream_debate
  - [ ] Integration test: guardian verdict emitted at debate completion
  - [ ] Edge case: guardian LLM failure — should not crash debate, emit safe node, continue
  - [ ] Test ID pattern: `[2-1-UNIT-NNN]` with priority tags `@p0`, `@p1`, `@p2`

- [ ] Update conftest fixtures
  - [ ] Add `guardian_interrupt_result`, `guardian_safe_result`, `mock_guardian_llm` fixtures to conftest.py

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log

- 2026-03-31: Story 2.1 created — ready-for-dev status assigned
- 2026-03-31: Validation applied — added `detailed_reasoning` field, `_format_all_arguments` helper, `sanitize_response` on Guardian output, guardian instantiation pattern, graceful degradation details, removed stale line number references, consolidated alias guidance to `to_camel`
