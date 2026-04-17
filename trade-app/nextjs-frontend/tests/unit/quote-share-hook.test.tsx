import { renderHook, act } from "@testing-library/react";
import { jest } from "@jest/globals";
import { makeQuoteCardData, resetQuoteFactoryCounter } from "./factories/quote-share-factory";

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

import { useQuoteShare } from "../../features/debate/hooks/useQuoteShare";

const mockWindowOpen = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, "open", { value: mockWindowOpen, writable: true });
});

afterAll(() => {
  (window as Record<string, unknown>).open = undefined;
});

beforeEach(() => {
  resetQuoteFactoryCounter();
  mockCaptureFn.mockReset();
  mockWindowOpen.mockReset();
  mockCaptureFn.mockResolvedValue(new Blob(["img"], { type: "image/png" }));
  (globalThis as Record<string, unknown>).URL.createObjectURL = jest.fn(() => "blob:test");
  (globalThis as Record<string, unknown>).URL.revokeObjectURL = jest.fn();
});

describe("[P0][5.3-hook] useQuoteShare", () => {
  const defaultOpts = { assetName: "BTC/USDT", externalId: "ext-1" };

  it("starts in idle state", () => {
    const { result } = renderHook(() => useQuoteShare(defaultOpts));
    expect(result.current.state).toBe("idle");
  });

  it("returns overlay ref", () => {
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

  it("concurrent guard: second call is no-op while generating", async () => {
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
