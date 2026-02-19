---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-02-18'
status: 'complete'
completedAt: '2026-02-18'
---

# Test Framework Setup Progress

## Step 1: Preflight Checks

### Prerequisites Validation

| Requirement | Status | Notes |
|-------------|--------|-------|
| package.json exists | ✅ PASS | Located at `trade-app/nextjs-frontend/package.json` |
| No existing E2E framework | ✅ PASS | No playwright.config.*, cypress.config.*, or cypress.json found |
| Architecture context available | ✅ PASS | Found `architecture.md` with full stack details |

### Project Context Summary

**Project Type:** Full-Stack Web Application (AI Trading Debate Lab)

**Frontend Stack:**
- Framework: Next.js 16.0.8 (App Router)
- React: 19.2.1
- TypeScript: 5.x
- Bundler: Next.js webpack
- Styling: Tailwind CSS 3.4.13 + Shadcn/UI (Radix UI)
- Package Manager: pnpm 10.7.1

**Backend Stack:**
- Framework: FastAPI (Python 3.11+)
- Auth: fastapi-users (JWT)

**Existing Test Setup:**
- Jest 29.7.0 with ts-jest
- @testing-library/react 16.0.1
- @testing-library/jest-dom 6.6.3

**Architecture Notes for E2E:**
- Split-stack: Frontend (Vercel) + Backend (Railway)
- Real-time: WebSockets for debate streaming
- Auth: JWT tokens, requires `FIXED_QA_TOKEN` capability for E2E tests
- Frontend path: `trade-app/nextjs-frontend/`

### Relevant Documentation Found

- `_bmad-output/planning-artifacts/architecture.md` - Complete architecture decision document

---

## Step 2: Framework Selection

### Selected Framework: **Playwright**

### Decision Rationale

| Factor | Assessment |
|--------|------------|
| Config Preference | `config.yaml` explicitly sets `test_framework: playwright` |
| Project Complexity | High - AI agent orchestration, WebSocket streaming, real-time debate |
| Multi-browser Need | Required - Fintech app needs cross-browser validation |
| API + UI Integration | Heavy - REST API + WebSocket testing (Playwright excels) |
| CI Parallelization | Important - Performance targets require fast parallel execution |
| Existing Test Coverage | Jest covers components; Playwright complements with E2E |

### Why Not Cypress

- Cypress has weaker WebSocket support (critical for this project)
- Playwright's native multi-browser support better suits fintech requirements
- CI parallelization more mature in Playwright

### Playwright Features Leveraged

- Native WebSocket support for real-time debate testing
- Multi-browser testing (Chromium, Firefox, WebKit)
- API testing for backend integration
- Trace viewer for debugging flaky tests
- Built-in auto-waiting for async operations

---

## Step 3: Scaffold Framework

### Directory Structure Created

```
trade-app/nextjs-frontend/tests/
├── .auth/                    # Auth state storage
├── config/                   # Environment configs (empty - using playwright.config.ts)
├── e2e/
│   ├── debate.spec.ts        # Debate page & streaming tests
│   ├── auth.spec.ts          # Authentication tests
│   └── voting.spec.ts        # Voting system tests
├── support/
│   ├── fixtures/
│   │   └── index.ts          # Merged fixtures with playwright-utils
│   ├── helpers/
│   │   ├── seed-helpers.ts   # API seeding utilities
│   │   └── ws-helpers.ts     # WebSocket testing helpers
│   ├── factories/
│   │   └── index.ts          # Faker-based data factories
│   └── global-setup.ts       # Auth state initialization
```

### Configuration Files Created

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Main config with env switching, projects, timeouts |
| `.env.example` | Updated with E2E test variables |
| `.nvmrc` | Node 22 LTS |

### Playwright Utils Integration

Using `@seontechnologies/playwright-utils` with `mergeTests`:
- `apiRequest` fixture for API calls
- `authSession` fixture for token persistence
- `recurse` fixture for polling/async operations
- `log` fixture for report logging

**Install command:** `pnpm add -D @seontechnologies/playwright-utils @faker-js/faker @playwright/test`

### Fixtures Implemented

| Fixture | Description |
|---------|-------------|
| `testUser` | Auto-generated test user |
| `testDebate` | Auto-generated debate data |
| `wsConnection` | WebSocket URL injection for E2E |

### Data Factories

- `createUser(overrides)` - User with faker data
- `createDebate(overrides)` - Debate with participants
- `createVote(overrides)` - Vote record
- `createAdminUser()`, `createAnalystUser()` - Role-specific users
- `createActiveDebate()`, `createCompletedDebate()` - Status-specific debates

### Sample Tests Created

| Test File | Coverage |
|-----------|----------|
| `debate.spec.ts` | Debate list, create form, streaming UI |
| `auth.spec.ts` | Login, logout, session persistence |
| `voting.spec.ts` | Vote submission, real-time updates, factory usage |

### Timeout Standards

- Action: 15s
- Navigation: 30s
- Expect: 10s
- Test: 60s (global)

### Projects Configured

- `chromium` - Desktop Chrome
- `firefox` - Desktop Firefox
- `webkit` - Desktop Safari
- `mobile-chrome` - Pixel 5
- `mobile-safari` - iPhone 13

### Reporters

- HTML (`playwright-report/`)
- JUnit XML (`test-results/results.xml`)
- Console list

### Artifacts

- `trace: 'on-first-retry'`
- `screenshot: 'only-on-failure'`
- `video: 'retain-on-failure'`

---

## Step 4: Documentation & Scripts

### README.md Created

Location: `trade-app/nextjs-frontend/tests/README.md`

**Contents:**
- Setup instructions (Node 22, pnpm, Playwright browsers)
- Environment configuration (.env setup)
- Running tests (all browsers, headed, debug, UI mode)
- Architecture overview (directory structure, fixtures, factories)
- Best practices (selectors, isolation, cleanup, WebSocket testing)
- CI integration (GitHub Actions, sharding)
- Debugging (trace viewer, screenshots, console logs)
- Knowledge base references

### package.json Scripts Added

| Script | Command | Purpose |
|--------|---------|---------|
| `test:e2e` | `playwright test` | Run all E2E tests |
| `test:e2e:ui` | `playwright test --ui` | Interactive UI mode |
| `test:e2e:debug` | `playwright test --debug` | Debug mode |
| `test:e2e:headed` | `playwright test --headed` | Visual debugging |
| `test:e2e:report` | `playwright show-report` | View HTML report |

### devDependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `@playwright/test` | ^1.49.0 | Playwright test runner |
| `@faker-js/faker` | ^9.0.0 | Test data generation |
| `@seontechnologies/playwright-utils` | ^1.0.0 | Playwright utilities |

### Next Step

Load: `step-05-validate-and-summary.md`

---

## Step 5: Validate & Summary

### Validation Checklist

#### Prerequisites ✅
- [x] package.json exists at `trade-app/nextjs-frontend/package.json`
- [x] No existing E2E framework detected
- [x] Project type identifiable (Next.js 16 + React 19)
- [x] Bundler identifiable (Next.js webpack)
- [x] Architecture documents located

#### Directory Structure ✅
- [x] `tests/` root directory created
- [x] `tests/e2e/` directory created
- [x] `tests/support/` directory created
- [x] `tests/support/fixtures/` directory created
- [x] `tests/support/factories/` directory created
- [x] `tests/support/helpers/` directory created
- [x] `tests/.auth/` directory created

#### Configuration Files ✅
- [x] `playwright.config.ts` created with TypeScript
- [x] Timeouts configured (action: 15s, navigation: 30s, test: 60s)
- [x] Base URL with environment fallback
- [x] Artifacts: retain-on-failure
- [x] Reporters: HTML + JUnit + console
- [x] Parallel execution enabled
- [x] CI settings configured

#### Environment Configuration ✅
- [x] `.env.example` updated with E2E variables
- [x] `TEST_ENV` variable defined
- [x] `BASE_URL`, `API_URL`, `WS_URL` defined
- [x] `FIXED_QA_TOKEN` for WebSocket auth
- [x] `.nvmrc` created (Node 22)

#### Fixture Architecture ✅
- [x] `tests/support/fixtures/index.ts` created
- [x] `mergeTests` pattern implemented
- [x] Playwright utils fixtures integrated
- [x] Custom fixtures (`testUser`, `testDebate`, `wsConnection`)

#### Data Factories ✅
- [x] `tests/support/factories/index.ts` created
- [x] Uses `@faker-js/faker`
- [x] Factories: `createUser`, `createDebate`, `createVote`
- [x] Role-specific: `createAdminUser`, `createAnalystUser`
- [x] Status-specific: `createActiveDebate`, `createCompletedDebate`

#### Sample Tests ✅
- [x] `tests/e2e/debate.spec.ts` - Debate page & streaming
- [x] `tests/e2e/auth.spec.ts` - Authentication flows
- [x] `tests/e2e/voting.spec.ts` - Voting system with factories
- [x] Tests use data-testid selectors
- [x] Tests use fixture architecture

#### Helper Utilities ✅
- [x] `seed-helpers.ts` - API seeding
- [x] `ws-helpers.ts` - WebSocket testing
- [x] `global-setup.ts` - Auth state initialization

#### Documentation ✅
- [x] `tests/README.md` complete
- [x] Setup instructions included
- [x] Running tests section included
- [x] Architecture overview included
- [x] Best practices included
- [x] CI integration included
- [x] Knowledge base references included

#### Package.json Updates ✅
- [x] `test:e2e` script added
- [x] `test:e2e:ui`, `test:e2e:debug`, `test:e2e:headed` added
- [x] Playwright dependencies added
- [x] Faker dependency added
- [x] Playwright utils dependency added

### Completion Summary

#### Framework Selected
**Playwright** - Selected for multi-browser support, WebSocket capabilities, and CI parallelization.

#### Artifacts Created

| Category | Files Created |
|----------|---------------|
| Config | `playwright.config.ts`, `.nvmrc` |
| Tests | `debate.spec.ts`, `auth.spec.ts`, `voting.spec.ts` |
| Fixtures | `fixtures/index.ts` (mergeTests pattern) |
| Factories | `factories/index.ts` (Faker-based) |
| Helpers | `seed-helpers.ts`, `ws-helpers.ts`, `global-setup.ts` |
| Docs | `tests/README.md`, `.env.example` (updated) |

#### Knowledge Fragments Applied
- `overview.md` - Playwright Utils design principles
- `fixtures-composition.md` - mergeTests patterns
- `auth-session.md` - Token persistence for API tests
- `data-factories.md` - Factory patterns with overrides
- `playwright-config.md` - Configuration guardrails

### Next Steps (User Actions)

1. **Install dependencies:**
   ```bash
   cd trade-app/nextjs-frontend
   pnpm install
   npx playwright install --with-deps
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with actual values
   ```

3. **Run tests:**
   ```bash
   pnpm test:e2e
   ```

4. **Verify setup:**
   - Ensure backend is running at `localhost:8000`
   - Ensure frontend is running at `localhost:3000`
   - Configure `FIXED_QA_TOKEN` for WebSocket tests

### Recommended Next Workflows
- `ci` workflow - Set up CI/CD pipeline
- `test-design` workflow - Plan test coverage
- `atdd` workflow - Develop stories with test-first approach

---

**Workflow Complete**
**Framework:** Playwright
**Completed by:** team mantis a
**Date:** 2026-02-18
