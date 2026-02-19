# AI Trading Debate Lab - Agent Guidelines

Decision-support platform using adversarial AI agents (Bull, Bear, Risk Guardian) to debate trade ideas. **NOT an auto-trading system**.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router), TypeScript 5+, React 18+ |
| Backend | Python 3.11+, FastAPI 0.100+, Pydantic 2.0+ |
| Database | PostgreSQL 16+, SQLAlchemy |
| State | React Query (server), Zustand (client) |
| Testing | Pytest, Vitest + RTL, Playwright |
| Styling | Tailwind CSS 3.4 + Shadcn/UI |

---

## Build/Lint/Test Commands

### Backend (Python/FastAPI)

```bash
# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Development
uvicorn app.main:app --reload --port 8000

# Testing
pytest                                    # All tests
pytest tests/test_module.py::test_name    # Single test
pytest -k "pattern"                       # Pattern match
pytest --cov=app --cov-report=term-missing  # With coverage

# Linting
ruff check . && ruff format .
mypy app
```

### Frontend (Next.js/TypeScript)

```bash
npm install && npm run dev

# Testing
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

**Pydantic Bridge:** Use `alias_generator=camelize` for camelCase API output.

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

## Key Files

| Purpose | Location |
|---------|----------|
| Architecture | `_bmad-output/planning-artifacts/architecture.md` |
| PRD | `_bmad-output/planning-artifacts/prd.md` |
| Epics | `_bmad-output/planning-artifacts/epics.md` |
| UX Design | `_bmad-output/planning-artifacts/ux-design-specification.md` |
| Project Memories | `.serena/memories/` |
