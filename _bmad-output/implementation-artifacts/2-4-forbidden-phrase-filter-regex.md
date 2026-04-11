# Story 2.4: Forbidden Phrase Filter (Regex)

Status: review

## Story

As a Compliance Officer,
I want a deterministic safety-net filter to catch promissory words that slip through prompt-level prevention,
So that we never accidentally display "Guaranteed" financial advice — with prevention as the primary defense and post-hoc redaction as the safety net.

## Acceptance Criteria

1. **Given** bull/bear agent system prompts include forbidden phrase prohibition instructions **When** an agent generates text **Then** forbidden phrases are prevented at the source (primary defense layer)

2. **Given** a list of forbidden phrases (e.g., "Guaranteed", "Risk-free", "Safe bet") **When** any agent generates text containing these words despite prompt-level prevention **Then** the system redacts them as `[REDACTED]` *before* sending via `DEBATE/ARGUMENT_COMPLETE` (safety-net defense layer)

3. **Given** a redaction **When** it occurs **Then** the system logs the incident as a prompt-engineering failure for audit (NFR-09), including `debate_id`, `agent`, `turn`, and original phrase

4. **Given** a `DEBATE/ARGUMENT_COMPLETE` message that was redacted **When** displayed in the frontend **Then** the `isRedacted: true` flag is present in the payload so the UI can display a "Moderated" badge (Story 2.5 dependency)

5. **Given** token streaming via `DEBATE/TOKEN_RECEIVED` **When** forbidden phrases appear in individual tokens **Then** the filter does NOT block/delay individual tokens — redaction happens only on the complete argument at `send_argument_complete` time. **Known limitation:** Users may briefly see forbidden phrases in the streaming text before the redacted `ARGUMENT_COMPLETE` message replaces them. This is acceptable because prompt-level prevention (AC #1) is the primary defense.

6. **Given** the existing `sanitize_response()` function in `sanitization.py` **When** this story is implemented **Then** it is enhanced (not duplicated) with structured audit logging and backward-compatible return type

7. **Given** the guardian agent's own output **When** the guardian generates text **Then** its existing sanitization call continues to work unchanged

8. **Given** the `turn_arguments` dict in `engine.py` **When** an argument is sanitized **Then** the **raw (unsanitized) content** is preserved in `turn_arguments` for reasoning/summary quality, while the **sanitized content** is sent via WebSocket and displayed in reasoning node labels

9. **Given** an argument where >50% of content is redacted **When** the redaction result is produced **Then** a high-redaction warning is logged so the prompt engineering team can improve agent prompts, and the debate continues with the redacted content

10. **Given** a phrase like "there's no surefire way to predict markets" **When** processed by the filter **Then** the word "surefire" is still redacted. Regex-based filtering has no contextual understanding. This is a known false-positive limitation documented in the phrase list governance process.

11. **Given** the forbidden phrase list **When** it needs to be updated **Then** it is loaded from a configurable source (settings/config), not hardcoded in module body — enabling compliance team updates without code changes

## Tasks / Subtasks

- [x] Add forbidden phrase prohibition to agent system prompts (AC: #1)
  - [x] In `bull.py` system prompt: add explicit instruction to never use promissory language including the full forbidden phrase list
  - [x] In `bear.py` system prompt: same instruction — **NOTE: `BEAR_SYSTEM_PROMPT` currently LACKS the "NEVER say guaranteed or risk-free" line that `BULL_SYSTEM_PROMPT` has at line 16. Add it.**
  - [x] Phrase list in prompts should reference `FORBIDDEN_PHRASES` from `sanitization.py` to keep source of truth in one place
  - [x] Log a `logger.info` at agent initialization confirming prompt-level prevention is active

- [x] **CRITICAL: Remove `sanitize_response()` calls from `bull.py` and `bear.py`** (AC: #2, #8)
  - [x] In `bull.py`: **REMOVE** line 6 `from ...sanitization import sanitize_response` and line 58 `content = sanitize_response(raw_content)`. Replace with `content = raw_content` — the agent now returns RAW content, sanitization moves to `engine.py`
  - [x] In `bear.py`: **REMOVE** the identical `sanitize_response` import and call at line 6 and line 58. Replace with `content = raw_content`
  - [x] **WHY:** Sanitization must happen in `engine.py` where `sanitize_content()` can produce `SanitizationResult` (with `is_redacted` flag and structured audit logging). If agents sanitize internally, the engine re-sanitizing already-clean text would always produce `is_redacted=False`, defeating the safety-net layer.

- [x] Make forbidden phrase list configurable (AC: #11)
  - [x] Move `FORBIDDEN_PHRASES` to be loaded from `app/config.py` settings with current list as default
  - [x] Add `FORBIDDEN_PHRASES: list[str]` to Settings class with default value matching current list + new phrases
  - [x] **Env var format:** Pydantic Settings can parse JSON strings from environment. Set `FORBIDDEN_PHRASES='["guaranteed","risk-free"]'` in `.env` to override. No special config needed — Pydantic handles `list[str]` automatically.
  - [x] In `sanitization.py`: import settings, use `settings.FORBIDDEN_PHRASES` to build patterns
  - [x] Compile `_COMPILED_PATTERNS` at module load time from settings-based list
  - [x] Keep `re.IGNORECASE` flag on all patterns

- [x] Enhance `sanitization.py` with structured audit logging (AC: #2, #3, #6)
  - [x] **Remove `Final` from `FORBIDDEN_PHRASES`** — change `FORBIDDEN_PHRASES: Final = [...]` to `FORBIDDEN_PHRASES = [...]` so it can be reassigned from settings at module load
  - [x] Add required imports: `import json` and `from datetime import datetime, timezone` for structured audit logging
  - [x] Add `SanitizationResult(BaseModel)`: `content: str`, `is_redacted: bool`, `redacted_phrases: list[str]` — use Pydantic BaseModel (not dataclass) per project conventions
  - [x] Add `SanitizationContext(BaseModel)`: `debate_id: str`, `agent: str`, `turn: int` — minimal context, no over-engineering
  - [x] Implement two-pass matching in `sanitize_content()`: **Pass 1** — scan original content with all patterns to collect `redacted_phrases` list; **Pass 2** — apply `re.sub("[REDACTED]")` sequentially (existing behavior)
  - [x] Add `sanitize_content(content: str, context: SanitizationContext | None = None) -> SanitizationResult` — new function that accepts optional context for structured logging
  - [x] When context provided, log structured JSON: `logger.warning(json.dumps({"event": "forbidden_phrase_redacted", "source": "safety_net", "debate_id": ..., "agent": ..., "turn": ..., "phrase": ..., "timestamp": ...}))`
  - [x] When context not provided (guardian case), use existing simple `logger.warning(f"Redacted forbidden phrase: {phrase}")` — backward compatible
  - [x] Keep `sanitize_response()` as backward-compatible wrapper that returns `str` — implementation: `return sanitize_content(content).content`
  - [x] Handle `None` input: `sanitize_content(None)` returns `SanitizationResult(content="", is_redacted=False, redacted_phrases=[])` — never raises
  - [x] Handle empty/whitespace-only strings as no-op

- [x] Add `isRedacted` field to `ArgumentCompletePayload` (AC: #4)
  - [x] In `ws_schemas.py`: add `is_redacted: bool = Field(default=False, serialization_alias="isRedacted")` to `ArgumentCompletePayload`
  - [x] `model_config = ConfigDict(populate_by_name=True)` **already exists** at line 55 — no need to add it, just verify it's there
  - [x] **CRITICAL REFACTOR:** `send_argument_complete()` in `streaming.py` refactored to use `ArgumentCompletePayload` Pydantic model
  - [x] Update `send_argument_complete()` signature to accept `is_redacted: bool = False` parameter
  - [x] Include `isRedacted` in the WebSocket action payload via the Pydantic model's `by_alias=True` serialization

- [x] Wire sanitization into `engine.py` with correct data flow (AC: #2, #4, #8)
  - [x] Import `sanitize_content` and `SanitizationContext` in `engine.py`
  - [x] In `bull_agent_node()`: after `result = await agent.generate(state)`, sanitize content and pass `is_redacted` to `send_argument_complete`
  - [x] In `bear_agent_node()`: identical pattern for bear agent
  - [x] **In `stream_debate()` main loop:** Store both raw and sanitized content in `turn_arguments` as tuple
  - [x] **Reasoning node `summary`:** Use `sanitized_result.content[:100]` for the displayed summary label
  - [x] **Winning re-render loop:** Store both raw AND sanitized content in `turn_arguments` as a tuple, use `sanitized[:100]` for the re-render summary.
  - [x] **CRITICAL:** Default fallback changed from `""` to `("", "")` to match tuple format
  - [x] Do NOT filter individual tokens in `TokenStreamingHandler` — redaction is only at argument-complete level (AC #5)

- [x] Log high-redaction warning (AC: #9)
  - [x] After sanitization in bull/bear nodes: if `len(sanitization_result.redacted_phrases) > 2` OR redacted character count > 50% of original, log `logger.warning` with `{"event": "high_redaction_warning", ...}`
  - [x] This signals a prompt-engineering failure that needs attention

- [x] Update `guardian.py` to use enhanced sanitization (AC: #7)
  - [x] Verify `guardian.py` still calls `sanitize_response()` — no changes needed since backward-compatible wrapper is kept
  - [x] Optionally: update guardian to use `sanitize_content()` with context for richer audit logs

- [x] Expand forbidden phrase list (AC: #2)
  - [x] Add additional promissory phrases to the configurable default list: `"can't lose"`, `"foolproof"`, `"no-brainer"`, `"bulletproof"`, `"surefire"`, `"cannot fail"`, `"double your"`, `"moonshot"`, `"to the moon"`
  - [x] Ensure all patterns are case-insensitive (already handled by `re.IGNORECASE`)

- [x] Write unit tests (Pytest)
  - [x] **NOTE: Existing tests in `test_agents.py` (lines 128-186):** `TestSanitizeResponse` (5 tests) and `TestSanitizeResponseCaseInsensitivity` (5 tests) already test `sanitize_response()`. Since `sanitize_response()` becomes a wrapper for `sanitize_content()`, these tests should continue to pass — DO NOT remove them. The new test file `test_sanitization.py` should focus on the new `sanitize_content()` function and `SanitizationResult` model.
  - [x] `[2-4-UNIT-001]` @p0 `sanitize_content()` redacts "guaranteed" → `[REDACTED]`, returns `is_redacted=True`
  - [x] `[2-4-UNIT-002]` @p0 `sanitize_content()` redacts multiple phrases in one text
  - [x] `[2-4-UNIT-003]` @p0 `sanitize_content()` is case-insensitive ("GUARANTEED", "Guaranteed", "guaranteed" all redacted)
  - [x] `[2-4-UNIT-004]` @p0 `sanitize_content()` returns `is_redacted=False` for clean text
  - [x] `[2-4-UNIT-005]` @p0 `sanitize_content()` with context logs structured JSON with debate_id, agent, turn
  - [x] `[2-4-UNIT-006]` @p0 `sanitize_content()` without context uses simple log format (backward compat)
  - [x] `[2-4-UNIT-007]` @p0 `sanitize_response()` backward compat — still returns `str`, not BaseModel
  - [x] `[2-4-UNIT-008]` @p1 New phrases ("can't lose", "foolproof", "no-brainer") are redacted
  - [x] `[2-4-UNIT-009]` @p0 `sanitize_content()` handles `None` input — returns empty `SanitizationResult`, never raises
  - [x] `[2-4-UNIT-010]` @p0 `sanitize_content()` handles empty string and whitespace-only string as no-op
  - [x] `[2-4-UNIT-011]` @p1 `SanitizationResult.redacted_phrases` lists all phrases that were redacted (verifies two-pass matching)
  - [x] `[2-4-UNIT-012]` @p0 Partial matches in longer words are NOT redacted (e.g., "guarantor" should NOT be redacted for "guaranteed")
  - [x] `[2-4-UNIT-013]` @p0 Forbidden phrase at string boundaries: phrase at position 0 and at end of string
  - [x] `[2-4-UNIT-014]` @p0 Content that is ONLY a forbidden phrase — entire content becomes `[REDACTED]`
  - [x] `[2-4-UNIT-015]` @p0 Punctuation adjacency: "guaranteed!" and "guaranteed." are redacted
  - [x] `[2-4-UNIT-016]` @p0 Hyphenated context: "non-guaranteed" — does not redact (no false positive on "guaranteed" substring in hyphenated compound)
  - [x] `[2-4-UNIT-017]` @p0 Phrase "100%" redacts correctly with `re.escape` handling
  - [x] `[2-4-UNIT-018]` @p0 `SanitizationResult` is a Pydantic `BaseModel` — verify isinstance check
  - [x] `[2-4-UNIT-019]` @p0 Two phrases appearing together (e.g., "guaranteed sure thing") — both redacted without double-redaction artifacts
  - [x] `[2-4-UNIT-020]` @p0 Configurable phrase list: when settings provide custom list, it overrides defaults
  - [x] `[2-4-UNIT-021]` @p0 Empty phrase list — `sanitize_content()` returns content unchanged, `is_redacted=False`
  - [x] `[2-4-UNIT-022]` @p1 `argument_content[:100]` truncation does not split mid-`[REDACTED]` — verify summary quality

- [x] Write engine integration tests (Pytest)
  - [x] `[2-4-INT-001]` @p0 `bull_agent_node` with forbidden phrase in output → `send_argument_complete` receives redacted content + `is_redacted=True`
  - [x] `[2-4-INT-002]` @p0 `bear_agent_node` with forbidden phrase → same redaction
  - [x] `[2-4-INT-003]` @p0 `bull_agent_node` with clean output → `is_redacted=False`, content unchanged
  - [x] `[2-4-INT-004]` @p1 Token streaming is NOT affected — tokens still flow unfiltered even when final argument contains forbidden phrases
  - [x] `[2-4-INT-005]` @p0 `ArgumentCompletePayload` serializes `isRedacted` (not `is_redacted`) in JSON output — **contract test verifying exact JSON key**
  - [x] `[2-4-INT-006]` @p0 Reasoning node summary (first 100 chars) uses sanitized content, NOT raw content
  - [x] `[2-4-INT-007]` @p0 `turn_arguments` stores raw (unsanitized) content — verify reasoning context preservation
  - [x] `[2-4-INT-008]` @p0 LLM returns empty response → sanitization handles gracefully, no crash
  - [x] `[2-4-INT-009]` @p0 High-redaction scenario (>50% redacted) → warning logged
  - [x] `[2-4-INT-010]` @p1 Performance guard: sanitization of 2000-char text with full phrase list completes in <10ms

## Dev Notes

### Defense-in-Depth Strategy

This story implements a **two-layer defense** against promissory language:

| Layer | Mechanism | Scope | Effectiveness |
|-------|-----------|-------|---------------|
| **Primary** | System prompt prohibition (AC #1) | Prevents generation at source | High for common phrases, not guaranteed |
| **Safety Net** | Regex post-hoc filter (AC #2) | Catches phrases that slip through | Deterministic for known phrases |

Any redaction by the safety-net layer indicates a **prompt engineering failure** — the agent generated prohibited language despite instructions. Redaction logs should be monitored and prompts improved when patterns emerge.

### Critical: Build on Existing Code — DO NOT Reinvent

The `sanitization.py` file **already exists** at `app/services/debate/sanitization.py` with:
- `FORBIDDEN_PHRASES` list (7 phrases) — **NOTE: typed `Final`, must remove for configurability**
- Pre-compiled `_COMPILED_PATTERNS` with `re.IGNORECASE`
- `sanitize_response(content: str) -> str` that replaces phrases with `[REDACTED]`
- `logger.warning(f"Redacted forbidden phrase: {phrase}")` audit logging

It is currently called inside `guardian.py` (lines 136-141) to sanitize the **guardian's own output**. It is also called inside `bull.py` (line 58) and `bear.py` (line 58) to sanitize agent output **before** it reaches the engine.

**CRITICAL ARCHITECTURE CHANGE:** This story must REMOVE `sanitize_response()` calls from `bull.py:58` and `bear.py:58` and move sanitization to `engine.py`. If the agents sanitize internally, the engine will always see clean text, making `is_redacted` always `False` and structured audit logging useless. The safety-net layer must run in the engine on raw content.

**Known out-of-scope gap:** `guardian.py` sanitizes `reason` and `detailed_reasoning` but does NOT sanitize `summary_verdict`. If the guardian LLM produces a forbidden phrase in the verdict, it passes through unfiltered. This is acceptable for this story but should be noted for future improvement.

### Data Flow Architecture — CRITICAL

This is the most important design decision in this story. The sanitization pipeline has **two output paths** that must be handled differently:

```
LLM Output (raw)
    │
    ├─→ sanitize_content() ─→ sanitized_content
    │                           │
    │                           ├─→ send_argument_complete(sanitized_content, is_redacted=True/False)
    │                           │       └─→ WebSocket: DEBATE/ARGUMENT_COMPLETE (frontend sees [REDACTED])
    │                           │
    │                           └─→ send_reasoning_node(summary=sanitized_content[:100])
    │                                   └─→ Reasoning graph label (frontend sees [REDACTED])
    │
    └─→ raw_content
            │
            └─→ turn_arguments[(agent, turn)] = (raw_content, sanitized_content)
                    │
                    ├─→ Guardian analysis uses raw_content from state messages (already in current_state)
                    │
                    └─→ Winning re-render uses sanitized_content[:100] for summary
```

**Why preserve raw content in `turn_arguments`?**
- The reasoning/summary pipeline needs to understand what was actually said
- `[REDACTED]` fragments in LLM context produce degraded analysis quality
- The guardian agent receives raw content via `current_state["messages"]` which is separate from `turn_arguments`

**Why use sanitized content for reasoning node labels?**
- The reasoning graph is visible to users in the frontend
- Node labels should match what the argument bubble displays (sanitized)

### Key Integration Points in engine.py

Bull agent node (`engine.py:80-98`):
```python
result = await agent.generate(state)
# ^^^ Line 85 — tokens already streamed via TokenStreamingHandler

raw_content = result["messages"][-1]["content"]
sanitization_result = sanitize_content(raw_content, SanitizationContext(...))

if manager and debate_id:
    await send_argument_complete(
        manager, debate_id, "bull",
        sanitization_result.content,  # SANITIZED
        result["current_turn"],
        is_redacted=sanitization_result.is_redacted,
    )
```

Bear agent node (`engine.py:101-124`): identical pattern for bear.

**In `stream_debate()` main loop:**
```python
# Line 272-273: Store BOTH raw and sanitized
argument_content = result["messages"][-1]["content"]  # raw
sanitized_content = sanitize_content(argument_content, SanitizationContext(...))
turn_arguments[(current_agent, result["current_turn"])] = (argument_content, sanitized_content)

# Line 281: Reasoning node label uses SANITIZED
await send_reasoning_node(..., summary=sanitized_content[:100], ...)
```

**In winning re-render loop (lines 464-477):**
```python
# Use sanitized content from stored tuple
raw, sanitized = turn_arguments.get((agent, turn), ("", ""))
await send_reasoning_node(..., summary=sanitized[:100], ...)
```

### Token Streaming — Known Limitation

`TokenStreamingHandler.on_llm_new_token()` (`streaming.py:121-135`) sends individual tokens via `DEBATE/TOKEN_RECEIVED`. Filtering individual tokens is unreliable because:
- A forbidden phrase like "guaranteed" could be split across multiple tokens ("guar", "antee", "d")
- Token-level filtering would add latency to every token
- The complete argument is always sent via `DEBATE/ARGUMENT_COMPLETE` which is the proper filter point

**Approach:** Let tokens stream unfiltered. Apply the filter ONLY at `send_argument_complete` time. The frontend receives the redacted complete argument and replaces any previously rendered tokens.

**Known limitation acknowledged in AC #5:** Users may briefly see forbidden phrases during streaming before `ARGUMENT_COMPLETE` replaces them. This is acceptable because:
1. Prompt-level prevention (AC #1) is the primary defense — phrases should rarely appear
2. The `ARGUMENT_COMPLETE` message is the canonical content — the frontend replaces the streaming view
3. Token-level filtering would compromise real-time UX for all users

### Two-Pass Matching for `redacted_phrases` Tracking

The existing code loops `_COMPILED_PATTERNS` calling `re.sub()` sequentially. To populate `redacted_phrases`, we need a **two-pass approach**:

```python
def sanitize_content(content: str, context: SanitizationContext | None = None) -> SanitizationResult:
    if not isinstance(content, str):
        return SanitizationResult(content="", is_redacted=False, redacted_phrases=[])

    matched_phrases = []
    # Pass 1: detect which phrases match (on original content)
    for phrase, pattern in zip(FORBIDDEN_PHRASES, _COMPILED_PATTERNS):
        if pattern.search(content):
            matched_phrases.append(phrase)

    # Pass 2: replace all matched phrases
    sanitized = content
    for phrase, pattern in zip(FORBIDDEN_PHRASES, _COMPILED_PATTERNS):
        sanitized = pattern.sub("[REDACTED]", sanitized)

    # Log based on context availability
    for phrase in matched_phrases:
        if context:
            logger.warning(json.dumps({...structured...}))
        else:
            logger.warning(f"Redacted forbidden phrase: {phrase}")

    return SanitizationResult(
        content=sanitized,
        is_redacted=len(matched_phrases) > 0,
        redacted_phrases=matched_phrases,
    )
```

Pass 1 runs `search()` against the *original* content for each pattern independently. Pass 2 runs `sub()` sequentially as before. This avoids the problem where sequential substitution corrupts subsequent pattern detection.

### WebSocket Contract Policy

All WebSocket payload changes are **additive-only**. Adding `isRedacted` to `DEBATE/ARGUMENT_COMPLETE` does not break existing clients because:
- The field has a default value (`false`)
- Clients must handle unknown fields gracefully (standard JSON parsing)
- No fields are removed or renamed
- The `type` field remains unchanged

This additive-only policy should be documented in the project's architecture docs. Future payload changes should follow the same pattern.

### Structured Audit Logging (NFR-09)

Current: `logger.warning(f"Redacted forbidden phrase: {phrase}")`

Enhanced (when context available):
```python
logger.warning(json.dumps({
    "event": "forbidden_phrase_redacted",
    "source": "safety_net",
    "debate_id": context.debate_id,
    "agent": context.agent,
    "turn": context.turn,
    "phrase": phrase,
    "timestamp": datetime.now(timezone.utc).isoformat(),
}))
```

This satisfies NFR-09 tamper-evident logging with structured, queryable audit records.

### Backward Compatibility with guardian.py

`guardian.py` calls `sanitize_response()` at lines 136-141:
```python
result.reason = sanitize_response(result.reason)
result.detailed_reasoning = sanitize_response(result.detailed_reasoning)
```

This must continue to work. The wrapper:
```python
def sanitize_response(content: str) -> str:
    return sanitize_content(content).content
```

Zero risk of breaking guardian — same function signature, same return type.

### Backward Compatibility with bull.py / bear.py — CRITICAL CHANGE

`bull.py` and `bear.py` currently call `sanitize_response()` at line 58:
```python
content = sanitize_response(raw_content)
```

**These calls MUST be removed.** The agents must return raw content so the engine can apply `sanitize_content()` with structured audit logging and `is_redacted` tracking. If agents sanitize internally, the engine always sees clean text → `is_redacted=False` → safety-net layer is useless.

After removal, the line becomes:
```python
content = raw_content
```

The import `from ...sanitization import sanitize_response` should also be removed from both files.

### `isRedacted` Field Design (Story 2.5 Dependency)

Story 2.5 (Moderation Transparency) needs to know if a message was redacted. Add the field now:
```python
class ArgumentCompletePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)  # ALREADY EXISTS at ws_schemas.py:55 — verify, don't add duplicate

    debate_id: str = Field(serialization_alias="debateId")
    agent: str
    content: str
    turn: int | None = None
    is_redacted: bool = Field(default=False, serialization_alias="isRedacted")
```

This serializes to `"isRedacted": true` in the WebSocket JSON, following the camelCase convention. The `populate_by_name=True` config is already present on the existing model — just verify it's there.

**CRITICAL:** `send_argument_complete()` in `streaming.py` currently constructs a **raw dict** instead of using this Pydantic model. It must be refactored to use `ArgumentCompletePayload` with `.model_dump(by_alias=True)`. Without this refactor, adding the field to the Pydantic model has no effect on WebSocket output.

### `SanitizationResult` and `SanitizationContext` as Pydantic BaseModel

Per project conventions (Pydantic 2.0+ everywhere), these must be `BaseModel` subclasses, not plain `@dataclass`:
- Enables runtime validation
- Consistent with project patterns
- Supports future serialization needs
- Integrates with FastAPI response models if needed

### Regex Safety: Word Boundaries

The existing `_COMPILED_PATTERNS` use `re.escape(phrase)` which matches substrings. Consider whether "guarantor" should be redacted (contains "guaranteed" substring? No — "guarantor" doesn't contain "guaranteed"). But `"100%"` with `re.escape` becomes `100\%` which is fine for exact substring matching.

**Known limitation:** Multi-word phrases like `"risk-free"` will NOT match `"risk free"` or `"risk - free"` (whitespace/hyphen variants). The `re.escape()` approach matches exact character sequences only. This is acceptable for MVP — the phrase list contains precise formulations that LLMs are likely to use.

**Known limitation:** No contextual understanding. "There's no surefire way to predict markets" will have "surefire" redacted. This is a false positive. Acceptable trade-off for deterministic compliance filtering.

**Known limitation:** English-only. If agents respond in other languages, the phrase list is ineffective. Not in scope for this story.

### Phrase List Governance

The forbidden phrase list is a **living document** that compliance teams need to update. The configurable source (AC #11) enables:
- Environment-specific phrase lists (dev vs production)
- Updates without code deployment
- Future migration to database-backed storage
- Audit trail of phrase list changes via config management

### File List (Planned)

**MODIFY:**
- `trade-app/fastapi_backend/app/services/debate/sanitization.py` — enhance with structured logging, Pydantic result types, two-pass matching, configurable phrase list, remove `Final` annotation, add `json`/`datetime` imports
- `trade-app/fastapi_backend/app/services/debate/engine.py` — wire sanitization into bull/bear nodes with correct data flow (raw vs sanitized), change `turn_arguments` to store tuples
- `trade-app/fastapi_backend/app/services/debate/ws_schemas.py` — add `is_redacted` to `ArgumentCompletePayload` (verify `populate_by_name=True` already exists)
- `trade-app/fastapi_backend/app/services/debate/streaming.py` — refactor `send_argument_complete()` to use `ArgumentCompletePayload` Pydantic model (currently raw dict), add `is_redacted` param
- `trade-app/fastapi_backend/app/services/debate/agents/bull.py` — **REMOVE** `sanitize_response` import and call (line 6, line 58); add forbidden phrase prohibition to system prompt
- `trade-app/fastapi_backend/app/services/debate/agents/bear.py` — **REMOVE** `sanitize_response` import and call (line 6, line 58); add forbidden phrase prohibition to system prompt (bear currently LACKS the "NEVER say" instruction)
- `trade-app/fastapi_backend/app/config.py` — add configurable `FORBIDDEN_PHRASES: list[str]` setting with default list

**NEW:**
- `trade-app/fastapi_backend/tests/services/debate/test_sanitization.py` — unit tests for enhanced sanitization

### Scope Boundary

**DO NOT modify:**
- `guardian.py` (unless opting into richer logging — optional)
- `TokenStreamingHandler` — no token-level filtering
- Frontend code — Story 2.5 handles the UI badge
- Existing tests in `test_agents.py` (lines 128-186) — they test `sanitize_response()` which remains as backward-compatible wrapper

**This story touches:**
- `sanitization.py` (enhance — remove `Final`, add models, add imports)
- `engine.py` (add sanitization calls with correct data flow, change `turn_arguments` to tuples)
- `ws_schemas.py` (add 1 field, verify existing config)
- `streaming.py` (refactor to use Pydantic model, add 1 parameter)
- `bull.py` / `bear.py` (**REMOVE** `sanitize_response` import and call; system prompt text only)
- `config.py` (add configurable phrase list)
- New test file

### Previous Story Intelligence

**From Story 2-3 (Guardian UI Overlay):**
- Frontend `DebateStream.tsx` handles `DEBATE/ARGUMENT_COMPLETE` messages and renders argument bubbles
- The frontend already has `ArgumentMessage` type — adding `isRedacted` field to the WS payload means the frontend type will need updating (but that's Story 2.5's scope)
- Guardian overlay uses Violet-600 styling — the "Moderated" badge from Story 2.5 will also use this color

**From Story 2-2 (Debate Engine Integration):**
- `engine.py` already has the bull/bear agent node structure with `send_argument_complete` calls
- The `turn_arguments` dict stores argument content for later use — **store both raw and sanitized**
- Guardian analysis happens AFTER argument is generated — the filter should apply BEFORE the argument is sent via WebSocket

**From Story 2-1 (Guardian Agent Logic):**
- `guardian.py` already imports and uses `sanitize_response` from `sanitization.py`
- The guardian's own output is already sanitized — this story extends sanitization to bull/bear outputs

### Architecture Compliance

- **Service Layer:** Sanitization logic stays in `services/debate/sanitization.py` — not in routes
- **Pydantic Models:** `SanitizationResult` and `SanitizationContext` use `BaseModel` per project conventions
- **Naming:** Python `snake_case` internally (`is_redacted`), Pydantic serialization alias for `isRedacted` field. **Consistent naming:** use `is_redacted` everywhere in Python code, never `was_redacted`.
- **WebSocket Actions:** `DEBATE/ARGUMENT_COMPLETE` payload gets new field — additive-only, no new action type needed
- **Error Handling:** Sanitization never raises — always returns content (with or without redaction)
- **Logging:** Structured JSON logging for audit, simple format for backward compat. Redaction events logged as `"source": "safety_net"` to indicate prompt-level prevention was bypassed.
- **Testing:** Pytest with `pytest-asyncio`, mock LLM outputs, no external service calls
- **Configuration:** Phrase list from settings, not hardcoded

### References

- [Source: epics.md#Story 2.4 — Forbidden Phrase Filter (Regex)]
- [Source: prd.md#FR-08 — Forbidden Phrase Filter]
- [Source: prd.md#NFR-09 — Tamper-Evident Logging]
- [Source: architecture.md#Component Boundaries — Agents pure Python, Services handle business logic]
- [Source: architecture.md#Communication Patterns — WebSocket Actions with camelCase payload]
- [Source: architecture.md#The "Border Control" Pattern — snake_case backend, camelCase API output]
- [Source: architecture.md#Security — Guardian agent must filter output before WebSocket stream]
- [Source: architecture.md#Regulatory — "No Advice" boundary requires Deterministic Safety Layer outside LLM]
- [Source: ux-design-specification.md#Safety is Loud — Risk warnings must be visually distinct]
- [Source: ux-design-specification.md#Trust Framing — Frame success as "Risk Avoided"]
- [Source: sanitization.py:7-15 — `FORBIDDEN_PHRASES: Final` with 7 phrases, `Final` annotation must be removed]
- [Source: sanitization.py:17-19 — `_COMPILED_PATTERNS` pre-compiled with `re.IGNORECASE`]
- [Source: sanitization.py:22-42 — `sanitize_response()` function — keep as backward-compatible wrapper]
- [Source: bull.py:6 — `from ...sanitization import sanitize_response` — REMOVE this import]
- [Source: bull.py:16 — "NEVER say guaranteed or risk-free" — already exists in bull prompt]
- [Source: bull.py:58 — `content = sanitize_response(raw_content)` — REMOVE this call]
- [Source: bear.py:6 — `from ...sanitization import sanitize_response` — REMOVE this import]
- [Source: bear.py:11-26 — `BEAR_SYSTEM_PROMPT` LACKS "NEVER say" instruction — must add]
- [Source: bear.py:58 — `content = sanitize_response(raw_content)` — REMOVE this call]
- [Source: engine.py:89-95 — Bull agent node, `send_argument_complete` integration point]
- [Source: engine.py:115-121 — Bear agent node, `send_argument_complete` integration point]
- [Source: engine.py:272-273 — `argument_content` stored in `turn_arguments` as plain string — change to tuple]
- [Source: engine.py:281 — reasoning node `summary=argument_content[:100]` — change to sanitized]
- [Source: engine.py:464-477 — Winning re-render loop reads from `turn_arguments` — update default to `("", "")`]
- [Source: streaming.py:121-135 — `TokenStreamingHandler.on_llm_new_token()` — DO NOT filter]
- [Source: streaming.py:213-230 — `send_argument_complete()` — uses raw dict, refactor to Pydantic model, add `is_redacted` param]
- [Source: ws_schemas.py:52-60 — `ArgumentCompletePayload` — add `is_redacted` field, `populate_by_name=True` already present]
- [Source: guardian.py:136-141 — Existing `sanitize_response()` usage on guardian output — DO NOT CHANGE]
- [Source: guardian.py:107-143 — Guardian `summary_verdict` NOT sanitized — known gap, out of scope]
- [Source: config.py:6-69 — `Settings(BaseSettings)` — add `FORBIDDEN_PHRASES: list[str]` field]
- [Source: test_agents.py:128-186 — Existing `TestSanitizeResponse` + `TestSanitizeResponseCaseInsensitivity` — DO NOT REMOVE]
- [Source: project-context.md — Pytest, strict typing, Pydantic 2.0+, async/await mandatory, no blocking code]

### Adversarial Review Record

This story was reviewed via Party Mode with the following agents:

| Agent | Key Findings |
|-------|-------------|
| 🏗️ Winston (Architect) | Token-level visibility gap, `turn_arguments` data integrity risk, `SanitizationContext` over-engineering, regex fragility |
| 💻 Amelia (Developer) | `turn_arguments` divergent content path, `was_redacted`/`is_redacted` naming inconsistency, `SanitizationResult` must be `BaseModel`, `populate_by_name=True` missing, two-pass matching needed for `redacted_phrases`, whitespace variance in multi-word phrases |
| 🧪 Murat (Test Architect) | Regex boundary undertesting, zero WebSocket contract tests, backward compat should be P0, no failure path tests, no performance guard, no mutation testing strategy |
| 📋 John (PM) | Prevention-first strategy missing, no AC for heavily-redacted arguments, no phrase list governance, false-positive limitation unaddressed, UX implications of streaming leak |

**Resolution summary:** All findings addressed. New ACs added (#1, #8, #9, #10, #11). Data flow architecture explicitly documented. Test plan expanded from 18 to 32 tests. Prompt hardening added as primary defense layer. Phrase list made configurable. Known limitations documented in dedicated sections.

## Dev Agent Record

### Agent Model Used

GLM-5.1

### Debug Log References

No debug issues encountered during implementation.

### Completion Notes List

- Implemented two-layer defense: primary (prompt prohibition) + safety-net (regex post-hoc filter)
- Enhanced `sanitization.py` with `SanitizationResult`/`SanitizationContext` Pydantic models, two-pass matching, structured JSON audit logging
- Moved sanitization from bull/bear agents to engine.py for proper `is_redacted` tracking and audit logging
- Refactored `send_argument_complete()` from raw dict to `ArgumentCompletePayload` Pydantic model with `is_redacted`/`isRedacted` field
- Made forbidden phrase list configurable via `config.py` Settings with env var override support
- Expanded phrase list from 7 to 16 phrases
- `turn_arguments` now stores `(raw_content, sanitized_content)` tuples for correct data flow
- All 15 existing backward-compat tests pass unchanged (guardian.py uses `sanitize_response()` wrapper)
- 33 new unit tests + 9 integration tests = 42 new tests, all passing
- High-redaction warning logged when >2 phrases or >50% content redacted
- No changes to guardian.py, TokenStreamingHandler, or frontend code

### File List

**MODIFIED:**
- `trade-app/fastapi_backend/app/services/debate/sanitization.py`
- `trade-app/fastapi_backend/app/services/debate/engine.py`
- `trade-app/fastapi_backend/app/services/debate/ws_schemas.py`
- `trade-app/fastapi_backend/app/services/debate/streaming.py`
- `trade-app/fastapi_backend/app/services/debate/agents/bull.py`
- `trade-app/fastapi_backend/app/services/debate/agents/bear.py`
- `trade-app/fastapi_backend/app/config.py`

**NEW:**
- `trade-app/fastapi_backend/tests/services/debate/test_sanitization.py`
- `trade-app/fastapi_backend/tests/services/debate/test_sanitization_integration.py`

### Change Log

- 2026-04-11: Story 2.4 implementation complete — forbidden phrase filter with two-layer defense, structured audit logging, configurable phrase list, `isRedacted` WebSocket field, 42 new tests
