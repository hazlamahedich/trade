# Code Conventions

## Python (Backend)

### Type Hints
- **Strict typing required** - use Pydantic models for complex types
- All functions must have type annotations

### Async/Await
- **Mandatory** for all I/O operations (DB, API calls)
- Never use blocking functions in async routes

### FastAPI Architecture
- **Routers:** ONLY handle request/response parsing - NO business logic
- **Service Layer:** Business logic MUST reside in `services/`
- **Schemas:** Pydantic models in `schemas/` for all request/response bodies

### Project Structure
```
backend/
├── routers/     # Request/response parsing only
├── services/    # Business logic
├── schemas/     # Pydantic models
├── models/      # Database models
└── tests/       # Pytest tests
```

## TypeScript (Frontend)

### Strict Mode
- `strict: true` must be enabled in tsconfig
- **No `any`** - use `unknown` or specific interfaces
- All promises must be handled (await or catch)

### Next.js Rules
- Pure frontend consumer of FastAPI backend
- **Do NOT use Next.js API routes** for business logic
- Default to Server Components
- Use `'use client'` strictly for interactivity

### State Management
- React Query for server state (data fetching/syncing)
- Zustand for complex UI state
- Avoid Context for high-frequency updates

## Git Conventions
- **Conventional Commits:** `feat:`, `fix:`, `chore:`
- **Branching:** `feature/name`, `fix/issue`
- Never commit `.env` files

## Testing Conventions
- Backend: Pytest with `pytest-asyncio`, mock all external services
- Frontend: Vitest + React Testing Library
- E2E: Playwright for critical user journeys
