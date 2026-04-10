import { Page } from '@playwright/test';

interface WindowWithWS {
  __WS_CONNECTED__?: boolean;
  __WS_MESSAGES__?: WSMessage[];
  __WS_SENT_MESSAGES__?: WSMessage[];
  __testWebSocket__?: WebSocket;
}

interface WSMessage {
  raw?: string;
  [key: string]: unknown;
}

export async function waitForWebSocketConnection(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return (window as WindowWithWS).__testWebSocket__ != null;
  });
}

export async function waitForDebateStream(page: Page, expectedText: string): Promise<void> {
  await page.waitForFunction(
    (text: string) => {
      const debateContent = document.querySelector('[data-testid="debate-stream"]');
      return debateContent?.textContent?.includes(text) ?? false;
    },
    expectedText,
    { timeout: 30000 }
  );
}

export async function getWebSocketMessages(page: Page): Promise<WSMessage[]> {
  return await page.evaluate(() => {
    return (window as WindowWithWS).__WS_MESSAGES__ || [];
  });
}

export async function clearWebSocketMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as WindowWithWS).__WS_MESSAGES__ = [];
  });
}

export async function getSentWebSocketMessages(page: Page): Promise<WSMessage[]> {
  return await page.evaluate(() => {
    return (window as WindowWithWS).__WS_SENT_MESSAGES__ || [];
  });
}

export async function clearSentWebSocketMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as WindowWithWS).__WS_SENT_MESSAGES__ = [];
  });
}

/**
 * Simulate an incoming WebSocket message by dispatching it to the stored
 * WebSocket instance's onmessage handler.
 */
export async function sendWebSocketMessage(
  page: Page,
  message: Record<string, unknown>,
): Promise<void> {
  await page.evaluate((msg) => {
    const ws = (window as WindowWithWS).__testWebSocket__;
    if (!ws) {
      throw new Error('No WebSocket instance found — did injectWebSocketInterceptor run?');
    }
    const data = JSON.stringify(msg);
    const event = new MessageEvent('message', { data });
    // Invoke onmessage handler directly (used by useDebateSocket hook)
    if (ws.onmessage) {
      ws.onmessage(event as MessageEvent);
    }
    // Also dispatch for addEventListener subscribers
    ws.dispatchEvent(event);
  }, message);
}

export async function injectWebSocketInterceptor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as WindowWithWS).__WS_MESSAGES__ = [];
    (window as WindowWithWS).__WS_SENT_MESSAGES__ = [];
    (window as WindowWithWS).__WS_CONNECTED__ = false;

    const originalWebSocket = window.WebSocket;
    window.WebSocket = class extends originalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);

        (window as WindowWithWS).__testWebSocket__ = this;

        const originalSend = this.send.bind(this);
        this.send = (data: string) => {
          try {
            const parsed = JSON.parse(data);
            (window as WindowWithWS).__WS_SENT_MESSAGES__!.push(parsed);
          } catch {
            (window as WindowWithWS).__WS_SENT_MESSAGES__!.push({ raw: data });
          }
          return originalSend(data);
        };

        this.addEventListener('open', () => {
          (window as WindowWithWS).__WS_CONNECTED__ = true;
        });

        this.addEventListener('message', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            (window as WindowWithWS).__WS_MESSAGES__!.push(data);
          } catch {
            (window as WindowWithWS).__WS_MESSAGES__!.push({ raw: event.data });
          }
        });

        this.addEventListener('close', () => {
          (window as WindowWithWS).__WS_CONNECTED__ = false;
        });
      }
    };
  });
}
