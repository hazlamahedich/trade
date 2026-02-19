import { test as base, expect } from '@playwright/test';
import { createUser, createDebate } from '../factories';

type TestUser = ReturnType<typeof createUser>;
type TestDebate = ReturnType<typeof createDebate>;

interface Fixtures {
  testUser: TestUser;
  testDebate: TestDebate;
  wsConnection: { wsUrl: string; token: string };
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  testUser: async ({}, use) => {
    const user = createUser();
    await use(user);
  },

  // eslint-disable-next-line no-empty-pattern
  testDebate: async ({}, use) => {
    const debate = createDebate();
    await use(debate);
  },

  wsConnection: async ({ page }, use) => {
    const wsUrl = process.env.WS_URL || 'ws://localhost:8000/ws';
    const token = process.env.FIXED_QA_TOKEN || '';
    
    await page.addInitScript(`
      window.__E2E_WS_URL__ = '${wsUrl}';
      window.__E2E_QA_TOKEN__ = '${token}';
    `);
    
    await use({ wsUrl, token });
  },
});

export { expect };
