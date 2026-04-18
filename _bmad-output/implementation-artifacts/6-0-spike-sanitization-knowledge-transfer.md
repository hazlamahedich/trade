# Spike: Sanitization & Guardian Knowledge Transfer

**Date:** 2026-04-18
**Owner:** Charlie + Elena
**Status:** Complete
**Purpose:** Pairing session reference for understanding the sanitization layer, Guardian detection, and NFR-09 architecture. This document is the walkthrough guide.

---

## Architecture Overview

```
User submits debate topic
        │
        ▼
  ┌─────────────┐
  │ Debate Engine │ (engine.py - stream_debate)
  └──────┬──────┘
         │
         ├──► Bull Agent generates argument
         │         │
         │         ▼
         │   ┌──────────────┐
         │   │ Sanitization  │ (sanitization.py)
         │   │ Layer         │
         │   │               │
         │   │ Input: raw text + context
         │   │ Output: SanitizationResult
         │   │   - content (redacted)
         │   │   - is_redacted (bool)
         │   │   - redacted_phrases (list)
         │   │   - redaction_ratio (float)
         │   └──────┬───────┘
         │          │
         │          ├──► Sanitized text → WebSocket → User UI
         │          └──► Raw text → preserved for Guardian
         │
         ├──► Bear Agent generates argument
         │         │
         │         ▼
         │   [Same sanitization flow]
         │
         └──► Guardian Agent analyzes (after each turn)
                   │
                   ▼
             ┌──────────────┐
             │ Guardian      │ (guardian.py)
             │ Agent         │
             │               │
             │ Input: full DebateState
             │   - ALL messages (including raw)
             │   - market_context
             │   - current_turn
             │               │
             │ Output: GuardianAnalysisResult
             │   - should_interrupt (bool)
             │   - risk_level (low/med/high/critical)
             │   - fallacy_type (5 categories or None)
             │   - reason (str)
             │   - summary_verdict (Wait/Caution/High Risk)
             │   - safe (bool)
             │   - detailed_reasoning (str)
             └──────┬───────┘
                    │
                    ├── should_interrupt=True?
                    │     ├── YES → WebSocket: DEBATE/GUARDIAN_INTERRUPT
                    │     │        → Pause debate
                    │     │        → If critical → END debate
                    │     └── NO  → WebSocket: "Guardian: Safe"
                    │
                    └── At debate end → Final verdict
                          → WebSocket: DEBATE/GUARDIAN_VERDICT
```

---

## Layer 1: Sanitization (sanitization.py)

### What It Does

Regex-based text filter that catches **forbidden financial promises**. This is NOT hallucination detection — it's a compliance safety net.

### Forbidden Phrases (16 total)

| Category | Phrases |
|----------|---------|
| Guarantees | `guaranteed`, `risk-free`, `safe bet`, `sure thing`, `100%`, `certainly will` |
| Overconfidence | `always goes`, `can't lose`, `foolproof`, `no-brainer`, `bulletproof`, `surefire` |
| Reckless advice | `cannot fail`, `double your`, `moonshot`, `to the moon` |

### Key Code Walkthrough

**1. Pattern Compilation (module load time)**
```python
_COMPILED_PATTERNS = [
    re.compile(rf"\b{re.escape(phrase)}\b", re.IGNORECASE)
    for phrase in _DEFAULT_PHRASES
]
```
- `\b` word boundaries prevent partial matches ("guarantor" won't match "guaranteed")
- Case-insensitive
- Compiled once, reused for all calls

**2. Core Function: `sanitize()`**
```python
def sanitize(content: str, context: SanitizationContext | None = None) -> SanitizationResult:
```
- Takes raw text + optional context (debate_id, agent, turn)
- Returns `SanitizationResult` with redacted content + metadata
- Logs structured JSON if context is provided

**3. Two-Layer Defense Design**
```
Layer 1: LLM System Prompt → "Do not make financial promises" (soft, sometimes fails)
Layer 2: Regex sanitization.py → Hard filter, always catches known phrases (reliable)
```

The LLM prompt prohibition is the first line of defense. The regex is the safety net. Both run independently.

**4. ArgumentEntry Pattern**
```python
class ArgumentEntry(NamedTuple):
    raw: str        # Unsantized — for Guardian analysis only
    sanitized: str  # Safe — for user display via WebSocket
```
The engine preserves BOTH versions. The raw text goes to the Guardian for accurate risk analysis. The sanitized text goes to the user.

### Where Sanitization Integrates

| Location | When | What |
|----------|------|------|
| `engine.py` — bull/bear agent nodes | After each agent generates | Batch sanitization of full argument |
| `streaming.py` — TokenStreamingHandler | During token streaming | Incremental sanitization of accumulated tokens |
| `guardian.py` — Guardian output | After Guardian generates | Sanitize Guardian's own reason/reasoning fields |

### Token Streaming Sanitization (tricky part)

The streaming handler can't sanitize per-chunk (a forbidden phrase might span two chunks). Instead:

1. Accumulate ALL tokens in a buffer
2. On each flush (threshold: 80 chars), sanitize the ENTIRE accumulated text
3. Emit only the NEW portion (track `_sanitized_sent` offset)
4. Use `_TAIL_OVERLAP = 20` chars to handle length changes from redaction

This is documented in AGENTS.md Lesson #6.

---

## Layer 2: Guardian Agent (guardian.py)

### What It Does

LLM-based risk analyzer that evaluates debate arguments for fallacies, overconfidence, and dangerous advice. This IS hallucination detection (in the sense of detecting misleading/unsupported claims).

### Key Model: Google Gemini via LangChain

```python
self.llm = llm_provider.get_model(
    model_name=settings.guardian_llm_model,
    temperature=settings.guardian_llm_temperature  # 0.3 — conservative
)
self.structured_llm = self.llm.with_structured_output(GuardianAnalysisResult)
```

Low temperature (0.3) for consistent risk assessment.

### Guardian System Prompt (key instructions)

The Guardian is instructed to:
- Prioritize **capital preservation** above all
- Analyze the **MOST RECENT** argument (not all past arguments)
- Cross-reference against **market data** (RSI, SMA, MACD, Bollinger Bands, ATR)
- Validate **technical indicator accuracy** (are the numbers being used correctly?)
- Account for **forex-specific risks** (leverage, pip values, spread costs)

### Fallacy Detection Categories

| Fallacy Type | What It Catches |
|-------------|-----------------|
| `unsubstantiated_claim` | Assertions without data backing ("this stock will double") |
| `confirmation_bias` | Cherry-picking favorable data, ignoring contradictory evidence |
| `overconfidence` | Treating predictions as certainties, ignoring uncertainty |
| `cognitive_bias` | Anchoring, recency bias, sunk cost fallacy |
| `dangerous_advice` | Implied recommendations to act recklessly |

### GuardianAnalysisResult Fields (KNOW THESE)

```python
class GuardianAnalysisResult(BaseModel):
    should_interrupt: bool          # Main decision: interrupt debate?
    risk_level: str                 # "low" | "medium" | "high" | "critical"
    fallacy_type: str | None        # One of 5 categories, or None
    reason: str                     # Human-readable explanation
    summary_verdict: str            # "Wait" | "Caution" | "High Risk"
    safe: bool                      # Is the argument safe?
    detailed_reasoning: str = ""    # Extended reasoning (optional)
```

**Important:** There is NO `intervention_needed` or `reasoning` field. (AGENTS.md Lesson #4)

### Interrupt Decision Logic (engine.py)

```
After each agent turn:
  1. guardian.analyze(current_state)
  2. If should_interrupt == True:
     a. Send DEBATE/GUARDIAN_INTERRUPT via WebSocket
     b. Append to guardian_interrupts list
     c. Pause debate
     d. Wait for user acknowledgement (120s timeout)
     e. If risk_level == "critical" → END debate immediately
     f. If timeout → END debate
     g. Otherwise → Resume debate
  3. If should_interrupt == False:
     a. Send "Guardian: Safe" reasoning node

At debate completion:
  4. Final guardian analysis → DEBATE/GUARDIAN_VERDICT
```

### Critical Risk Levels

| Level | Behavior |
|-------|----------|
| `low` | Logged, no action |
| `medium` | Interrupt sent, debate pauses, user ack resumes |
| `high` | Interrupt sent, debate pauses, user ack resumes |
| `critical` | Debate ends immediately, no resume possible |

---

## Data Flow: What Gets Stored

### Currently Stored (debates table)

| Field | What | Format |
|-------|------|--------|
| `guardian_verdict` | Final verdict | String: "Wait"/"Caution"/"High Risk" |
| `guardian_interrupts_count` | How many interrupts | Integer |
| `transcript` | All messages including guardian | JSON array of {role, content} |

### NOT Currently Stored (the gap for Epic 6)

| Missing | Where It Lives Now |
|---------|-------------------|
| Individual sanitization events | Python logging only |
| Per-turn guardian analyses | In-memory, discarded |
| Fallacy types per interrupt | Embedded in transcript JSON, not queryable |
| Risk levels per turn | Same |
| Safe-argument verdicts | Not stored at all |

The hallucination log data model spike (`6-0-spike-hallucination-log-data-model.md`) designs two new tables to fill this gap: `sanitization_events` and `guardian_analyses`.

---

## Key Files Reference

| File | What It Contains | Lines to Focus On |
|------|-----------------|-------------------|
| `sanitization.py` | Forbidden phrases, sanitize(), SanitizationResult | All (clean module) |
| `guardian.py` | Guardian agent, system prompt, GuardianAnalysisResult | All |
| `engine.py` | Debate loop, sanitization integration, interrupt logic | Lines 85-198 (agent nodes), 386-501 (interrupt flow) |
| `streaming.py` | Token streaming sanitization | Lines 110-189 (TokenStreamingHandler) |
| `state.py` | DebateState TypedDict | All |
| `ws_schemas.py` | WebSocket action types (DEBATE/ prefix) | All |
| `schemas.py` | API response schemas | Guardian-related schemas |
| `models.py` | SQLAlchemy models (Debate table) | Guardian/sanitization fields |
| `config.py` | Settings (guardian model, temperature) | Guardian-related settings |

---

## Common Gotchas (from Lessons Learned)

1. **WebSocket action prefix is `DEBATE/`** — ALL actions use `DEBATE/GUARDIAN_INTERRUPT`, NOT `GUARDIAN/INTERRUPT` (Lesson #3)

2. **GuardianAnalysisResult field names** — `should_interrupt` not `intervention_needed`, `reason` not `reasoning` (Lesson #4)

3. **Token streaming sanitizes whole, emits delta** — Sanitize the ENTIRE buffer, emit only the new portion (Lesson #6)

4. **State rebuild must preserve all fields** — `guardian_interrupts` and `pause_history` must be carried forward (Lesson #1)

5. **stream_debate signature** — `stream_debate(debate_id, asset, market_context, manager, max_turns=6, stale_guardian=None)` (Lesson #8)

---

## Questions Elena Should Be Able to Answer After This Walkthrough

1. What is the two-layer defense architecture? (LLM prompt prohibition + regex safety net)
2. What does the sanitization layer catch vs. what the Guardian catches? (phrases vs. fallacies)
3. Where does the raw (unsanitized) text go and why? (Guardian needs it for accurate analysis)
4. What are the 5 fallacy types the Guardian can detect?
5. What happens when the Guardian says `should_interrupt=True` with `risk_level="critical"`? (Debate ends)
6. What data is currently persisted vs. lost? (verdict + count persisted, per-turn analyses lost)
7. Why can't token streaming sanitize per-chunk? (phrases may span chunk boundaries)
8. What is the `ArgumentEntry` pattern? (preserves both raw and sanitized versions)
