import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
} from '../support/helpers/ws-helpers';
import { setupApiMocks } from '../support/helpers/api-mock';

test.describe('[2-4] Forbidden Phrase Filter — Redacted Argument Display (P0)', () => {
  test('[2-4-E2E-001] Redacted argument displays [REDACTED] in debate stream @p0', async ({ page }) => {
    await setupApiMocks(page);

    await page.addInitScript(() => {
      const messages: unknown[] = [];
      const originalWebSocket = window.WebSocket;

      class RedactedMockWebSocket extends originalWebSocket {
        constructor(url: string) {
          super(url);
          (window as Window & { __testWebSocket__?: WebSocket }).__testWebSocket__ = this;

          setTimeout(() => {
            if (this.onopen) {
              this.onopen(new Event('open'));
            }

            setTimeout(() => {
              if (this.readyState === 1 && this.onmessage) {
                const redactedMessage = {
                  type: 'DEBATE/ARGUMENT_COMPLETE',
                  payload: {
                    debateId: 'test-debate-redacted',
                    agent: 'bull',
                    content: 'This is a [REDACTED] profit opportunity with strong fundamentals.',
                    turn: 1,
                    isRedacted: true,
                  },
                  timestamp: new Date().toISOString(),
                };
                messages.push(redactedMessage);
                this.onmessage({ data: JSON.stringify(redactedMessage) } as MessageEvent);
              }
            }, 300);
          }, 50);
        }

        send(data: string) {
          const parsed = JSON.parse(data);
          if (parsed.type === 'DEBATE/PONG') return;
        }
      }

      window.WebSocket = RedactedMockWebSocket as typeof WebSocket;
      (window as Window & { __testMessages__?: unknown[] }).__testMessages__ = messages;
    });

    await page.goto('/debates/test-debate-redacted');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('[REDACTED]')).toBeVisible({ timeout: 10000 });

    const argumentBubble = page.locator('[data-agent="bull"]').first();
    await expect(argumentBubble).toBeVisible();

    const content = page.locator('[data-testid="argument-content"]').first();
    await expect(content).toContainText('[REDACTED]');
  });

  test('[2-4-E2E-002] Non-redacted argument displays normally without [REDACTED] @p0', async ({ page }) => {
    await setupApiMocks(page);

    await page.addInitScript(() => {
      const originalWebSocket = window.WebSocket;

      class CleanMockWebSocket extends originalWebSocket {
        constructor(url: string) {
          super(url);
          (window as Window & { __testWebSocket__?: WebSocket }).__testWebSocket__ = this;

          setTimeout(() => {
            if (this.onopen) {
              this.onopen(new Event('open'));
            }

            setTimeout(() => {
              if (this.readyState === 1 && this.onmessage) {
                const cleanMessage = {
                  type: 'DEBATE/ARGUMENT_COMPLETE',
                  payload: {
                    debateId: 'test-debate-clean',
                    agent: 'bear',
                    content: 'Market conditions suggest potential downside risk due to regulatory uncertainty.',
                    turn: 1,
                    isRedacted: false,
                  },
                  timestamp: new Date().toISOString(),
                };
                this.onmessage({ data: JSON.stringify(cleanMessage) } as MessageEvent);
              }
            }, 300);
          }, 50);
        }

        send(data: string) {
          const parsed = JSON.parse(data);
          if (parsed.type === 'DEBATE/PONG') return;
        }
      }

      window.WebSocket = CleanMockWebSocket as typeof WebSocket;
    });

    await page.goto('/debates/test-debate-clean');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('regulatory uncertainty')).toBeVisible({ timeout: 10000 });

    const content = page.locator('[data-testid="argument-content"]').first();
    await expect(content).toBeVisible();
    await expect(content).not.toContainText('[REDACTED]');
  });

  test('[2-4-E2E-003] Multiple redacted arguments across turns @p1', async ({ page }) => {
    await setupApiMocks(page);

    await page.addInitScript(() => {
      const originalWebSocket = window.WebSocket;
      let messageIndex = 0;

      class MultiRedactedWebSocket extends originalWebSocket {
        constructor(url: string) {
          super(url);
          (window as Window & { __testWebSocket__?: WebSocket }).__testWebSocket__ = this;

          setTimeout(() => {
            if (this.onopen) {
              this.onopen(new Event('open'));
            }

            const messages = [
              {
                type: 'DEBATE/ARGUMENT_COMPLETE',
                payload: {
                  debateId: 'test-debate-multi',
                  agent: 'bull',
                  content: 'This is a [REDACTED] investment with [REDACTED] returns.',
                  turn: 1,
                  isRedacted: true,
                },
                timestamp: new Date().toISOString(),
              },
              {
                type: 'DEBATE/ARGUMENT_COMPLETE',
                payload: {
                  debateId: 'test-debate-multi',
                  agent: 'bear',
                  content: 'However, there are significant risks including market volatility.',
                  turn: 2,
                  isRedacted: false,
                },
                timestamp: new Date().toISOString(),
              },
            ];

            const sendNext = () => {
              if (messageIndex < messages.length && this.readyState === 1 && this.onmessage) {
                this.onmessage({ data: JSON.stringify(messages[messageIndex]) } as MessageEvent);
                messageIndex++;
                setTimeout(sendNext, 500);
              }
            };

            setTimeout(sendNext, 300);
          }, 50);
        }

        send(data: string) {
          const parsed = JSON.parse(data);
          if (parsed.type === 'DEBATE/PONG') return;
        }
      }

      window.WebSocket = MultiRedactedWebSocket as typeof WebSocket;
    });

    await page.goto('/debates/test-debate-multi');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    const redactedContents = page.locator('[data-testid="argument-content"]');
    await expect(redactedContents.first()).toContainText('[REDACTED]', { timeout: 10000 });

    await expect(page.getByText('market volatility')).toBeVisible({ timeout: 10000 });
  });

  test('[2-4-E2E-004] Streaming tokens replaced by redacted ARGUMENT_COMPLETE @p1', async ({ page }) => {
    await setupApiMocks(page);

    await page.addInitScript(() => {
      const originalWebSocket = window.WebSocket;

      class StreamingRedactedWebSocket extends originalWebSocket {
        constructor(url: string) {
          super(url);
          (window as Window & { __testWebSocket__?: WebSocket }).__testWebSocket__ = this;

          setTimeout(() => {
            if (this.onopen) {
              this.onopen(new Event('open'));
            }

            const tokens = ['This', ' ', 'is', ' ', 'guaranteed', ' ', 'profit'];
            let index = 0;

            const interval = setInterval(() => {
              if (this.readyState === 1 && this.onmessage) {
                if (index < tokens.length) {
                  const tokenMsg = {
                    type: 'DEBATE/TOKEN_RECEIVED',
                    payload: {
                      debateId: 'test-stream-redacted',
                      agent: 'bull',
                      token: tokens[index],
                      turn: 1,
                    },
                    timestamp: new Date().toISOString(),
                  };
                  this.onmessage({ data: JSON.stringify(tokenMsg) } as MessageEvent);
                  index++;
                } else {
                  clearInterval(interval);
                  const completeMsg = {
                    type: 'DEBATE/ARGUMENT_COMPLETE',
                    payload: {
                      debateId: 'test-stream-redacted',
                      agent: 'bull',
                      content: 'This is [REDACTED] profit',
                      turn: 1,
                      isRedacted: true,
                    },
                    timestamp: new Date().toISOString(),
                  };
                  this.onmessage({ data: JSON.stringify(completeMsg) } as MessageEvent);
                }
              }
            }, 100);
          }, 50);
        }

        send(data: string) {
          const parsed = JSON.parse(data);
          if (parsed.type === 'DEBATE/PONG') return;
        }
      }

      window.WebSocket = StreamingRedactedWebSocket as typeof WebSocket;
    });

    await page.goto('/debates/test-stream-redacted');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('[REDACTED]')).toBeVisible({ timeout: 15000 });

    const content = page.locator('[data-testid="argument-content"]').first();
    await expect(content).toContainText('[REDACTED]');
    await expect(content).toContainText('profit');
  });
});
