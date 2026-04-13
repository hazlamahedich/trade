---
project_name: 'trade'
user_name: 'team mantis a'
date: '2026-04-13'
sections_completed: ['technology_stack', 'implementation_rules', 'testing_rules', 'workflow_rules', 'usage_guidelines']
status: 'complete'
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Frontend:** React 18+, Next.js 14+ (App Router), TypeScript 5+
- **Backend:** Python 3.11+, FastAPI 0.100+, Pydantic 2.0+
- **Database:** PostgreSQL 16+
- **Visualization:** React Flow, Chart.js
- **Testing:** Pytest, Jest 29, Playwright (E2E)
- **UI Components:** Shadcn/UI + Radix UI (Dialog, Tooltip)
- **Backend Sanitization:** Two-layer defense (prompt prohibition + regex safety-net)

## Critical Implementation Rules

### Language-Specific Rules

- **Python:**
  - **Type Hints:** Strict typing required; use Pydantic models for complex types.
  - **Async/Await:** Mandatory for all I/O operations (DB, API calls).
  - **No Blocking Code:** Never use blocking functions in async routes.
  - **No deprecated datetime:** Use `datetime.now(timezone.utc)` — NEVER `datetime.utcnow()`.
  - **Venv Location:** Virtual environment is at `.venv/`, NOT `venv/`. Use `.venv/bin/python -m pytest` for tests. Ruff is system-level, not in `.venv`.
  - **Database:** PostgreSQL ONLY for tests. Use `engine`/`db_session` fixtures from `tests/conftest.py`. NEVER use in-memory SQLite.

- **TypeScript:**
  - **Strict Mode:** `strict: true` must be enabled.
  - **No Any:** Explicitly forbid `any`; use `unknown` or specific interfaces.
  - **Floating Promises:** Must handle all promises (await or catch).

### Framework-Specific Rules

- **FastAPI Architecture:**
  - **Router Logic:** **FORBIDDEN**. Routers must only handle request/response parsing.
  - **Service Layer:** Business logic **MUST** reside in `services/`.
  - **Schemas:** Pydantic models in `schemas/` for all request/response bodies.
  - **Pydantic camelCase:** Use `alias_generator=to_camel` from `pydantic.alias_generators` — NEVER inline lambdas.

- **Next.js (Frontend Only):**
  - **Role:** Pure frontend consumer of the FastAPI backend.
  - **API Routes:** Do **not** use Next.js API routes for business logic.
  - **Server Components:** Default to Server Components; use `'use client'` strictly for interactivity.

- **State Management:**
  - **Server State:** Use **React Query** for all data fetching/syncing.
  - **Client State:** Use **Zustand** for complex UI state (avoid Context for high-frequency updates).

### Development Workflow Rules

- **API Synchronization:** Frontend types **should** be generated from the FastAPI OpenAPI spec to ensure contract safety.
- **Commits:** Follow **Conventional Commits** (`feat:`, `fix:`, `chore:`).
- **Branching:** Use descriptive branches (`feature/name`, `fix/issue`).
- **Secrets:** Never commit `.env` files; use environment variables.
- **Barrel Exports:** All new components **MUST** be exported from `index.ts`. All new hooks **MUST** be exported from `hooks/index.ts`. Include this in code review checklist.

### Architecture Patterns (Proven in Epic 2)

- **Discriminated Union State Hooks:** For complex UI state (e.g., `idle | active | acknowledged`), use TypeScript discriminated unions — NOT boolean flags. Eliminates impossible states at the type level.
- **Defense-in-Depth Sanitization:** Two layers required: (1) prompt-level prohibition in LLM system messages, (2) regex safety-net in `sanitization.py`. Use `SanitizationResult` and `SanitizationContext` Pydantic models for structured audit trail.
- **Token Streaming Sanitization:** Buffer ALL tokens, sanitize the ENTIRE accumulated text on each flush, then emit only the new delta. NEVER sanitize individual chunks — forbidden phrases can straddle chunk boundaries.
- **`asyncio.Event` Coordination:** For backend pause/resume flows, use `asyncio.Event` pattern (established in Story 1-6, reused in Story 2-2). Do NOT use polling or sleep-based approaches.
- **`ArgumentEntry` NamedTuple:** Standardized structure for debate arguments. All new argument types must conform to this interface.
- **WebSocket Action Prefix:** ALL WebSocket actions use `DEBATE/` prefix — there are NO `GUARDIAN/` or `VOTE/` prefixed actions. Full list: `DEBATE/GUARDIAN_INTERRUPT`, `DEBATE/GUARDIAN_VERDICT`, `DEBATE/STATUS_UPDATE`, `DEBATE/DEBATE_PAUSED`, `DEBATE/DEBATE_RESUMED`, `DEBATE/ARGUMENT_COMPLETE`, `DEBATE/REASONING_NODE`, `DEBATE/TURN_CHANGE`, `DEBATE/COMPLETED`, `DEBATE/VOTE_UPDATE`. Verify against `ws_schemas.py`.
- **State Rebuild Discipline:** When rebuilding a dict from a subset of fields, ALWAYS include ALL fields from the original — especially list/dict accumulators (`guardian_interrupts`, `pause_history`, `messages`). Use `current_state.get("field", default)` for optional fields.
- **Config Patching:** When patching `app.config.settings`, provide ALL required fields (it's a Pydantic model that validates on access). See AGENTS.md for the full list.
- **Multi-Turn Test Mocks:** `patched_debate_engine()` returns static turn counts. For `max_turns > 2`, ALWAYS override `mocks["bull"].generate` and `mocks["bear"].generate` with dynamic `side_effect` functions that increment `current_turn`.

### Architecture Patterns (Proven in Epic 3)

- **React Query Cache Updates:** ALWAYS use the updater function form: `setQueryData(key, (old) => newValue)`. NEVER pass a direct value — stale closures will overwrite fresher data when multiple updates arrive before React re-renders.
- **Shared Query Key Factory:** NEVER inline query key arrays (e.g., `["debateResult", id]`). Always use `queryKeys.debateResult(debateId)` from `features/debate/hooks/queryKeys.ts`. If the key structure changes, inlined keys silently stop updating the cache.
- **WS/Poll Single Writer Pattern:** Gate HTTP polling on WebSocket connection state: `refetchInterval: hasVoted && !wsConnected ? interval : false`. Only one data source writes to React Query cache at a time — prevents stale poll overwriting fresher WS update.
- **Component Size Limit (300 Lines):** Any component exceeding 300 lines MUST be decomposed. Extract hooks for state logic, sub-components for rendering sections. The "just a few lines" per story pattern compounds dangerously.
- **Framer Motion Animation Rules:** Use `animate` prop interpolation — Framer Motion handles animation interruption natively. Use `isFirstRender` ref for stagger-on-mount-only effects. NEVER use `key` prop changes to re-trigger animations (causes unmount/remount flashing).
- **Percentage Bars Must Sum to 100:** Only round ONE percentage independently. Derive the last bar as the complement (`bearPct = 100 - bullPct - otherPct`). NEVER round all percentages independently.
- **Broadcast After Commit:** WebSocket broadcasts MUST be placed AFTER all guard chain exits AND the DB commit. Wrap in try/except — write must succeed even if broadcast fails. NEVER broadcast on rejected operations.
- **Polling Constants:** Extract all polling intervals to named constants (e.g., `export const VOTE_POLL_INTERVAL_MS = 5000`). Export for test assertions. NEVER use magic numbers.
- **sessionStorage Persistence:** For per-session UI state (first voter, celebration), use `sessionStorage` keyed by `debateId`. Guard SSR with `typeof window !== "undefined"` check. Use `useState` (NOT `useRef`) for values that must trigger re-renders.

### Radix UI / Shadcn Component Patterns

- **Dialog (Modal Overlays):** Use Shadcn `Dialog` for Guardian freeze overlays. Must require explicit dismissal — no clicking outside to close. Use `onInteractOutside={(e) => e.preventDefault()}`.
- **Tooltip (Contextual Info):** Use Radix `Tooltip` for moderation badges and contextual info. Set `delayDuration={200}` for responsive feel. Include mobile fallback (inline text for small screens).

### Testing Rules

- **Backend:** Pytest with `pytest-asyncio`. Mock all external services.
- **Frontend:** Jest 29 + React Testing Library for components. **NOT Vitest** — use `jest.fn()`, `jest.mock()`, never `vi.fn()`.
- **E2E:** Playwright for critical user journeys (Smoke Tests).

**Approved Test Patterns (Mandatory):**

**Backend (Python):**
- Use `AsyncMock` for async functions, `MagicMock` for sync
- Use `freezer` or `time_machine` for time-dependent tests
- All external services (LLM, Redis, HTTP) must be mocked
- Use `pytest.fixture` for shared setup

**Frontend Unit (Jest 29):**
- Use `jest.fn()` and `jest.mock()` — **NEVER** `vi.fn()` or `vi.mock()`
- Use `jest.runAllTimersAsync()` for async timer tests
- Use `renderHook` from `@testing-library/react` for hook testing
- Use `@testing-library/jest-dom` matchers (`toBeInTheDocument()`, etc.)
- Mock WebSocket with class-based mock (see DebateStreamReasoningGraph.test.tsx pattern)
- For `@xyflow/react`: mock the module entirely with `jest.mock("@xyflow/react", ...)`

**E2E (Playwright):**
- Use `waitForResponse()` before assertions on network-dependent state
- Use `waitForFunction()` for WebSocket message conditions
- **NEVER** use `waitForTimeout()` — wait for actual conditions instead
- Use `page.route()` to mock API responses for isolated testing
- Max 300 lines per test file — split into focused files if exceeding
- Use shared WS helper pattern for Guardian/moderation WebSocket testing
- Use `data-testid` attributes for stable E2E selectors

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-04-13 (Epic 3 — added voting patterns, WS/poll single writer, React Query updater function, component size limit, Framer Motion animation rules, accessibility checklist)
