import { renderHook, act } from "@testing-library/react";

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: jest.fn(),
  },
}));

const mockTrackEvent = jest.fn();
jest.mock("../../features/debate/utils/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { useShareDebate } from "../../features/debate/hooks/useShareDebate";

const defaultArgs = {
  assetName: "BTC",
  externalId: "ext-1",
  source: "debate_detail" as const,
};

function setNavigatorShare(fn: jest.Mock) {
  Object.defineProperty(navigator, "share", { value: fn, writable: true, configurable: true });
}

function removeNavigatorShare() {
  try { Object.defineProperty(navigator, "share", { value: undefined, writable: true, configurable: true }); } catch { /* ok */ }
}

function setClipboard(writeText: jest.Mock) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, writable: true, configurable: true });
}

function removeClipboard() {
  try { Object.defineProperty(navigator, "clipboard", { value: undefined, writable: true, configurable: true }); } catch { /* ok */ }
}

beforeEach(() => {
  jest.clearAllMocks();
  removeNavigatorShare();
  removeClipboard();
});

describe("[P0][5.4-hook] useShareDebate", () => {
  it("Web Share API success — fires debate_shared event", async () => {
    setNavigatorShare(jest.fn().mockResolvedValue(undefined));

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("BTC") }));
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "debate_shared", properties: expect.objectContaining({ method: "web_share_api" }) }),
    );
    expect(result.current.isSharing).toBe(false);
  });

  it("Web Share API abort — silent, no toast", async () => {
    setNavigatorShare(jest.fn().mockRejectedValue(new DOMException("cancel", "AbortError")));

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("Web Share API NotAllowedError — silent, no toast", async () => {
    setNavigatorShare(jest.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")));

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("Web Share API failure — shows error toast with URL", async () => {
    setNavigatorShare(jest.fn().mockRejectedValue(new Error("broken")));

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("ext-1"));
  });

  it("Clipboard fallback — copies URL and fires debate_link_copied", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/debates/ext-1"));
    expect(mockToastSuccess).toHaveBeenCalledWith("Link copied to clipboard");
    expect(mockTrackEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "debate_link_copied" }));
  });

  it("Clipboard failure — shows error toast with URL", async () => {
    setClipboard(jest.fn().mockRejectedValue(new Error("Nope")));

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("ext-1"));
  });

  it("navigator.clipboard undefined — shows error toast with URL", async () => {
    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("ext-1"));
  });

  it("Web Share API success — includes source in trackEvent", async () => {
    setNavigatorShare(jest.fn().mockResolvedValue(undefined));

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "debate_shared",
        properties: expect.objectContaining({ source: "debate_detail" }),
      }),
    );
  });

  it("Clipboard fallback — includes source in trackEvent", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    const { result } = renderHook(() => useShareDebate({ ...defaultArgs, source: "debate_stream" }));
    await act(async () => { await result.current.share(); });

    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "debate_link_copied",
        properties: expect.objectContaining({ source: "debate_stream" }),
      }),
    );
  });

  it("Analytics isolation — trackEvent throws, share still succeeds", async () => {
    setNavigatorShare(jest.fn().mockResolvedValue(undefined));
    mockTrackEvent.mockImplementation(() => { throw new Error("down"); });

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    await act(async () => { await result.current.share(); });

    expect(navigator.share).toHaveBeenCalled();
    expect(result.current.isSharing).toBe(false);
  });

  it("isSharing returns to false after share", async () => {
    setClipboard(jest.fn().mockResolvedValue(undefined));

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    expect(result.current.isSharing).toBe(false);
    await act(async () => { await result.current.share(); });
    expect(result.current.isSharing).toBe(false);
  });

  it("Concurrent double-click — share called once, no error surfaced", async () => {
    setNavigatorShare(jest.fn().mockResolvedValue(undefined));

    const { result } = renderHook(() => useShareDebate(defaultArgs));
    const shareFn = result.current.share;
    const p1 = shareFn();
    const p2 = shareFn();
    await act(async () => { await Promise.all([p1, p2]); });

    expect(navigator.share).toHaveBeenCalledTimes(1);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(result.current.isSharing).toBe(false);
  });
});
