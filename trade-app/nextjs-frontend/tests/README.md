# E2E Test Framework

AI Trading Debate Lab - Playwright-based end-to-end testing framework.

## Setup

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 10.7.1+

### Installation

```bash
cd trade-app/nextjs-frontend

# Install dependencies
pnpm install

# Install Playwright browsers
npx playwright install --with-deps

# Install Playwright utils (recommended)
pnpm add -D @seontechnologies/playwright-utils @faker-js/faker @playwright/test
```

### Environment Configuration

1. Copy `.env.example` to `.env`
2. Configure environment variables:

```bash
# Test Environment: local, staging, production
TEST_ENV=local

# URLs
BASE_URL=http://localhost:3000
API_URL=http://localhost:8000
WS_URL=ws://localhost:8000/ws

# Test Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123

# Fixed QA Token for WebSocket tests
FIXED_QA_TOKEN=your-fixed-qa-token-here
```

## Running Tests

### All Tests

```bash
pnpm test:e2e
```

### Specific Browser

```bash
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
```

### Mobile Tests

```bash
pnpm test:e2e --project=mobile-chrome
pnpm test:e2e --project=mobile-safari
```

### Headed Mode (Visual Debugging)

```bash
pnpm test:e2e --headed
```

### Debug Mode

```bash
pnpm test:e2e --debug
```

### UI Mode (Interactive)

```bash
pnpm test:e2e --ui
```

### Specific Test File

```bash
pnpm test:e2e tests/e2e/debate.spec.ts
```

### Specific Test by Name

```bash
pnpm test:e2e -g "should display the debate list page"
```

## Architecture

### Directory Structure

```
tests/
├── .auth/                    # Authentication state storage
├── config/                   # Environment-specific configurations
├── e2e/                      # End-to-end test specifications
│   ├── debate.spec.ts        # Debate page tests
│   ├── auth.spec.ts          # Authentication tests
│   └── voting.spec.ts        # Voting system tests
├── support/
│   ├── fixtures/             # Playwright fixtures (mergeTests)
│   ├── helpers/              # Test utilities
│   │   ├── seed-helpers.ts   # API data seeding
│   │   └── ws-helpers.ts     # WebSocket testing
│   ├── factories/            # Faker-based data factories
│   └── global-setup.ts       # Auth initialization
└── README.md                 # This file
```

### Fixtures

This project uses `@seontechnologies/playwright-utils` with merged fixtures:

```typescript
import { test, expect } from '../support/fixtures';

test('authenticated request', async ({ apiRequest, authToken, page }) => {
  // All fixtures available in single import
});
```

**Available Fixtures:**
- `apiRequest` - Typed HTTP client with retry logic
- `authToken` - JWT token persistence
- `recurse` - Polling for async operations
- `log` - Report-integrated logging
- `testUser` - Auto-generated test user
- `testDebate` - Auto-generated debate data
- `wsConnection` - WebSocket URL injection

### Data Factories

Generate test data with factories (prevents parallel collisions):

```typescript
import { createUser, createDebate, createAdminUser } from '../support/factories';

// Default user
const user = createUser();

// With overrides (explicit intent)
const admin = createAdminUser({ email: 'admin@test.com' });

// Debate with custom ticker
const debate = createDebate({ ticker: 'BTC', status: 'active' });
```

### Seeding Data

Always seed via API, never via UI:

```typescript
import { seedDebate, cleanupDebate } from '../support/helpers/seed-helpers';

test('vote on debate', async ({ page, request }) => {
  const debate = await seedDebate(request, { ticker: 'ETH' });
  
  // Test logic...
  
  await cleanupDebate(request, debate.id);
});
```

## Best Practices

### Selectors

Use `data-testid` attributes for stable selectors:

```typescript
// Good
await page.click('[data-testid="submit-button"]');
await expect(page.getByTestId('error-message')).toBeVisible();

// Avoid
await page.click('.btn-primary');  // Brittle
await page.click('button:has-text("Submit")');  // Flaky
```

### Test Isolation

Each test should be independent:

```typescript
// Good: Factory data per test
test('vote on debate', async ({ page, request }) => {
  const debate = await seedDebate(request);  // Unique per test
  // ...
});

// Bad: Shared state
let sharedDebate;  // Causes parallel conflicts
```

### Cleanup

Always clean up seeded data:

```typescript
test.afterEach(async ({ request }) => {
  if (debateId) {
    await cleanupDebate(request, debateId);
  }
});
```

### WebSocket Testing

Use the WebSocket helper for real-time testing:

```typescript
import { injectWebSocketInterceptor, waitForWebSocketConnection } from '../support/helpers/ws-helpers';

test('streaming debate', async ({ page }) => {
  await injectWebSocketInterceptor(page);
  await page.goto('/debates/123');
  await waitForWebSocketConnection(page);
  
  // Test WebSocket behavior
});
```

## CI Integration

### GitHub Actions

Tests run automatically on push/PR:

```yaml
# .github/workflows/e2e.yml
- name: Run E2E tests
  run: pnpm test:e2e
  env:
    TEST_ENV: staging

- name: Upload results on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

### Sharding (Parallel CI)

Split tests across multiple runners:

```bash
# Shard 1 of 4
TEST_ENV=staging SHARD_INDEX=1 SHARD_TOTAL=4 pnpm test:e2e
```

### Artifacts

On failure, these are captured:
- `playwright-report/` - HTML report
- `test-results/` - Screenshots, videos, traces
- `test-results/results.xml` - JUnit XML

## Debugging

### Trace Viewer

```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

### Screenshots & Videos

Located in `test-results/[test-name]/` after failure.

### Console Logs

```typescript
test('debug test', async ({ page }) => {
  page.on('console', msg => console.log(msg.text()));
  // ...
});
```

## Knowledge Base References

This framework follows TEA (Test Engineering Architecture) patterns:

- `fixture-architecture.md` - Composable fixture patterns
- `data-factories.md` - Factory patterns with overrides
- `playwright-config.md` - Configuration guardrails
- `auth-session.md` - Token persistence patterns
- `network-first.md` - Network interception

## Troubleshooting

### Tests Timeout

- Check if backend is running (`localhost:8000`)
- Verify `FIXED_QA_TOKEN` is set for WebSocket tests
- Increase timeout for slow operations

### Auth Failures

- Verify `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`
- Check auth state in `tests/.auth/user.json`
- Re-run global setup: delete `.auth/` and re-run tests

### WebSocket Connection Issues

- Verify `WS_URL` matches backend
- Check `FIXED_QA_TOKEN` validity
- Ensure backend WebSocket endpoint is accessible
