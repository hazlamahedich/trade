# Story 4.1: Adversarial Review — Synthesized Action Items

**Review Date:** 2026-04-13
**Reviewers:** Winston (Architect), Amelia (Developer), Murat (Test Architect), Mary (Business Analyst)
**Status:** Pre-development

---

## Verified Critical Findings

These findings are confirmed by code inspection. They WILL cause bugs if not addressed before implementation.

### 🔴 BLOCKER 1: State Rebuild Data Loss (LL #1 Relapse)

**Source:** Amelia, confirmed by code read
**Location:** `engine.py:570-577`

The final `save_state` before completion drops all data except `status`, `asset`, `current_turn`:

```python
await stream_state.save_state(
    debate_id,
    {"status": "completed", "asset": asset, "current_turn": current_state["current_turn"]},
)
```

**Impact:** If `ArchivalService` calls `stream_state.get_state(debate_id)` after this save, it gets a partial state — no `messages`, no `guardian_verdict`, no `guardian_interrupts`, no `pause_history`. AC1 (full transcript persisted) is impossible as specified.

**Action:** Change the story to pass `current_state` (the in-memory dict) directly to archival, NOT read back from Redis. The archival service should accept a `state: dict` parameter rather than fetching from Redis. Alternatively, fix the `save_state` call to include all fields per LL #1.

**Recommended fix:**
```python
# Option A: Pass current_state to archival (preferred — no Redis round-trip)
await archive_debate(debate_id, current_state)

# Option B: Fix save_state to include all fields
await stream_state.save_state(debate_id, {
    **current_state,
    "status": "completed",
})
```

---

### 🔴 BLOCKER 2: No DB Session in `stream_debate()` Scope

**Source:** Amelia, confirmed by code read
**Location:** `engine.py` imports (lines 1-35)

`stream_debate()` imports zero DB dependencies. No `AsyncSession`, no `DebateRepository`, no `get_db()`. The function is a long-running async generator that cannot hold a DB session for 6+ turns without connection pool exhaustion.

**Impact:** Task 2 ("wire archival into `stream_debate()`") cannot work as specified without a session management strategy.

**Action:** Specify that `ArchivalService` creates its own short-lived session internally via `async with get_db()` or an async session factory. Do NOT inject a session into `stream_debate()`. Update Task 1 to make this explicit.

---

### 🔴 BLOCKER 3: Missing Archival Data for Downstream Stories

**Source:** Mary
**Location:** Story spec AC1, models.py:31-50

Story 4.2 requires filtering "by asset or outcome." The `Debate` model HAS an `asset` column (verified at `models.py:36`), but:
- The story's AC1 doesn't explicitly call out archiving `asset` — it's only mentioned in the task list
- No `winner` or `outcome` field exists on the `Debate` model
- `created_at` exists (`models.py:43`) which can serve as a `started_at` proxy

**Impact:** Stories 4.2 and 4.3 will hit a schema gap. Story 4.3 needs Schema.org `datePublished` — `created_at` can serve this. But no "winner" column exists for the "Winner badges" in Story 4.2.

**Action:**
1. Update AC1 to explicitly list all persisted fields: `messages`, `guardian_verdict`, `guardian_interrupts_count`, `current_turn`, `completed_at`, `asset` (already on model), `status`
2. Add a story note: "Winner/outcome column deferred to Story 4.2 when the history page design defines what 'outcome' means"
3. Note that `created_at` (not `started_at`) is the debate start timestamp — `Debate.created_at` is set on row creation

---

## High-Priority Fixes (Address Before Dev)

### 🟡 FIX 4: Clarify `vote_snapshot` Purpose and Shape

**Source:** Amelia, Winston, Mary

Three issues with the proposed `vote_snapshot = Column(JSON, nullable=True)`:

1. **Dead code:** `get_result()` (repository.py:73-99) computes vote counts live from DB. Nothing reads `vote_snapshot`. It's write-only until Story 4.2/4.3.
2. **Two sources of truth:** Live aggregation vs. frozen snapshot can diverge if votes are cast after archival.
3. **Better alternative:** Winston recommends three integer columns (`vote_bull`, `vote_bear`, `vote_undecided`) for queryability. This is the same migration effort and avoids JSON parsing in SQL.

**Action:** Replace Task 4 with:
```
Add three columns to Debate model:
  vote_bull = Column(Integer, nullable=True, default=None)
  vote_bear = Column(Integer, nullable=True, default=None)  
  vote_undecided = Column(Integer, nullable=True, default=None)
Create Alembic migration.
```
Update Task 3 to write these three integers instead of a JSON blob. If downstream stories need additional vote metadata, they can extend the model.

---

### 🟡 FIX 5: Add Observability Requirements

**Source:** Winston

NFR-06 (99.9% availability) requires monitoring. The story adds a critical data path with zero observability.

**Action:** Add to Task 1 (ArchivalService):
- Structured log entry on archival: `debate_id`, `status` (success/failure/idempotent), `duration_ms`, `redis_cleanup_status`
- Log at WARNING level on Redis cleanup failure
- Log at ERROR level on archival failure (but do NOT raise)

No metrics library required at this stage — structured logs are sufficient for initial observability. Metrics can be added in a future story.

---

### 🟡 FIX 6: Specify Transaction Semantics

**Source:** Winston, Amelia

Task 3 extends `complete_debate()` to write vote counts alongside the debate record. The current `complete_debate()` at `repository.py:52-71` does a single `commit()` at line 69. This is already atomic IF the vote snapshot is added to the same method.

**Action:** Add a dev note: "All archival DB writes (debate update + vote snapshot) MUST happen within a single `complete_debate()` call and a single `session.commit()`. Do NOT separate the vote snapshot write into a second transaction."

---

### 🟡 FIX 7: Clarify Exit Path Coverage

**Source:** Amelia, Winston, code read

`stream_debate()` has **four** exit paths, not two:

| Exit Path | Status | Archive? | Notes |
|-----------|--------|----------|-------|
| Normal completion (while-loop ends) | `"completed"` | ✅ Yes | Main path |
| Critical interrupt (`risk_level == "critical"`) | `"completed"` | ✅ Yes | Breaks loop at L443 |
| Ack timeout (`ack_result == "timeout"`) | `"completed"` | ✅ Yes | Also breaks at L443 |
| Stale data / error | `"error"` or raises | ❌ No | Re-raises StaleDataError at L582 |

**Action:** Update the story's Dev Notes to explicitly list all four exit paths. Clarify that ack timeout should also trigger archival (same as critical interrupt — both fall through to the same completion code). Stale data errors are re-raised and never reach archival, which is correct.

---

## Test Plan Amendments

### 🔴 Required Test Additions (from Murat)

The story's 9 tests are insufficient. Add these before marking done:

| Test | Priority | Why |
|------|----------|-----|
| `test_archive_db_success_redis_delete_failure` | 🔴 P0 | DB writes succeed, `delete_state()` raises. Verify: DB committed, error logged, no exception propagated. |
| `test_archive_persists_to_real_postgres` | 🔴 P0 | Integration test using `engine`/`db_session` fixtures. Write + read back. Verify column types, serialization. Per LL #7. |
| `test_archive_handles_malformed_redis_state` | 🔴 P0 | Redis returns `{"status": "completed"}` with no `messages` key. Verify graceful handling. |
| `test_archive_with_no_guardian_verdict` | 🟡 P1 | `guardian_enabled=False` path. Verify `guardian_verdict=None` is handled. |
| `test_archive_with_zero_votes` | 🟡 P1 | Empty votes table. Verify vote columns are 0 or None (specify which). |
| `test_stream_debate_error_path_no_archive` | 🟡 P1 | Negative test: StaleDataError does NOT trigger archival. |
| `test_archive_transcript_is_valid_json` | 🟡 P1 | Verify transcript round-trips through `json.dumps()` / `json.loads()`. |

### 🟡 Test Architecture Fix

**Source:** Murat

The story says "mock Redis/DB/stream_state" but LL #7 says "PostgreSQL ONLY." Use a two-tier approach:

| Tier | Tests | DB | Redis |
|------|-------|-----|-------|
| Unit (fast) | AC3, AC4, AC5 wiring | Mock | Mock |
| Integration (CI) | AC1, AC2 data shape | Real Postgres | Mock |

---

## Story Spec Updates Required

### Task Ordering

Correct dependency order: **4 → 3 → 1 → 2 → 5** (not 1-5 as listed).

### Updated Task 1 (ArchivalService)

Change signature from:
```python
async def archive_debate(debate_id: str) -> None
```
To:
```python
async def archive_debate(debate_id: str, state: dict[str, Any] | None = None) -> None
```

When `state` is provided (called from `stream_debate`), use it directly — no Redis read needed. When `state` is None (future retry/manual path), read from Redis as fallback.

The service creates its own DB session internally:
```python
async with async_session_factory() as session:
    repo = DebateRepository(session)
    ...
```

### Updated Task 2 (Wire into engine)

After the final `save_state` at L570, call:
```python
try:
    await archive_debate(debate_id, current_state)
except Exception as e:
    logger.error(f"Archival failed for debate {debate_id}: {e}")
```

This applies to all three completion paths (normal, critical interrupt, ack timeout — they all converge at L570).

### Updated Task 4 (DB Column)

Replace `vote_snapshot = Column(JSON, nullable=True)` with:
```python
vote_bull = Column(Integer, nullable=True, default=None)
vote_bear = Column(Integer, nullable=True, default=None)
vote_undecided = Column(Integer, nullable=True, default=None)
```

---

## Deferred Items (Track for Future Stories)

These are acknowledged gaps but NOT in scope for Story 4.1:

| Item | Source | When to Address |
|------|--------|----------------|
| Winner/outcome column on Debate | Mary | Story 4.2 (history page defines "winner") |
| Error-state debate archival | Winston | Future story — for now, error debates expire via Redis TTL |
| Performance budget for archival | Mary | Story 4.1 only if archival exceeds 500ms (unlikely) |
| Indexes for history page filtering | Mary | Story 4.2 (when filter queries are designed) |
| Metrics/counters for archival | Winston | Post-launch observability story |
| Retry mechanism for failed archival | Mary | Future story — Redis TTL is safety net |
| Concurrent archival TOCTOU race | Amelia, Murat | P2 — debate IDs are unique per session, race is theoretical |

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| 🔴 Blockers (must fix before dev) | 3 | State rebuild, session injection, downstream data gap |
| 🟡 High fixes (address before dev) | 4 | Vote columns, observability, transactions, exit paths |
| 🟡 Required test additions | 7 | 3 P0 + 4 P1 |
| 🔵 Deferred items | 7 | Tracked for future stories |

**Recommendation:** Update the story spec with the three blockers and four high fixes, then proceed to development. The test additions should be incorporated into Task 5's test list.
