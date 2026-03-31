---
project_name: 'trade'
user_name: 'team mantis a'
date: '2026-03-30'
sections_completed: ['technology_stack', 'implementation_rules', 'testing_rules', 'workflow_rules', 'usage_guidelines']
status: 'complete'
rule_count: 34
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

## Critical Implementation Rules

### Language-Specific Rules

- **Python:**
  - **Type Hints:** Strict typing required; use Pydantic models for complex types.
  - **Async/Await:** Mandatory for all I/O operations (DB, API calls).
  - **No Blocking Code:** Never use blocking functions in async routes.
  - **No deprecated datetime:** Use `datetime.now(timezone.utc)` — NEVER `datetime.utcnow()`.

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

Last Updated: 2026-03-30
