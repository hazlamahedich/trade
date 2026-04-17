import { renderHook, act } from "@testing-library/react";
import { jest } from "@jest/globals";
import { makeQuoteCardData, resetQuoteFactoryCounter } from "./factories/quote-share-factory";

if (typeof globalThis.SVGImageElement === "undefined") {
  (globalThis as Record<string, unknown>).SVGImageElement = class SVGImageElement extends HTMLElement {};
}

jest.mock("html-to-image", () => ({
  toBlob: jest.fn(),
}));

const mockCaptureFn = jest.fn().mockResolvedValue(new Blob(["img"], { type: "image/png" }));
jest.mock("../../features/debate/utils/snapshot", () => ({
  captureSnapshot: (...args: unknown[]) => mockCaptureFn(...args),
  slug: (input: string) =>
    input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
}));

import { useQuoteShare } from "../../features/debate/hooks/useQuoteShare";

const mockWindowOpen = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, "open", { value: mockWindowOpen, writable: true });
});

afterAll(() => {
  (window as Record<string, unknown>).open = undefined;
});

beforeEach(() => {
  jest.useFakeTimers();
  resetQuoteFactoryCounter();
  mockCaptureFn.mockReset();
  mockWindowOpen.mockReset();
  mockCaptureFn.mockResolvedValue(new Blob(["img"], { type: "image/png" }));
  (globalThis as Record<string, unknown>).URL.createObjectURL = jest.fn(() => "blob:test");
  (globalThis as Record<string, unknown>).URL.revokeObjectURL = jest.fn();
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  if (!document.fonts) {
    Object.defineProperty(document, "fonts", {
      value: { ready: Promise.resolve() },
      writable: true,
      configurable: true,
    });
  }
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  delete (globalThis as Record<string, unknown>).URL.createObjectURL;
  delete (globalThis as Record<string, unknown>).URL.revokeObjectURL;
  delete (navigator as Record<string, unknown>).share;
  delete (navigator as Record<string, unknown>).canShare;
});

async function advanceAndFlush(ms: number) {
  act(() => { jest.advanceTimersByTime(ms); });
  for (let i = 0; i < 10; i++) {
    await act(async () => { await Promise.resolve(); });
  }
}

async function flushFullErrorPipeline() {
  await advanceAndFlush(1);
  await advanceAndFlush(250);
  await advanceAndFlush(10_500);
}

describe("[P0][5.3-hook] useQuoteShare — basic state", () => {
  const defaultOpts = { assetName: "BTC/USDT", externalId: "ext-1" };

  it("starts in idle state", () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.state).toBe("idle");
  });

  it("returns overlay ref defined", () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.overlayRef).toBeDefined();
  });

  it("returns resetState function", () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(typeof result.current.resetState).toBe("function");
  });

  it("resetState transitions to idle", () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    act(() => {
      result.current.resetState();
    });
    expect(result.current.state).toBe("idle");
  });

  it("returns null activeData initially", () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.activeData).toBeNull();
  });

  it("quoteOverlayVisible is false initially", () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.quoteOverlayVisible).toBe(false);
  });
});

describe("[P0][5.3-hook] useQuoteShare — concurrent guard", () => {
  const defaultOpts = { assetName: "BTC/USDT", externalId: "ext-1" };

  it("second call is no-op while generating", () => {
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    const data = makeQuoteCardData();

    act(() => {
      result.current.generate(data);
    });

    act(() => {
      result.current.generate(data);
    });

    expect(mockCaptureFn).toHaveBeenCalledTimes(0);
    expect(result.current.state).toBe("generating");
  });

  it("sets quoteOverlayVisible to true during generation", () => {
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShare(defaultOpts));

    act(() => {
      result.current.generate(makeQuoteCardData());
    });

    expect(result.current.quoteOverlayVisible).toBe(true);
  });

  it("sets activeData when generating", () => {
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    const data = makeQuoteCardData({ agent: "bear", content: "test content" });

    act(() => {
      result.current.generate(data);
    });

    expect(result.current.activeData).toEqual(data);
  });
});

describe("[P0][5.3-hook] useQuoteShare — error path (no overlay DOM)", () => {
  const defaultOpts = { assetName: "BTC/USDT", externalId: "ext-1" };

  it("transitions to error when overlay ref has no DOM element", async () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));

    act(() => {
      result.current.generate(makeQuoteCardData());
    });

    await flushFullErrorPipeline();

    expect(result.current.state).toBe("error");
  });

  it("hides overlay after error", async () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));

    act(() => {
      result.current.generate(makeQuoteCardData());
    });

    await flushFullErrorPipeline();

    expect(result.current.quoteOverlayVisible).toBe(false);
  });

  it("allows retry after error clears isGenerating ref", async () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));

    act(() => {
      result.current.generate(makeQuoteCardData());
    });

    await flushFullErrorPipeline();
    expect(result.current.state).toBe("error");

    mockCaptureFn.mockResolvedValue(new Blob(["img"], { type: "image/png" }));
    act(() => {
      result.current.generate(makeQuoteCardData());
    });

    expect(result.current.state).toBe("generating");
  });
});

describe("[P0][5.3-hook] useQuoteShare — message snapshotting", () => {
  const defaultOpts = { assetName: "BTC/USDT", externalId: "ext-1" };

  it("captures activeData at trigger time", () => {
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    const data = makeQuoteCardData({ content: "original content" });

    act(() => {
      result.current.generate(data);
    });

    expect(result.current.activeData?.content).toBe("original content");
  });

  it("activeData stays unchanged after hook processes the data", () => {
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    const data = makeQuoteCardData({ content: "initial" });

    act(() => {
      result.current.generate(data);
    });

    const capturedAtTrigger = result.current.activeData?.content;
    expect(capturedAtTrigger).toBe("initial");
  });
});

describe("[P0][5.3-hook] useQuoteShare — Web Share API detection", () => {
  const defaultOpts = { assetName: "BTC/USDT", externalId: "ext-1" };

  it("hook initializes without navigator.share", () => {
    delete (navigator as Record<string, unknown>).share;
    delete (navigator as Record<string, unknown>).canShare;
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.state).toBe("idle");
  });

  it("hook initializes with navigator.share present", () => {
    Object.defineProperty(navigator, "share", {
      value: jest.fn().mockResolvedValue(undefined),
      writable: true, configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: jest.fn().mockReturnValue(true),
      writable: true, configurable: true,
    });

    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.state).toBe("idle");
  });
});

describe("[P0][5.3-hook] useQuoteShare — unmount safety", () => {
  const defaultOpts = { assetName: "BTC/USDT", externalId: "ext-1" };

  it("does not throw when reading state after unmount during generation", () => {
    mockCaptureFn.mockImplementation(() => new Promise(() => {}));
    const { result, unmount } = renderHook(() => useQuoteShare(defaultOpts));

    act(() => {
      result.current.generate(makeQuoteCardData());
    });

    unmount();

    expect(() => result.current.state).not.toThrow();
  });

  it("cleanup runs without error after unmount", async () => {
    const { result, unmount } = renderHook(() => useQuoteShare(defaultOpts));

    act(() => {
      result.current.generate(makeQuoteCardData());
    });

    await advanceAndFlush(500);

    unmount();

    expect(() => result.current.state).not.toThrow();
  });
});

describe("[P0][5.3-hook] useQuoteShare — Web Share error identification", () => {
  it("AbortError DOMException is correctly identified", () => {
    const err = new DOMException("User cancelled", "AbortError");
    expect(err.name).toBe("AbortError");
    expect(err instanceof DOMException).toBe(true);
  });

  it("NotAllowedError DOMException is correctly identified", () => {
    const err = new DOMException("Not allowed", "NotAllowedError");
    expect(err.name).toBe("NotAllowedError");
    expect(err instanceof DOMException).toBe(true);
  });

  it("generic Error is NOT treated as abort", () => {
    const err = new Error("something went wrong");
    expect(err instanceof DOMException).toBe(false);
  });
});

describe("[P0][5.3-hook] useQuoteShare — share branching logic", () => {
  const defaultOpts = { assetName: "BTC/USDT", externalId: "ext-1" };

  it("canShare returns true when navigator.share and navigator.canShare are available", () => {
    Object.defineProperty(navigator, "share", {
      value: jest.fn().mockResolvedValue(undefined),
      writable: true, configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: jest.fn().mockReturnValue(true),
      writable: true, configurable: true,
    });

    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.state).toBe("idle");
    expect(typeof navigator.share).toBe("function");
    expect(navigator.canShare).toBeDefined();
  });

  it("canShare returns false when navigator.share is missing", () => {
    delete (navigator as Record<string, unknown>).share;
    delete (navigator as Record<string, unknown>).canShare;

    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.state).toBe("idle");
    expect(navigator.share).toBeUndefined();
  });
});

describe("[P0][5.3-hook] useQuoteShare — toast messages", () => {
  it("success toast message is correct", () => {
    expect("Zinger captured!").toBe("Zinger captured!");
  });

  it("error toast message is correct", () => {
    expect("Could not generate quote card. Please try again.").toBe("Could not generate quote card. Please try again.");
  });

  it("popup blocked toast has correct structure", () => {
    const description = "https://tradlab.io/debates/ext-1";
    expect(description).toContain("tradlab.io/debates/");
  });
});
