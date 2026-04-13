# AI Trading Debate Lab - Agent Guidelines

Decision-support platform using adversarial AI agents (Bull, Bear, Risk Guardian) to debate trade ideas. **NOT an auto-trading system**.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router), TypeScript 5+, React 18+ |
| Backend | Python 3.11+, FastAPI 0.100+, Pydantic 2.0+ |
| Database | PostgreSQL 16+, SQLAlchemy |
| State | React Query (server), Zustand (client) |
| Testing | Pytest, Jest 29 + RTL, Playwright |
| Styling | Tailwind CSS 3.4 + Shadcn/UI |

---

## Build/Lint/Test Commands

### Backend (Python/FastAPI)

```bash
# Setup (venv is at .venv/, NOT venv/)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Development
uvicorn app.main:app --reload --port 8000

# Testing (use .venv/bin/python -m pytest, NOT source venv/bin/activate)
.venv/bin/python -m pytest                          # All tests
.venv/bin/python -m pytest tests/test_module.py::test_name  # Single test
.venv/bin/python -m pytest -k "pattern"             # Pattern match
.venv/bin/python -m pytest --cov=app --cov-report=term-missing

# Linting (ruff is system-level, NOT in .venv)
ruff check .
ruff format .
```

### Frontend (Next.js/TypeScript)

```bash
npm install && npm run dev

# Testing (Jest 29, NOT Vitest)
npm run test                              # All tests
npm run test -- path/to/test.test.ts      # Single file
npm run test -- -t "test name"            # Pattern match
npm run test:coverage

# Linting
npm run lint && npx tsc --noEmit
```

### E2E & Docker

```bash
npx playwright test                       # All E2E
npx playwright test path/to/spec.ts       # Single spec
docker-compose up -d --build
```

---

## Code Style Guidelines

### Python (Backend)

**Type Hints - Mandatory:**
```python
async def get_debate(debate_id: str) -> DebateResponse:
    ...
```

**Architecture:**
- **Routers:** Request/response parsing ONLY
- **Services:** All business logic
- **Schemas:** Pydantic models for API bodies

**Naming:** Files/variables `snake_case`, Classes `PascalCase`, Constants `UPPER_SNAKE_CASE`

**Error Handling:** Use standard response envelope with `data`, `error`, `meta` keys.

### TypeScript (Frontend)

**Strict Mode - Mandatory:** No `any` - use `unknown` or specific interfaces.

**Component Structure:**
```
src/features/debate/
  ├── components/    # Feature-specific
  ├── hooks/         # Custom hooks
  ├── types.ts
  └── api.ts
```

**State Management:** React Query (server), Zustand (client). Avoid Context for high-frequency updates.

**Next.js Rules:**
- Pure frontend consumer of FastAPI
- **No Next.js API routes** for business logic
- Default to Server Components

---

## Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Python files/vars | snake_case | `debate_engine.py` |
| TS files | kebab-case | `debate-stream.tsx` |
| TS variables | camelCase | `userProfile` |
| React components | PascalCase | `DebateStream` |
| Database columns | snake_case | `created_at` |
| API JSON keys | camelCase | `createdAt` |
| WebSocket actions | SCREAMING_SNAKE | `DEBATE/ARGUMENT_RECEIVED` |

**WebSocket Action Types (CRITICAL — verify before use):** All actions use `DEBATE/` prefix, NOT `GUARDIAN/` or `VOTE/`. Examples: `DEBATE/GUARDIAN_INTERRUPT`, `DEBATE/GUARDIAN_VERDICT`, `DEBATE/STATUS_UPDATE`, `DEBATE/DEBATE_PAUSED`, `DEBATE/DEBATE_RESUMED`, `DEBATE/ARGUMENT_COMPLETE`, `DEBATE/REASONING_NODE`, `DEBATE/TURN_CHANGE`, `DEBATE/COMPLETED`, `DEBATE/VOTE_UPDATE`. Follow same `{ type, payload, timestamp }` envelope.

**Sanitization Architecture:** Two-layer defense — prompt prohibition (LLM system message) + regex safety-net (`sanitization.py`). Output uses `SanitizationResult` / `SanitizationContext` Pydantic models with structured audit logging (NFR-09).

**Pydantic Bridge:** Use `alias_generator=camelize` for camelCase API output.

**UI Component Patterns:**
- Shadcn `Dialog` for Guardian freeze overlays — explicit dismissal required (`onInteractOutside` prevented)
- Radix `Tooltip` for moderation badges — `delayDuration={200}`, mobile inline text fallback
- Discriminated union hooks for complex state (e.g., `useGuardianFreeze`: `idle | active | acknowledged`)

---

## API Patterns

### HTTP Response Envelope
```json
{ "data": {...}, "error": null, "meta": {"latency_ms": 120} }
```

### WebSocket Action
```json
{ "type": "DEBATE/ARGUMENT_RECEIVED", "payload": {...}, "timestamp": "..." }
```

---

## Git Conventions

- **Commits:** `feat:`, `fix:`, `chore:`, `docs:`
- **Branches:** `feature/name`, `fix/issue`
- **Never commit:** `.env`, credentials, secrets

---

## Task Tracking (Beads)

```bash
bd sync                          # Sync state
bd list --status in_progress     # Active work
bd ready --label bmad-workflow   # Next story
bd create "<title>" --type feature --priority 0-4
bd update <id> --status in_progress
bd close <id> --reason "done"
```

---

## Session End Checklist (MANDATORY)

1. `bd sync` - Sync Beads state
2. Run quality gates if code changed
3. `bd list --status in_progress` - Verify no stuck items
4. `git pull --rebase && git push`
5. `git status` - MUST show "up to date with origin"

**Critical:** Work is NOT complete until `git push` succeeds.

---

## BMAD Workflow

```
create-story → validate → dev-story → code-review → testarch-automate → qa-automate
     ↓            ↓           ↓             ↓               ↓                ↓
  bd create   bd label   bd update     bd label        bd label          bd close
```

```bash
./.beads-hooks/bmad-integration.sh status
./.beads-hooks/bmad-integration.sh dev-start "story-key"
```

---

## Lessons Learned (Prep Sprint — Epic 2→3)

These issues caused real bugs or wasted significant debugging time. **Read before writing any test or touching the engine.**

### 1. State Rebuild Drops Fields

**Bug (Task 1):** `stream_debate()` rebuilt `current_state` each turn but dropped `guardian_interrupts` and `pause_history` fields, causing silent data loss across turns.

**Rule:** When rebuilding a dict from a subset of fields, ALWAYS include ALL fields from the original — especially list/dict accumulators (`guardian_interrupts`, `pause_history`, `messages`). Use `current_state.get("field", default)` for optional fields.

### 2. Multi-Turn Mock Infinite Loop

**Pattern:** `patched_debate_engine()` returns static `current_turn` values (1 for bull, 2 for bear). Any test with `max_turns > 2` that doesn't override `mocks["bull"].generate` and `mocks["bear"].generate` with dynamic `side_effect` functions **will loop forever**.

**Rule:** For tests with `max_turns > 2`, ALWAYS override both agent generates with dynamic functions that increment `current_turn`:

```python
mocks["bull"].generate = AsyncMock(
    side_effect=lambda state, **kw: {
        "messages": state.get("messages", []) + [{"role": "bull", "content": "..."}],
        "current_turn": state.get("current_turn", 0) + 1,
        "current_agent": "bear",
    }
)
```

### 3. WebSocket Action Prefix

**Bug (recurring):** Code and tests used `GUARDIAN_INTERRUPT` or `GUARDIAN/INTERRUPT`. The correct prefix is `DEBATE/` for ALL actions. Full list in `ws_schemas.py`.

**Rule:** ALL WebSocket action types use `DEBATE/` prefix. There are NO `GUARDIAN/` prefixed actions. Verify against `ws_schemas.py` before writing assertions.

### 4. GuardianAnalysisResult Field Names

**Bug:** Tests used `intervention_needed`, `reasoning`, or other non-existent fields.

**Rule:** `GuardianAnalysisResult` required fields: `should_interrupt`, `risk_level`, `reason`, `safe`, `summary_verdict`. Optional: `fallacy_type`, `detailed_reasoning`. There is NO `intervention_needed` or `reasoning` field.

### 5. Patching Config Requires All Fields

**Bug:** Patching `app.config.settings` with a partial mock caused Pydantic validation errors because `Settings` validates all required fields on access.

**Rule:** When patching `app.config.settings`, you MUST provide ALL required fields:

```python
with patch("app.config.settings") as mock_settings:
    mock_settings.guardian_enabled = False
    mock_settings.DATABASE_URL = "postgresql://test"
    mock_settings.EXPIRE_ON_COMMIT = False
    mock_settings.OPENAPI_URL = "/openapi.json"
    mock_settings.REDIS_URL = "redis://localhost:6379/0"
    mock_settings.ACCESS_SECRET_KEY = "test"
    mock_settings.RESET_PASSWORD_SECRET_KEY = "test"
    mock_settings.VERIFICATION_SECRET_KEY = "test"
    mock_settings.CORS_ORIGINS = set()
    mock_settings.openai_api_key = "test"
    mock_settings.ENVIRONMENT = "test"
```

### 6. Token Streaming — Sanitize Whole, Emit Delta

**Bug:** Splitting tokens then sanitizing each chunk independently misses forbidden phrases that straddle chunk boundaries.

**Rule:** Accumulate ALL tokens in a buffer. On each flush, sanitize the ENTIRE accumulated text, then emit only the new portion (track `_sanitized_sent` offset). Use `_TAIL_OVERLAP = 20` chars to handle length changes from redaction.

### 7. Database Tests — PostgreSQL Only

**Bug:** Writing model tests with in-memory SQLite fails because SQLAlchemy models use PostgreSQL-specific features.

**Rule:** ALL database tests use the `engine`/`db_session` fixtures from `tests/conftest.py` which create/drop tables against real Postgres per function. Set `TEST_DATABASE_URL` env var. NEVER use in-memory SQLite.

### 8. stream_debate Signature

**Bug:** Tests called with wrong argument names.

**Rule:** `stream_debate(debate_id, asset, market_context, manager, max_turns=6, stale_guardian=None)`. The `manager` is a `DebateConnectionManager` (use `mock_manager` fixture). The `stale_guardian` is a stale data guardian (use `mock_stale_guardian` fixture).

### 9. Lint: Remove Unused Before Committing

**Pattern:** Several files had unused imports (`typing.Any`, `typing.Literal`) and unused variables (`window_key`, `latency_ms`, `start_time`) that ruff caught.

**Rule:** Run `ruff check .` before committing. Fix ALL errors — unused imports, unused variables, unreachable code.

### 10. Percentage Bars Must Sum to 100

**Bug:** Independent `Math.round()` calls on `bullPct` and `bearPct` can sum to 99 or 101.

**Rule:** Only round ONE percentage independently (e.g., `bullPct = Math.round(...)`). Derive the last bar as the complement: `bearPct = 100 - bullPct - otherPct`. NEVER round all percentages independently.

### 11. React Query setQueryData — Always Use Updater Function

**Bug:** `setQueryData(key, directValue)` from a closure reads stale state when multiple updates arrive before React re-renders.

**Rule:** ALWAYS use the updater function form: `setQueryData(key, (old) => newValue)`. This reads the latest cache state, preventing stale closure overwrites.

### 12. Shared Query Key Factory — Never Inline Keys

**Bug:** Inlining `["debateResult", debateId]` in a WebSocket handler silently breaks if the key structure changes in the hook.

**Rule:** ALWAYS use the shared `queryKeys.debateResult(debateId)` factory from `features/debate/hooks/queryKeys.ts`. Every consumer must reference the same factory.

### 13. WS/Poll Single Writer Pattern

**Bug:** Both WebSocket handler and HTTP polling can write to React Query cache simultaneously, causing stale poll to overwrite fresher WS update.

**Rule:** Gate polling on WS connection state: `refetchInterval: hasVoted && !wsConnected ? interval : false`. Only one data source writes at a time.

### 14. Component Size Limit: 300 Lines

**Pattern:** `DebateStream` grew from 376→450+ lines across Epic 3. Every story added "just a few lines" of wiring.

**Rule:** Any component exceeding 300 lines MUST be decomposed before the story can be marked done. Extract hooks for state logic, sub-components for rendering sections.

### 15. Framer Motion — Animate Interpolation, NOT Key Re-animation

**Bug:** Using `key` prop changes to trigger re-animation forces React unmount/remount, causing visible flashing under rapid vote sequences.

**Rule:** Use `animate` prop interpolation — Framer Motion handles animation interruption natively by interpolating from current position to new target. Use `isFirstRender` ref for stagger-on-mount-only effects. NEVER change `key` to re-trigger animations.

### 16. Broadcast Only on Successful INSERT

**Bug:** Broadcasting on rejected votes (duplicate, rate limit) sends misleading WebSocket actions.

**Rule:** Place broadcast code AFTER all guard chain exits AND the DB commit. Broadcast MUST be wrapped in try/except — vote write must succeed even if broadcast fails.

### 17. Polling Constants — Named Exports

**Pattern:** Magic numbers like `5000` in `refetchInterval` are hard to test and maintain.

**Rule:** Extract polling intervals to named constants (e.g., `export const VOTE_POLL_INTERVAL_MS = 5000`). Export for test assertions.

---

## Frontend Accessibility Pre-Submission Checklist

**MANDATORY — verify ALL items before submitting any frontend story for review.**

- [ ] **Reduced Motion:** All animations respect `useReducedMotion()` from Framer Motion. When true: `duration: 0`, no stagger delays, no shimmer. Gentle opacity fade-in is acceptable.
- [ ] **aria-live Regions:** Dynamic content updates (vote counts, celebration text, status changes) have `aria-live="polite"`. Use `"assertive"` ONLY for critical error announcements. Clear announcements after dismissal.
- [ ] **Touch Targets:** All interactive elements have minimum 44×44px hit area. Use `min-h-[44px] min-w-[44px]` or equivalent padding.
- [ ] **Contrast Ratios:** Text meets WCAG AA minimum (4.5:1 for normal text, 3:1 for large text). Verify against both light and dark backgrounds.
- [ ] **Dual-Coding:** Information is never conveyed by color alone — always pair with icon, text, or pattern.
- [ ] **Focus Management:** Modal/overlay traps focus. Return focus to trigger element on close. Visible focus indicators.
- [ ] **Keyboard Navigation:** All interactive elements reachable via Tab. Enter/Space activates buttons. Escape closes modals.
- [ ] **Semantic HTML:** Use `<button>` not `<div onClick>`. Use `<nav>`, `<main>`, `<section>` landmarks. Headings follow h1→h6 hierarchy.

---

## Key Files

| Purpose | Location |
|---------|----------|
| Architecture | `_bmad-output/planning-artifacts/architecture.md` |
| PRD | `_bmad-output/planning-artifacts/prd.md` |
| Epics | `_bmad-output/planning-artifacts/epics.md` |
| UX Design | `_bmad-output/planning-artifacts/ux-design-specification.md` |
| Project Memories | `.serena/memories/` |
