---
project_name: 'trade'
user_name: 'team mantis a'
date: '2026-02-18'
sections_completed: ['technology_stack', 'implementation_rules', 'testing_rules', 'workflow_rules', 'usage_guidelines']
status: 'complete'
rule_count: 26
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
- **Testing:** Pytest, Vitest, Playwright (E2E)

## Critical Implementation Rules

### Language-Specific Rules

- **Python:**
  - **Type Hints:** Strict typing required; use Pydantic models for complex types.
  - **Async/Await:** Mandatory for all I/O operations (DB, API calls).
  - **No Blocking Code:** Never use blocking functions in async routes.

- **TypeScript:**
  - **Strict Mode:** `strict: true` must be enabled.
  - **No Any:** Explicitly forbid `any`; use `unknown` or specific interfaces.
  - **Floating Promises:** Must handle all promises (await or catch).

### Framework-Specific Rules

- **FastAPI Architecture:**
  - **Router Logic:** **FORBIDDEN**. Routers must only handle request/response parsing.
  - **Service Layer:** Business logic **MUST** reside in `services/`.
  - **Schemas:** Pydantic models in `schemas/` for all request/response bodies.

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

### Testing Rules

- **Backend:** Pytest with `pytest-asyncio`. Mock all external services.
- **Frontend:** Vitest + React Testing Library for components.
- **E2E:** Playwright for critical user journeys (Smoke Tests).

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

Last Updated: 2026-02-18
