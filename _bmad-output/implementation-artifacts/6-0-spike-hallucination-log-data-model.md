# Spike: Hallucination Log Data Model for Epic 6

**Date:** 2026-04-18
**Owner:** Charlie (Senior Dev)
**Status:** Complete
**Purpose:** Audit existing sanitization layer outputs. Design structured persistence. Determine what data the 6-1 admin dashboard needs.

---

## Current State

### What Exists

#### Sanitization Layer (`app/services/debate/sanitization.py`)

- Regex-based safety net detecting **16 forbidden financial phrases**
- Produces structured `SanitizationResult` per invocation:
  ```python
  class SanitizationResult(BaseModel):
      content: str              # Redacted text
      is_redacted: bool         # True if any phrase was caught
      redacted_phrases: list[str]  # Which phrases matched
      redaction_ratio: float    # 0.0-1.0 proportion of text redacted
  ```
- Context model `SanitizationContext`: `debate_id`, `agent`, `turn`
- **Logging only** — `logging.warning()` with structured JSON. No DB persistence.

#### Guardian Agent (`app/services/debate/agents/guardian.py`)

- LLM-based risk analyzer (Google Gemini via LangChain)
- Produces structured `GuardianAnalysisResult` per analysis:
  ```python
  class GuardianAnalysisResult(BaseModel):
      should_interrupt: bool
      risk_level: Literal["low", "medium", "high", "critical"]
      fallacy_type: Literal[...] | None  # 5 categories
      reason: str
      summary_verdict: Literal["Wait", "Caution", "High Risk"]
      safe: bool
      detailed_reasoning: str = ""
  ```
- **Fallacy categories:** `unsubstantiated_claim`, `confirmation_bias`, `overconfidence`, `cognitive_bias`, `dangerous_advice`

#### What IS Persisted (in `debates` table)

| Field | Type | Content |
|-------|------|---------|
| `guardian_verdict` | String | Final verdict ("Wait"/"Caution"/"High Risk") |
| `guardian_interrupts_count` | Integer | Count only |
| `transcript` | Text | JSON array of ALL messages (including guardian), not queryable |
| `trading_analysis` | JSONB | Trading analyst output |

#### What is NOT Persisted

| Missing Data | Where It Lives Now | Why It's Lost |
|-------------|-------------------|---------------|
| Individual sanitization events | `logging.warning()` stdout | Never written to DB |
| Which forbidden phrases per turn | `SanitizationResult.redacted_phrases` | Ephemeral, attached to engine result dict |
| Redaction ratios | `SanitizationResult.redaction_ratio` | Same — never stored |
| Per-turn guardian analysis | `GuardianAnalysisResult` model_dump | Only last analysis kept in memory |
| Fallacy type per interrupt | `guardian_interrupts[]` in state | In transcript JSON, not queryable |
| Risk level per interrupt | Same | Not queryable |
| Safe-argument results (non-interrupt) | Ephemeral in engine loop | Not stored at all |
| Detailed reasoning per analysis | `analysis["detailed_reasoning"]` | Never stored anywhere |

---

## Design Decision: Two New Tables

### Rationale

The sanitization layer and Guardian agent produce different types of data at different frequencies:

- **Sanitization events** fire every token flush (multiple per turn). High volume, simple structure.
- **Guardian analyses** fire once per turn. Lower volume, richer structure.

Separate tables allow independent querying, indexing, and retention policies.

---

## Schema Design

### Table 1: `sanitization_events`

```sql
CREATE TABLE sanitization_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    agent VARCHAR(10) NOT NULL,          -- "bull" or "bear"
    turn INTEGER NOT NULL,
    redacted_phrases JSONB NOT NULL DEFAULT '[]',  -- ["guaranteed", "risk-free"]
    redaction_ratio FLOAT NOT NULL DEFAULT 0.0,    -- 0.0-1.0
    original_length INTEGER NOT NULL DEFAULT 0,    -- character count before redaction
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sanitization_events_debate ON sanitization_events(debate_id);
CREATE INDEX idx_sanitization_events_created ON sanitization_events(created_at DESC);
CREATE INDEX idx_sanitization_events_agent ON sanitization_events(agent);
```

**Design notes:**
- `original_length` enables dashboard to show "X% of arguments had redactions"
- JSONB for `redacted_phrases` allows flexible phrase list without join table
- Index on `created_at DESC` for dashboard time-series queries
- CASCADE delete — sanitization events are debate-scoped

### Table 2: `guardian_analyses`

```sql
CREATE TABLE guardian_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    turn INTEGER NOT NULL,
    analyzing_agent VARCHAR(10),          -- Which agent's argument was analyzed ("bull" or "bear")
    should_interrupt BOOLEAN NOT NULL DEFAULT FALSE,
    risk_level VARCHAR(10) NOT NULL DEFAULT 'low',  -- "low", "medium", "high", "critical"
    fallacy_type VARCHAR(30),             -- NULL if no fallacy detected
    reason TEXT NOT NULL DEFAULT '',      -- Human-readable risk explanation
    summary_verdict VARCHAR(20) NOT NULL DEFAULT 'Wait',  -- "Wait", "Caution", "High Risk"
    safe BOOLEAN NOT NULL DEFAULT TRUE,
    detailed_reasoning TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_guardian_analyses_debate ON guardian_analyses(debate_id);
CREATE INDEX idx_guardian_analyses_risk ON guardian_analyses(risk_level);
CREATE INDEX idx_guardian_analyses_fallacy ON guardian_analyses(fallacy_type) WHERE fallacy_type IS NOT NULL;
CREATE INDEX idx_guardian_analyses_created ON guardian_analyses(created_at DESC);
CREATE INDEX idx_guardian_analyses_unsafe ON guardian_analyses(safe) WHERE safe = FALSE;
```

**Design notes:**
- Partial index on `fallacy_type WHERE fallacy_type IS NOT NULL` — most turns are "safe", this makes fallacy queries fast
- Partial index on `safe = FALSE` — dashboard "show me problems" queries
- `analyzing_agent` tracks which bull/bear argument triggered this analysis
- `reason` and `detailed_reasoning` stored as TEXT for dashboard display

---

## SQLAlchemy Models

```python
# In app/models.py

class SanitizationEvent(Base):
    __tablename__ = "sanitization_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"))
    agent: Mapped[str] = mapped_column(String(10))
    turn: Mapped[int] = mapped_column(Integer)
    redacted_phrases: Mapped[list] = mapped_column(JSONB, server_default="[]")
    redaction_ratio: Mapped[float] = mapped_column(Float, server_default="0.0")
    original_length: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    debate = relationship("Debate", back_populates="sanitization_events")


class GuardianAnalysis(Base):
    __tablename__ = "guardian_analyses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"))
    turn: Mapped[int] = mapped_column(Integer)
    analyzing_agent: Mapped[str | None] = mapped_column(String(10))
    should_interrupt: Mapped[bool] = mapped_column(Boolean, server_default="false")
    risk_level: Mapped[str] = mapped_column(String(10), server_default="low")
    fallacy_type: Mapped[str | None] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(Text, server_default="")
    summary_verdict: Mapped[str] = mapped_column(String(20), server_default="Wait")
    safe: Mapped[bool] = mapped_column(Boolean, server_default="true")
    detailed_reasoning: Mapped[str] = mapped_column(Text, server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    debate = relationship("Debate", back_populates="guardian_analyses")
```

Add back-populates on `Debate` model:

```python
class Debate(Base):
    # ... existing fields ...
    sanitization_events = relationship("SanitizationEvent", back_populates="debate", cascade="all, delete-orphan")
    guardian_analyses = relationship("GuardianAnalysis", back_populates="debate", cascade="all, delete-orphan")
```

---

## Integration Points: Where to Write

### Sanitization Events — Write Point 1

**File:** `app/services/debate/engine.py` — in `bull_agent_node` and `bear_agent_node`

After sanitization produces a `SanitizationResult` with `is_redacted=True`:

```python
if sanitization_result.is_redacted:
    sanitization_event = SanitizationEvent(
        debate_id=debate_id,
        agent=current_agent,
        turn=current_turn,
        redacted_phrases=sanitization_result.redacted_phrases,
        redaction_ratio=sanitization_result.redaction_ratio,
        original_length=len(raw_content),
    )
    # Bulk insert via session or accumulate for batch write
```

### Sanitization Events — Write Point 2

**File:** `app/services/debate/streaming.py` — in `TokenStreamingHandler`

If streaming sanitization catches phrases that batch sanitization didn't (edge case):

```python
if flush_result.is_redacted and not previous_result_was_redacted:
    # Token-level redaction caught something new
    sanitization_event = SanitizationEvent(...)
```

**Recommendation:** Start with Write Point 1 only (batch sanitization in engine). Add streaming-level writes only if needed.

### Guardian Analyses — Write Point

**File:** `app/services/debate/engine.py` — in `stream_debate()` after each guardian analysis

```python
analysis = await guardian.analyze(current_state)

guardian_analysis_record = GuardianAnalysis(
    debate_id=debate_id,
    turn=current_state["current_turn"],
    analyzing_agent=current_state["current_agent"],
    should_interrupt=analysis["should_interrupt"],
    risk_level=analysis["risk_level"],
    fallacy_type=analysis.get("fallacy_type"),
    reason=analysis["reason"],
    summary_verdict=analysis["summary_verdict"],
    safe=analysis["safe"],
    detailed_reasoning=analysis.get("detailed_reasoning", ""),
)
# Persist via session
```

This captures ALL guardian analyses — including "safe" verdicts — giving the dashboard a complete picture.

---

## Migration Plan

**New migration file:** `alembic_migrations/versions/{hash}_add_guardian_analyses_and_sanitization_events.py`

Branches from: `f1a2b3c4d5e6` (latest: add_vote_debate_choice_idx)

```python
def upgrade() -> None:
    op.create_table(
        'sanitization_events',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('debate_id', sa.UUID(), sa.ForeignKey('debates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent', sa.String(10), nullable=False),
        sa.Column('turn', sa.Integer(), nullable=False),
        sa.Column('redacted_phrases', sa.JSONB(), server_default='[]'),
        sa.Column('redaction_ratio', sa.Float(), server_default='0.0'),
        sa.Column('original_length', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )
    op.create_index('idx_sanitization_events_debate', 'sanitization_events', ['debate_id'])
    op.create_index('idx_sanitization_events_created', 'sanitization_events', [sa.text('created_at DESC')])
    op.create_index('idx_sanitization_events_agent', 'sanitization_events', ['agent'])

    op.create_table(
        'guardian_analyses',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('debate_id', sa.UUID(), sa.ForeignKey('debates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('turn', sa.Integer(), nullable=False),
        sa.Column('analyzing_agent', sa.String(10), nullable=True),
        sa.Column('should_interrupt', sa.Boolean(), server_default='false'),
        sa.Column('risk_level', sa.String(10), server_default='low'),
        sa.Column('fallacy_type', sa.String(30), nullable=True),
        sa.Column('reason', sa.Text(), server_default=''),
        sa.Column('summary_verdict', sa.String(20), server_default='Wait'),
        sa.Column('safe', sa.Boolean(), server_default='true'),
        sa.Column('detailed_reasoning', sa.Text(), server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )
    op.create_index('idx_guardian_analyses_debate', 'guardian_analyses', ['debate_id'])
    op.create_index('idx_guardian_analyses_risk', 'guardian_analyses', ['risk_level'])
    op.create_index('idx_guardian_analyses_created', 'guardian_analyses', [sa.text('created_at DESC')])
    op.create_index('idx_guardian_analyses_unsafe', 'guardian_analyses', ['safe'],
                    postgresql_where=sa.text('safe = false'))

def downgrade() -> None:
    op.drop_table('guardian_analyses')
    op.drop_table('sanitization_events')
```

---

## Dashboard Query Examples (for 6-1)

### Top forbidden phrases across all debates
```sql
SELECT phrase, COUNT(*) as count
FROM sanitization_events, jsonb_array_elements_text(redacted_phrases) AS phrase
GROUP BY phrase
ORDER BY count DESC
LIMIT 10;
```

### Debates with most interruptions
```sql
SELECT d.id, d.asset, d.guardian_verdict, COUNT(ga.id) as total_analyses,
       COUNT(*) FILTER (WHERE ga.should_interrupt) as interrupts,
       COUNT(*) FILTER (WHERE ga.risk_level = 'critical') as critical_count
FROM debates d
JOIN guardian_analyses ga ON ga.debate_id = d.id
GROUP BY d.id
ORDER BY interrupts DESC
LIMIT 20;
```

### Fallacy type distribution
```sql
SELECT fallacy_type, COUNT(*) as count
FROM guardian_analyses
WHERE fallacy_type IS NOT NULL
GROUP BY fallacy_type
ORDER BY count DESC;
```

### Recent high-risk analyses
```sql
SELECT ga.*, d.asset
FROM guardian_analyses ga
JOIN debates d ON d.id = ga.debate_id
WHERE ga.risk_level IN ('high', 'critical')
ORDER BY ga.created_at DESC
LIMIT 50;
```

---

## Risks and Open Questions

| Risk | Severity | Mitigation |
|------|----------|------------|
| Write latency in debate loop | Medium | Use async batch writes. Don't await individual inserts — accumulate and flush |
| Table growth over time | Low | Internal app volume is low. Add retention policy if needed |
| Sanitization events volume (per token flush) | Medium | Only persist events with `is_redacted=True`. Safe events are majority — skip them |
| Guardian analysis write must not block debate | High | Wrap in try/except. Debate must continue even if persistence fails |
| Backfilling existing debate data | Low | Not needed for internal app. Old debates stay in transcript JSON |

---

## Conclusion

**Two new tables, one migration, two write integration points in the engine.** The sanitization layer and Guardian agent already produce structured data — we just need to persist it. The schema is designed for dashboard query patterns: time-series, aggregations, and filtering by risk level / fallacy type.

**Scope for 6-1:**
1. Create models + migration
2. Add writes in engine.py (2 points)
3. Create admin API endpoints for querying
4. Build dashboard UI components
