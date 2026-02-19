import { Page } from '@playwright/test';

interface WindowWithWS {
  __WS_CONNECTED__?: boolean;
  __WS_MESSAGES__?: WSMessage[];
}

interface WSMessage {
  raw?: string;
  [key: string]: unknown;
}

export async function waitForWebSocketConnection(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return (window as WindowWithWS).__WS_CONNECTED__ === true;
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

export async function injectWebSocketInterceptor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as WindowWithWS).__WS_MESSAGES__ = [];
    (window as WindowWithWS).__WS_CONNECTED__ = false;

    const originalWebSocket = window.WebSocket;
    window.WebSocket = class extends originalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);

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
