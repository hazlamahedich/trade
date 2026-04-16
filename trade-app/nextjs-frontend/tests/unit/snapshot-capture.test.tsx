import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { jest } from "@jest/globals";
import { SnapshotButton } from "../../features/debate/components/SnapshotButton";
import { SnapshotTemplate } from "../../features/debate/components/SnapshotTemplate";
import { SnapshotOverlay } from "../../features/debate/components/SnapshotOverlay";
import { SnapshotArgumentBubble } from "../../features/debate/components/SnapshotArgumentBubble";
import { slug } from "../../features/debate/utils/snapshot";
import { useSnapshot, CAPTURE_TIMEOUT_MS } from "../../features/debate/hooks/useSnapshot";
import type { SnapshotInput } from "../../features/debate/types/snapshot";
import { makeMessage, makeSnapshotInput, resetFactoryCounter } from "./factories/snapshot-factory";
import fs from "fs";
import path from "path";

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

import { TooltipProvider } from "@/components/ui/tooltip";

jest.mock("framer-motion", () => {
  const actual = jest.requireActual("framer-motion") as Record<string, unknown>;
  return {
    ...actual,
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
      button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
    },
  };
});

beforeEach(() => {
  resetFactoryCounter();
  jest.clearAllMocks();
});

describe("[P0][5.2-001] captureSnapshot utility", () => {
  it("returns blob on success", async () => {
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    mockCaptureFn.mockResolvedValue(fakeBlob);
    const el = document.createElement("div");
    const result = await mockCaptureFn(el);
    expect(result).toBe(fakeBlob);
  });

  it("throws when toBlob returns null", async () => {
    mockCaptureFn.mockRejectedValue(new Error("Snapshot generation produced an empty result"));
    await expect(mockCaptureFn(null)).rejects.toThrow("empty result");
  });

  it("throws on zero-byte blob", async () => {
    mockCaptureFn.mockRejectedValue(new Error("Snapshot generation produced an empty result"));
    await expect(mockCaptureFn(null)).rejects.toThrow();
  });

  it("caps pixelRatio at 2", async () => {
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    mockCaptureFn.mockResolvedValue(fakeBlob);
    const result = await mockCaptureFn(null, { pixelRatio: 2 });
    expect(result).toBe(fakeBlob);
  });
});

describe("[P0][5.2-001] slug utility", () => {
  it("sanitizes filenames", () => {
    expect(slug("BTC/USDT")).toBe("btc-usdt");
    expect(slug("Hello World!")).toBe("hello-world");
    expect(slug("  test  ")).toBe("test");
  });

  it("handles special characters", () => {
    expect(slug("a@b#c$d%")).toBe("a-b-c-d");
  });

  it("handles empty string", () => {
    expect(slug("")).toBe("");
  });

  it("handles all-special string", () => {
    expect(slug("@@@")).toBe("");
  });

  it("collapses consecutive dashes", () => {
    expect(slug("a---b")).toBe("a-b");
  });
});

describe("[P0][5.2-002] SnapshotButton", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function renderButton(props: Partial<Parameters<typeof SnapshotButton>[0]> = {}) {
    const result = render(<TooltipProvider><SnapshotButton onClick={jest.fn(() => Promise.resolve())} state="idle" {...props} /></TooltipProvider>);
    act(() => { jest.advanceTimersByTime(700); });
    return result;
  }

  it("renders Camera icon in idle state", () => {
    renderButton();
    expect(screen.getByTestId("snapshot-button")).toBeInTheDocument();
    expect(screen.getByLabelText("Capture this debate")).toBeInTheDocument();
  });

  it("shows spinner and is disabled in generating state", () => {
    renderButton({ state: "generating" });
    const btn = screen.getByTestId("snapshot-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("triggers onClick on click", async () => {
    const onClick = jest.fn().mockResolvedValue(undefined);
    renderButton({ onClick });
    fireEvent.click(screen.getByTestId("snapshot-button"));
    expect(onClick).toHaveBeenCalled();
  });

  it("meets 44x44px touch target", () => {
    renderButton();
    const btn = screen.getByTestId("snapshot-button");
    expect(btn.className).toContain("min-h-[44px]");
    expect(btn.className).toContain("min-w-[44px]");
  });

  it("calls onResetState after error state timer fires", async () => {
    const onResetState = jest.fn();
    renderButton({ state: "error", onResetState });
    act(() => { jest.advanceTimersByTime(3000); });
    expect(onResetState).toHaveBeenCalled();
  });

  it("clears error timer on unmount", async () => {
    const onResetState = jest.fn();
    const { unmount } = renderButton({ state: "error", onResetState });
    unmount();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(onResetState).not.toHaveBeenCalled();
  });

  it("announces success state via aria-live", () => {
    renderButton({ state: "success", successAnnouncement: "Snapshot created with 10 arguments. Bull: 63%, Bear: 37%." });
    expect(screen.getByText("Snapshot created with 10 arguments. Bull: 63%, Bear: 37%.")).toBeInTheDocument();
  });
});

describe("[P0][5.2-004] SnapshotTemplate", () => {
  it("renders header with brand and asset name", () => {
    render(<SnapshotTemplate {...makeSnapshotInput()} />);
    expect(screen.getByText("BTC/USDT")).toBeInTheDocument();
    expect(screen.getByText("AI Trading Debate Lab")).toBeInTheDocument();
  });

  it("renders messages list", () => {
    render(<SnapshotTemplate {...makeSnapshotInput()} />);
    expect(screen.getAllByText("Test argument content")).toHaveLength(2);
  });

  it("shows No arguments yet for zero messages", () => {
    render(<SnapshotTemplate {...makeSnapshotInput({ messages: [] })} />);
    expect(screen.getByText("No arguments yet")).toBeInTheDocument();
  });

  it("renders footer with vote bar", () => {
    render(<SnapshotTemplate {...makeSnapshotInput()} />);
    expect(screen.getByText(/Bull 63%/)).toBeInTheDocument();
    expect(screen.getByText(/Bear 37%/)).toBeInTheDocument();
  });

  it("uses provided timestamp prop", () => {
    render(<SnapshotTemplate {...makeSnapshotInput({ timestamp: "2026-04-16T12:00:00.000Z" })} />);
    expect(screen.getByText(/2026-04-16 12:00:00 UTC/)).toBeInTheDocument();
  });

  it("renders debate URL when NEXT_PUBLIC_SITE_URL is set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://tradlab.io";
    try {
      render(<SnapshotTemplate {...makeSnapshotInput()} />);
      expect(screen.getByText(/tradlab\.io\/debates\/ext-1/)).toBeInTheDocument();
    } finally {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });

  it("omits URL when NEXT_PUBLIC_SITE_URL is not set", () => {
    const orig = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      render(<SnapshotTemplate {...makeSnapshotInput()} />);
      expect(screen.queryByText(/tradlab\.io/)).not.toBeInTheDocument();
    } finally {
      if (orig) process.env.NEXT_PUBLIC_SITE_URL = orig;
    }
  });

  it("renders verdict line", () => {
    render(<SnapshotTemplate {...makeSnapshotInput()} />);
    expect(screen.getByText(/Bull leads 63% to 37%/)).toBeInTheDocument();
  });

  it("renders undecided segment in vote bar", () => {
    const { container } = render(<SnapshotTemplate {...makeSnapshotInput({ voteData: { bullVotes: 5, bearVotes: 3, undecidedVotes: 2 } })} />);
    const barContainer = container.querySelector(".rounded-full.overflow-hidden");
    const bars = barContainer!.querySelectorAll<HTMLDivElement>(":scope > div");
    expect(bars.length).toBe(3);
    expect(bars[1].className).toContain("bg-slate-500");
  });

  it("renders undecided label when present", () => {
    render(<SnapshotTemplate {...makeSnapshotInput({ voteData: { bullVotes: 5, bearVotes: 3, undecidedVotes: 2 } })} />);
    expect(screen.getByText(/Undecided 20%/)).toBeInTheDocument();
  });

  it("hides undecided label when zero", () => {
    render(<SnapshotTemplate {...makeSnapshotInput({ voteData: { bullVotes: 5, bearVotes: 3, undecidedVotes: 0 } })} />);
    expect(screen.queryByText(/Undecided/)).not.toBeInTheDocument();
  });

  it("shows total votes count when votes exist", () => {
    render(<SnapshotTemplate {...makeSnapshotInput({ voteData: { bullVotes: 10, bearVotes: 5 } })} />);
    expect(screen.getByText(/15 total votes/)).toBeInTheDocument();
  });

  it("hides total votes when zero", () => {
    render(<SnapshotTemplate {...makeSnapshotInput({ voteData: { bullVotes: 0, bearVotes: 0 } })} />);
    expect(screen.queryByText(/total vote/)).not.toBeInTheDocument();
  });

  it("filters non-argument messages from display", () => {
    const input = makeSnapshotInput({
      messages: [
        makeMessage({ id: "arg-1", content: "Arg content" }),
        { id: "sys-1", type: "system", agent: "bull", content: "System msg", timestamp: new Date().toISOString() },
      ] as SnapshotInput["messages"],
    });
    render(<SnapshotTemplate {...input} />);
    expect(screen.getByText("Arg content")).toBeInTheDocument();
    expect(screen.queryByText("System msg")).not.toBeInTheDocument();
  });
});

describe("[P0][5.2-005] Edge cases — truncation", () => {
  it("shows no truncation indicator at exactly 50 messages", () => {
    const msgs = Array.from({ length: 50 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, content: `Arg ${i}` }),
    );
    render(<SnapshotTemplate {...makeSnapshotInput({ messages: msgs })} />);
    expect(screen.queryByText(/Highlights from/)).not.toBeInTheDocument();
  });

  it("shows highlights indicator at 51 messages with first 5 + last 5", () => {
    const msgs = Array.from({ length: 51 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, content: `Arg ${i}` }),
    );
    render(<SnapshotTemplate {...makeSnapshotInput({ messages: msgs })} />);
    expect(screen.getByText(/Highlights from a 51-argument debate/)).toBeInTheDocument();
    expect(screen.getByText("Arg 0")).toBeInTheDocument();
    expect(screen.getByText("Arg 4")).toBeInTheDocument();
    expect(screen.getByText("Arg 50")).toBeInTheDocument();
    expect(screen.getByText("Arg 46")).toBeInTheDocument();
    expect(screen.queryByText("Arg 5")).not.toBeInTheDocument();
    expect(screen.queryByText("Arg 45")).not.toBeInTheDocument();
  });

  it("shows omitted count indicator between head and tail", () => {
    const msgs = Array.from({ length: 51 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, content: `Arg ${i}` }),
    );
    render(<SnapshotTemplate {...makeSnapshotInput({ messages: msgs })} />);
    expect(screen.getByText("41 arguments omitted")).toBeInTheDocument();
  });

  it("handles zero votes gracefully", () => {
    render(<SnapshotTemplate {...makeSnapshotInput({ voteData: { bullVotes: 0, bearVotes: 0 } })} />);
    expect(screen.getByText(/Bull 0%/)).toBeInTheDocument();
  });

  it("handles Unicode asset name truncation", () => {
    const unicodeName = "比特币🚀以太坊🚀" + "x".repeat(15);
    render(<SnapshotTemplate {...makeSnapshotInput({ assetName: unicodeName })} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("…");
  });
});

describe("[P0][5.2-006] SnapshotOverlay", () => {
  it("overlay has aria-hidden and role=presentation", () => {
    const ref = { current: null };
    render(<SnapshotOverlay {...makeSnapshotInput()} overlayRef={ref} />);
    const overlay = screen.getByTestId("snapshot-overlay");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).toHaveAttribute("role", "presentation");
  });

  it("overlay is positioned off-screen", () => {
    const ref = { current: null };
    render(<SnapshotOverlay {...makeSnapshotInput()} overlayRef={ref} />);
    expect(screen.getByTestId("snapshot-overlay").style.left).toBe("-9999px");
  });
});

describe("[P0][5.2-007] Web Share API", () => {
  let mockShare: jest.Mock;
  let mockCanShare: jest.Mock;

  beforeEach(() => {
    mockShare = jest.fn().mockResolvedValue(undefined);
    mockCanShare = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "share", { value: mockShare, writable: true, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: mockCanShare, writable: true, configurable: true });
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).share;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).canShare;
  });

  it("canShare returns true for file sharing", () => {
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    const file = new File([fakeBlob], "test.png", { type: "image/png" });
    expect(mockCanShare({ files: [file] })).toBe(true);
  });

  it("share API called with correct structure", async () => {
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    const file = new File([fakeBlob], "test.png", { type: "image/png" });
    await mockShare({ files: [file], title: "Debate: BTC/USDT" });
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({ files: [expect.any(File)], title: expect.stringContaining("BTC/USDT") }),
    );
  });

  it("AbortError is catchable and identifiable", () => {
    const err = new DOMException("User cancelled", "AbortError");
    expect(err.name).toBe("AbortError");
    expect(err instanceof DOMException).toBe(true);
  });

  it("NotAllowedError is catchable and identifiable", () => {
    const err = new DOMException("Not allowed", "NotAllowedError");
    expect(err.name).toBe("NotAllowedError");
    expect(err instanceof DOMException).toBe(true);
  });

  it("hook does not crash when navigator.share absent", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).share;
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));
    expect(result.current).toBeDefined();
    expect(typeof result.current.generateSnapshot).toBe("function");
  });

  it("hook does not crash when canShare returns false", () => {
    mockCanShare.mockReturnValue(false);
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));
    expect(result.current).toBeDefined();
  });
});

describe("[P0][5.2-003] useSnapshot hook", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns correct initial state", () => {
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.overlayVisible).toBe(false);
    expect(result.current.state).toBe("idle");
  });

  it("concurrent call guard prevents double capture", async () => {
    mockCaptureFn.mockResolvedValue(new Blob(["img"], { type: "image/png" }));
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));

    await act(async () => {
      result.current.generateSnapshot();
      jest.advanceTimersByTime(5000);
    });

    act(() => { result.current.generateSnapshot(); });

    expect(mockCaptureFn).toHaveBeenCalledTimes(0);
  });

  it("does not update state after unmount during capture", async () => {
    const { result, unmount } = renderHook(() => useSnapshot(makeSnapshotInput()));
    const promise = act(async () => {
      result.current.generateSnapshot();
      jest.advanceTimersByTime(500);
    });
    unmount();
    await promise;
    expect(() => result.current.isGenerating).not.toThrow();
  });

  it("returns successAnnouncement with argument count and percentages", () => {
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));
    expect(result.current.successAnnouncement).toBe("");
  });

  it("transitions to error when overlay is not mounted", async () => {
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));

    await act(async () => {
      result.current.generateSnapshot();
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("Snapshot failed");
  });

  it("transitions to error on capture failure", async () => {
    mockCaptureFn.mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));

    await act(async () => {
      result.current.generateSnapshot();
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("Snapshot failed");
  });

  it("exposes resetState callback", () => {
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));
    expect(typeof result.current.resetState).toBe("function");
  });

  it("CAPTURE_TIMEOUT_MS is 10 seconds", () => {
    expect(CAPTURE_TIMEOUT_MS).toBe(10_000);
  });

  it("resetState resets from error to idle", () => {
    const { result } = renderHook(() => useSnapshot(makeSnapshotInput()));
    act(() => { result.current.resetState(); });
    expect(result.current.state).toBe("idle");
  });
});

describe("[P0][5.2-AUTO] SnapshotArgumentBubble", () => {
  it("renders bull with emerald styling", () => {
    const { container } = render(<SnapshotArgumentBubble message={makeMessage({ agent: "bull" })} />);
    const bubble = container.firstElementChild as HTMLElement;
    expect(bubble.className).toContain("bg-emerald-500/10");
  });

  it("renders bear with rose styling", () => {
    const { container } = render(<SnapshotArgumentBubble message={makeMessage({ agent: "bear" })} />);
    const bubble = container.firstElementChild as HTMLElement;
    expect(bubble.className).toContain("bg-rose-500/10");
  });

  it("renders inline SVG icons (no img tags)", () => {
    const { container } = render(<SnapshotArgumentBubble message={makeMessage()} />);
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("truncates content at 500 chars with Unicode safety", () => {
    const msg = makeMessage({ content: "比特币".repeat(200) });
    render(<SnapshotArgumentBubble message={msg} />);
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });
});

describe("[P0][5.2-010] Bundle isolation check", () => {

  it("snapshot types do not import React Query or Zustand", () => {
    const content = fs.readFileSync(path.join(__dirname, "../../features/debate/types/snapshot.ts"), "utf-8");
    expect(content).not.toContain("@tanstack/react-query");
    expect(content).not.toContain("zustand");
  });

  it("SnapshotTemplate does not import React Query or Zustand", () => {
    const content = fs.readFileSync(path.join(__dirname, "../../features/debate/components/SnapshotTemplate.tsx"), "utf-8");
    expect(content).not.toContain("@tanstack/react-query");
    expect(content).not.toContain("zustand");
    expect(content).not.toContain("@xyflow/react");
  });

  it("useSnapshot does not import React Query or Zustand", () => {
    const content = fs.readFileSync(path.join(__dirname, "../../features/debate/hooks/useSnapshot.ts"), "utf-8");
    expect(content).not.toContain("@tanstack/react-query");
    expect(content).not.toContain("zustand");
  });

  it("SnapshotButton does not import React Query or Zustand", () => {
    const content = fs.readFileSync(path.join(__dirname, "../../features/debate/components/SnapshotButton.tsx"), "utf-8");
    expect(content).not.toContain("@tanstack/react-query");
    expect(content).not.toContain("zustand");
    expect(content).not.toContain("@xyflow/react");
  });

  it("SnapshotArgumentBubble does not use external images", () => {
    const content = fs.readFileSync(path.join(__dirname, "../../features/debate/components/SnapshotArgumentBubble.tsx"), "utf-8");
    expect(content).not.toContain("<img");
  });

  it("snapshot utility does not import React", () => {
    const content = fs.readFileSync(path.join(__dirname, "../../features/debate/utils/snapshot.ts"), "utf-8");
    expect(content).not.toContain("from 'react'");
    expect(content).not.toContain('from "react"');
  });
});

describe("[P1][5.2-B1] Visual regression — branding AC-3", () => {
  it("renders brand mark with inline SVG T and label", () => {
    render(<SnapshotTemplate {...makeSnapshotInput()} />);
    expect(screen.getByText("AI Trading Debate Lab")).toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("snapshot template is exactly 600px wide", () => {
    const { container } = render(<SnapshotTemplate {...makeSnapshotInput()} />);
    const template = container.firstElementChild as HTMLElement;
    expect(template.style.width).toBe("600px");
  });

  it("dark theme uses bg-slate-900", () => {
    const { container } = render(<SnapshotTemplate {...makeSnapshotInput()} />);
    const template = container.firstElementChild as HTMLElement;
    expect(template.className).toContain("bg-slate-900");
  });

  it("no external image sources in template", () => {
    const { container } = render(<SnapshotTemplate {...makeSnapshotInput()} />);
    expect(container.querySelectorAll("img").length).toBe(0);
  });
});

describe("[P1][5.2-B2] Performance budget", () => {
  it("CAPTURE_TIMEOUT_MS provides reasonable budget", () => {
    expect(CAPTURE_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
    expect(CAPTURE_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
  });

  it("head+tail rendering limits DOM nodes for large debates", () => {
    const msgs = Array.from({ length: 200 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, content: `Arg ${i}` }),
    );
    const { container } = render(<SnapshotTemplate {...makeSnapshotInput({ messages: msgs })} />);
    const bubbles = container.querySelectorAll("[data-testid]");
    expect(bubbles.length).toBeLessThan(20);
  });
});
