import { test as base, type Page } from '@playwright/test';

export const test = base.extend<{ mobileViewport: Page; debateWithMessages: Page; mockWebSocketStream: Page }>({
  mobileViewport: async ({ page }, use) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await use(page);
  },

  debateWithMessages: async ({ page }, use) => {
    await page.route('**/api/debate/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'test-debate-fixture',
            asset: 'btc',
            status: 'completed',
            messages: [
              {
                id: 'msg-1',
                role: 'bull',
                content: 'Bitcoin is showing strong bullish momentum with increasing volume.',
                timestamp: new Date(Date.now() - 60000).toISOString(),
              },
              {
                id: 'msg-2',
                role: 'bear',
                content: 'However, RSI indicates overbought conditions suggesting a potential reversal.',
                timestamp: new Date(Date.now() - 30000).toISOString(),
              },
              {
                id: 'msg-3',
                role: 'bull',
                content: 'The MACD crossover supports continued upward movement.',
                timestamp: new Date().toISOString(),
              },
            ],
          },
        }),
      });
    });

    await use(page);
  },

  mockWebSocketStream: async ({ page }, use) => {
    await page.addInitScript(() => {
      const messages: unknown[] = [];

      const originalWebSocket = window.WebSocket;
      class MockWebSocket extends originalWebSocket {
        constructor(url: string) {
          super(url);
          (window as Window & { __testWebSocket__?: WebSocket }).__testWebSocket__ = this;

          setTimeout(() => {
            if (this.onopen) {
              this.onopen(new Event('open'));
            }
            setTimeout(() => {
              this.simulateTokenStream();
            }, 100);
          }, 50);
        }

        simulateTokenStream() {
          const tokens = ['Hello', ', ', 'this ', 'is ', 'a ', 'test ', 'argument.'];
          let index = 0;

          const interval = setInterval(() => {
            if (index < tokens.length && this.readyState === 1) {
              const message = {
                type: 'DEBATE/TOKEN_RECEIVED',
                payload: {
                  debateId: 'test-debate',
                  agent: 'bull',
                  token: tokens[index],
                  turn: 1,
                },
                timestamp: new Date().toISOString(),
              };
              messages.push(message);
              if (this.onmessage) {
                this.onmessage({ data: JSON.stringify(message) } as MessageEvent);
              }
              index++;
            } else {
              clearInterval(interval);
              if (this.readyState === 1) {
                const completeMessage = {
                  type: 'DEBATE/ARGUMENT_COMPLETE',
                  payload: {
                    debateId: 'test-debate',
                    agent: 'bull',
                    content: tokens.join(''),
                    turn: 1,
                  },
                  timestamp: new Date().toISOString(),
                };
                messages.push(completeMessage);
                if (this.onmessage) {
                  this.onmessage({ data: JSON.stringify(completeMessage) } as MessageEvent);
                }
              }
            }
          }, 200);
        }

        send(data: string) {
          const parsed = JSON.parse(data);
          if (parsed.type === 'DEBATE/PONG') {
            return;
          }
        }
      }

      window.WebSocket = MockWebSocket as typeof WebSocket;
      (window as Window & { __testMessages__?: unknown[] }).__testMessages__ = messages;
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
