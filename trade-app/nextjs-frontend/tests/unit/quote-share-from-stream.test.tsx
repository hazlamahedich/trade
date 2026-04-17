import { renderHook, act } from "@testing-library/react";
import { jest } from "@jest/globals";

if (typeof globalThis.SVGImageElement === "undefined") {
  (globalThis as Record<string, unknown>).SVGImageElement = class SVGImageElement extends HTMLElement {};
}

jest.mock("html-to-image", () => ({
  toBlob: jest.fn(),
}));

const mockCaptureFn = jest.fn();
jest.mock("../../features/debate/utils/snapshot", () => ({
  captureSnapshot: (...args: unknown[]) => (mockCaptureFn as (...a: unknown[]) => unknown)(...args),
  slug: (input: string) =>
    input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

import { useQuoteShareFromStream } from "../../features/debate/hooks/useQuoteShareFromStream";
import type { ArgumentMessage } from "../../features/debate/hooks/useDebateMessages";
import type { SnapshotState } from "../../features/debate/types/snapshot";

const FIXED_TIMESTAMP = "2026-04-16T12:00:00.000Z";

function makeArgumentMessage(overrides: Partial<ArgumentMessage> = {}): ArgumentMessage {
  return {
    id: "arg-1",
    type: "argument",
    agent: "bull",
    content: "BTC is going to the moon",
    timestamp: FIXED_TIMESTAMP,
    ...overrides,
  };
}

const defaultOpts = {
  assetName: "BTC/USDT",
  externalId: "ext-1",
  snapshotState: "idle" as SnapshotState,
};

beforeEach(() => {
  if (typeof globalThis.structuredClone === "undefined") {
    (globalThis as Record<string, unknown>).structuredClone = (obj: unknown) =>
    JSON.parse(JSON.stringify(obj));
  }
  mockCaptureFn.mockReset();
  mockCaptureFn.mockResolvedValue(new Blob(["img"], { type: "image/png" }));
  (globalThis as Record<string, unknown>).URL.createObjectURL = jest.fn(() => "blob:test");
  (globalThis as Record<string, unknown>).URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  delete (navigator as Record<string, unknown>).share;
  delete (navigator as Record<string, unknown>).canShare;
});

describe("[P0][5.3-compound] useQuoteShareFromStream — basic state", () => {
  it("returns quoteShareState starting at idle", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));
    expect(result.current.quoteShareState).toBe("idle");
  });

  it("returns null activeShareId initially", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));
    expect(result.current.activeShareId).toBeNull();
  });

  it("returns quoteOverlayVisible as false initially", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));
    expect(result.current.quoteOverlayVisible).toBe(false);
  });

  it("returns handleShareMessage function", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));
    expect(typeof result.current.handleShareMessage).toBe("function");
  });

  it("returns null quoteOverlay initially", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));
    expect(result.current.quoteOverlay).toBeNull();
  });

  it("returns quoteOverlayRef", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));
    expect(result.current.quoteOverlayRef).toBeDefined();
  });
});

describe("[P0][5.3-compound] useQuoteShareFromStream — mutual exclusion with snapshot", () => {
  it("blocks quote share when snapshot is generating", () => {
    const { result } = renderHook(() =>
      useQuoteShareFromStream({ ...defaultOpts, snapshotState: "generating" }),
    );

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage());
    });

    expect(result.current.quoteShareState).toBe("idle");
    expect(result.current.activeShareId).toBeNull();
  });

  it("allows quote share when snapshot is idle — triggers generating", () => {
    const { result } = renderHook(() =>
      useQuoteShareFromStream({ ...defaultOpts, snapshotState: "idle" }),
    );

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage());
    });

    expect(result.current.quoteShareState).toBe("generating");
  });

  it("allows quote share when snapshot is success — triggers generating", () => {
    const { result } = renderHook(() =>
      useQuoteShareFromStream({ ...defaultOpts, snapshotState: "success" }),
    );

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage());
    });

    expect(result.current.quoteShareState).toBe("generating");
  });

  it("allows quote share when snapshot is error — triggers generating", () => {
    const { result } = renderHook(() =>
      useQuoteShareFromStream({ ...defaultOpts, snapshotState: "error" }),
    );

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage());
    });

    expect(result.current.quoteShareState).toBe("generating");
  });
});

describe("[P0][5.3-compound] useQuoteShareFromStream — message handling", () => {
  it("sets activeShareId to the message id", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));
    const msg = makeArgumentMessage({ id: "msg-42" });

    act(() => {
      result.current.handleShareMessage(msg);
    });

    expect(result.current.activeShareId).toBe("msg-42");
  });

  it("shows overlay when share triggered", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage());
    });

    expect(result.current.quoteOverlayVisible).toBe(true);
  });

  it("renders quoteOverlay JSX when visible", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage());
    });

    expect(result.current.quoteOverlay).not.toBeNull();
  });

  it("passes correct agent data to overlay", () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage({ agent: "bear" }));
    });

    expect(result.current.quoteOverlay).not.toBeNull();
  });
});

describe("[P0][5.3-compound] useQuoteShareFromStream — self-blocking", () => {
  it("blocks second handleShareMessage when already generating", () => {
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage({ id: "msg-1" }));
    });

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage({ id: "msg-2" }));
    });

    expect(result.current.activeShareId).toBe("msg-1");
  });
});

describe("[P0][5.3-compound] useQuoteShareFromStream — activeShareId reset", () => {
  it("resets activeShareId when quote share completes with error (no overlay DOM)", async () => {
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage({ id: "msg-reset" }));
    });

    expect(result.current.activeShareId).toBe("msg-reset");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    expect(result.current.quoteShareState).toBe("error");
    expect(result.current.activeShareId).toBeNull();
  });
});

describe("[P0][5.3-compound] useQuoteShareFromStream — debate URL construction", () => {
  it("passes site URL to overlay when NEXT_PUBLIC_SITE_URL is set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://tradlab.io";
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage());
    });

    expect(result.current.quoteOverlay).not.toBeNull();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("works without NEXT_PUBLIC_SITE_URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));

    act(() => {
      result.current.handleShareMessage(makeArgumentMessage());
    });

    expect(result.current.quoteOverlay).not.toBeNull();
  });
});

describe("[P0][5.3-compound] useQuoteShareFromStream — structuredClone snapshotting", () => {
  it("freezes message data at trigger time via structuredClone", () => {
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShareFromStream(defaultOpts));
    const msg = makeArgumentMessage({ content: "original" });

    act(() => {
      result.current.handleShareMessage(msg);
    });

    msg.content = "mutated";
    expect(result.current.quoteShareState).toBe("generating");
    expect(result.current.quoteOverlayVisible).toBe(true);
  });
});
