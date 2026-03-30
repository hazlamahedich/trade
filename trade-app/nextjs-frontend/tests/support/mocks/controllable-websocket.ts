import { type Page } from '@playwright/test';

export async function setupControllableWebSocket(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__WS_MESSAGES__ = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__WS_CONNECTED__ = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__testWebSocket__ = null;

    class ControllableWebSocket {
      onopen: ((ev: Event) => void) | null = null;
      onclose: ((ev: CloseEvent) => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      readyState = 0;
      url: string;

      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url: string | URL) {
        this.url = url.toString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__testWebSocket__ = this;

        setTimeout(() => {
          this.readyState = 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__WS_CONNECTED__ = true;
          if (this.onopen) {
            this.onopen(new Event('open'));
          }
        }, 100);
      }

      send(data: string): void {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'DEBATE/PONG') return;
        } catch {
          // swallow
        }
      }

      close(code = 1000, reason = ''): void {
        this.readyState = 3;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__WS_CONNECTED__ = false;
        if (this.onclose) {
          this.onclose(new CloseEvent('close', { code, reason }));
        }
      }

      addEventListener(): void { /* noop */ }
      removeEventListener(): void { /* noop */ }
      dispatchEvent(): boolean { return true; }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.WebSocket = ControllableWebSocket as any;
  });
}

export async function waitForMockConnection(page: Page): Promise<void> {
  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__WS_CONNECTED__ === true,
    { timeout: 10_000 },
  );
}

export async function injectStaleDataMessage(
  page: Page,
  debateId: string,
  ageSeconds: number,
  lastUpdate: string | null,
): Promise<void> {
  await page.evaluate(
    ({ debateId, ageSeconds, lastUpdate }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (window as any).__testWebSocket__;
      if (ws && ws.onmessage) {
        const message = {
          type: 'DEBATE/DATA_STALE',
          payload: {
            debateId,
            lastUpdate,
            ageSeconds,
            message: `Market data is ${ageSeconds} seconds old`,
          },
          timestamp: new Date().toISOString(),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__WS_MESSAGES__.push(message);
        ws.onmessage({ data: JSON.stringify(message) } as MessageEvent);
      }
    },
    { debateId, ageSeconds, lastUpdate },
  );
}

export async function injectDataRefreshedMessage(
  page: Page,
  debateId: string,
): Promise<void> {
  await page.evaluate((debateId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (window as any).__testWebSocket__;
    if (ws && ws.onmessage) {
      const message = {
        type: 'DEBATE/DATA_REFRESHED',
        payload: {
          debateId,
          message: 'Market data has been refreshed',
        },
        timestamp: new Date().toISOString(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__WS_MESSAGES__.push(message);
      ws.onmessage({ data: JSON.stringify(message) } as MessageEvent);
    }
  }, debateId);
}
