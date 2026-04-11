import { Page } from '@playwright/test';

export interface MockWSMessage {
  type: string;
  payload: Record<string, unknown>;
  delay?: number;
}

export interface MockWSOptions {
  messages: MockWSMessage[];
  tokenMessages?: string[];
  tokenInterval?: number;
  onComplete?: MockWSMessage;
}

export function buildMockWebSocketInitScript(options: MockWSOptions): () => void {
  return () => {
    const originalWebSocket = window.WebSocket;
    const allMessages: unknown[] = [];

    class ScriptedMockWebSocket extends originalWebSocket {
      constructor(url: string) {
        super(url);
        (window as Window & { __testWebSocket__?: WebSocket }).__testWebSocket__ = this;

        queueMicrotask(() => {
          if (this.onopen) {
            this.onopen(new Event('open'));
          }

          if (options.tokenMessages && options.tokenMessages.length > 0) {
            let index = 0;
            const interval = setInterval(() => {
              if (this.readyState === 1 && this.onmessage && index < options.tokenMessages.length) {
                const tokenMsg = {
                  type: 'DEBATE/TOKEN_RECEIVED',
                  payload: {
                    debateId: 'test-debate',
                    agent: 'bull',
                    token: options.tokenMessages[index],
                    turn: 1,
                  },
                  timestamp: new Date().toISOString(),
                };
                allMessages.push(tokenMsg);
                this.onmessage({ data: JSON.stringify(tokenMsg) } as MessageEvent);
                index++;
              } else {
                clearInterval(interval);
                if (options.onComplete && this.readyState === 1 && this.onmessage) {
                  const completeMsg = {
                    ...options.onComplete,
                    timestamp: new Date().toISOString(),
                  };
                  allMessages.push(completeMsg);
                  this.onmessage({ data: JSON.stringify(completeMsg) } as MessageEvent);
                }
              }
            }, options.tokenInterval ?? 100);
          } else {
            let delay = 0;
            for (const msg of options.messages) {
              delay += msg.delay ?? 0;
              const deliverAt = delay;
              setTimeout(() => {
                if (this.readyState === 1 && this.onmessage) {
                  const fullMsg = {
                    ...msg,
                    timestamp: new Date().toISOString(),
                  };
                  allMessages.push(fullMsg);
                  this.onmessage({ data: JSON.stringify(fullMsg) } as MessageEvent);
                }
              }, deliverAt);
            }
          }
        });
      }

      send(data: string) {
        const parsed = JSON.parse(data);
        if (parsed.type === 'DEBATE/PONG') return;
      }
    }

    window.WebSocket = ScriptedMockWebSocket as typeof WebSocket;
    (window as Window & { __testMessages__?: unknown[] }).__testMessages__ = allMessages;
  };
}

export async function setupMockedWebSocketPage(
  page: Page,
  options: MockWSOptions,
): Promise<void> {
  await page.addInitScript(buildMockWebSocketInitScript(options));
}
