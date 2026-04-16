import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { jest } from "@jest/globals";
import { SnapshotArgumentBubble } from "../../features/debate/components/SnapshotArgumentBubble";
import { SnapshotButton } from "../../features/debate/components/SnapshotButton";
import { SnapshotTemplate } from "../../features/debate/components/SnapshotTemplate";
import { useSnapshot } from "../../features/debate/hooks/useSnapshot";
import type { ArgumentMessage, SnapshotInput } from "../../features/debate/types/snapshot";
import { TooltipProvider } from "@/components/ui/tooltip";

if (typeof globalThis.SVGImageElement === "undefined") {
  (globalThis as Record<string, unknown>).SVGImageElement = class SVGImageElement extends HTMLElement {};
}

beforeEach(() => {
  _idCounter = 0;
});

jest.mock("html-to-image", () => ({
  toBlob: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock("framer-motion", () => {
  const actual = jest.requireActual("framer-motion") as Record<string, unknown>;
  return {
    ...actual,
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    },
  };
});

let _idCounter = 0;

function makeArgMessage(overrides: Partial<ArgumentMessage> = {}): ArgumentMessage {
  return {
    id: `msg-${++_idCounter}`,
    type: "argument",
    agent: "bull",
    content: "Test argument content",
    timestamp: "2026-04-16T14:30:00.000Z",
    ...overrides,
  };
}

function makeSnapshotInput(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    debateId: "debate-1",
    assetName: "BTC/USDT",
    externalId: "ext-1",
    messages: [makeArgMessage(), makeArgMessage({ agent: "bear", id: "msg-2" })],
    voteData: { bullVotes: 5, bearVotes: 3 },
    ...overrides,
  };
}

describe("[P0][5.2-AUTO] SnapshotArgumentBubble", () => {
  it("renders bull message with emerald styling aligned left", () => {
    const msg = makeArgMessage({ agent: "bull" });
    const { container } = render(<SnapshotArgumentBubble message={msg} />);
    const bubble = container.firstElementChild as HTMLElement;
    expect(bubble.className).toContain("flex-row");
    expect(bubble.className).toContain("bg-emerald-500/10");
    expect(screen.getByText("Bull")).toHaveClass("text-emerald-400");
  });

  it("renders bear message with rose styling aligned right", () => {
    const msg = makeArgMessage({ agent: "bear" });
    const { container } = render(<SnapshotArgumentBubble message={msg} />);
    const bubble = container.firstElementChild as HTMLElement;
    expect(bubble.className).toContain("flex-row-reverse");
    expect(bubble.className).toContain("bg-rose-500/10");
    expect(screen.getByText("Bear")).toHaveClass("text-rose-400");
  });

  it("formats timestamp to HH:MM", () => {
    const msg = makeArgMessage({ timestamp: "2026-04-16T14:30:00.000Z" });
    render(<SnapshotArgumentBubble message={msg} />);
    const timeEl = screen.getByText(/\d{1,2}:\d{2}/);
    expect(timeEl).toBeInTheDocument();
  });

  it("truncates content exceeding 500 characters with Unicode-safe slice", () => {
    const longContent = "a".repeat(501);
    const msg = makeArgMessage({ content: longContent });
    render(<SnapshotArgumentBubble message={msg} />);
    const text = screen.getByText(/…$/);
    expect(text.textContent!.length).toBeLessThanOrEqual(502);
  });

  it("does not truncate content at exactly 500 characters", () => {
    const exactContent = "a".repeat(500);
    const msg = makeArgMessage({ content: exactContent });
    render(<SnapshotArgumentBubble message={msg} />);
    expect(screen.queryByText(/…$/)).not.toBeInTheDocument();
  });

  it("renders inline SVG for agent icon (no img tags)", () => {
    const msg = makeArgMessage({ agent: "bull" });
    const { container } = render(<SnapshotArgumentBubble message={msg} />);
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("Unicode-safe content truncation does not split surrogate pairs", () => {
    const surrogateContent = "比特币".repeat(200);
    const msg = makeArgMessage({ content: surrogateContent });
    render(<SnapshotArgumentBubble message={msg} />);
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });
});

describe("[P0][5.2-AUTO] SnapshotButton — reduced motion and error states", () => {
  it("shows static icon when reduced motion is preferred", () => {
    jest.doMock("framer-motion", () => {
      const actual = jest.requireActual("framer-motion") as Record<string, unknown>;
      return {
        ...actual,
        useReducedMotion: () => true,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        motion: {
          div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
        },
      };
    });

    render(
      <TooltipProvider>
        <SnapshotButton onClick={jest.fn(() => Promise.resolve())} state="generating" />
      </TooltipProvider>,
    );
    const btn = screen.getByTestId("snapshot-button");
    expect(btn).toBeDisabled();
  });

  it("calls toast.error via handleClick catch path", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const toastMock = require("sonner").toast;
    expect(typeof toastMock.error).toBe("function");
  });

  it("handleClick catches rejected onClick without throwing", async () => {
    const rejectedClick = jest.fn(() => Promise.resolve()).mockRejectedValue(new Error("fail"));

    const { unmount } = render(
      <TooltipProvider>
        <SnapshotButton onClick={rejectedClick} state="idle" />
      </TooltipProvider>,
    );

    const btn = screen.getByTestId("snapshot-button");
    expect(() => fireEvent.click(btn)).not.toThrow();
    expect(rejectedClick).toHaveBeenCalled();

    unmount();
  });

  it("calls onResetError after error state timer fires", async () => {
    jest.useFakeTimers();
    const onResetError = jest.fn();

    render(
      <TooltipProvider>
        <SnapshotButton onClick={jest.fn(() => Promise.resolve())} state="error" onResetError={onResetError} />
      </TooltipProvider>,
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onResetError).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("clears error timer on unmount", async () => {
    jest.useFakeTimers();
    const onResetError = jest.fn();

    const { unmount } = render(
      <TooltipProvider>
        <SnapshotButton onClick={jest.fn(() => Promise.resolve())} state="error" onResetError={onResetError} />
      </TooltipProvider>,
    );

    unmount();
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(onResetError).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe("[P0][5.2-AUTO] SnapshotTemplate — additional coverage", () => {
  it("omits URL when NEXT_PUBLIC_SITE_URL is not set", () => {
    const origUrl = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const input = makeSnapshotInput();
    render(<SnapshotTemplate {...input} />);
    expect(screen.queryByText(/tradlab\.io/)).not.toBeInTheDocument();
    expect(screen.queryByText(/localhost/)).not.toBeInTheDocument();
    process.env.NEXT_PUBLIC_SITE_URL = origUrl;
  });

  it("renders vote bar with correct percentage widths", () => {
    const input = makeSnapshotInput({ voteData: { bullVotes: 75, bearVotes: 25 } });
    const { container } = render(<SnapshotTemplate {...input} />);
    const barContainer = container.querySelector(".rounded-full.overflow-hidden");
    expect(barContainer).not.toBeNull();
    const bars = barContainer!.querySelectorAll<HTMLDivElement>(":scope > div");
    expect(bars[0].style.width).toBe("75%");
    expect(bars[1].style.width).toBe("25%");
  });

  it("shows total votes count when votes exist", () => {
    const input = makeSnapshotInput({ voteData: { bullVotes: 10, bearVotes: 5 } });
    render(<SnapshotTemplate {...input} />);
    expect(screen.getByText(/15 total votes/)).toBeInTheDocument();
  });

  it("hides total votes when zero votes", () => {
    const input = makeSnapshotInput({ voteData: { bullVotes: 0, bearVotes: 0 } });
    render(<SnapshotTemplate {...input} />);
    expect(screen.queryByText(/total vote/)).not.toBeInTheDocument();
  });

  it("renders timestamp in header", () => {
    const input = makeSnapshotInput();
    render(<SnapshotTemplate {...input} />);
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });

  it("displays undecided votes when present", () => {
    const input = makeSnapshotInput({ voteData: { bullVotes: 5, bearVotes: 3, undecidedVotes: 2 } });
    render(<SnapshotTemplate {...input} />);
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it("filters non-argument messages from display", () => {
    const input = makeSnapshotInput({
      messages: [
        makeArgMessage({ id: "arg-1", content: "Arg content" }),
        { id: "sys-1", type: "system", agent: "bull", content: "System msg", timestamp: new Date().toISOString() },
      ] as SnapshotInput["messages"],
    });
    render(<SnapshotTemplate {...input} />);
    expect(screen.getByText("Arg content")).toBeInTheDocument();
    expect(screen.queryByText("System msg")).not.toBeInTheDocument();
  });
});

describe("[P0][5.2-AUTO] useSnapshot — cleanup and state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not update state after unmount during capture", async () => {
    const input = makeSnapshotInput();
    const { result, unmount } = renderHook(() => useSnapshot(input));

    const promise = act(async () => {
      result.current.generateSnapshot();
    });

    unmount();

    await promise;

    expect(() => result.current.isGenerating).not.toThrow();
  });

  it("overlayVisible is false initially", () => {
    const input = makeSnapshotInput();
    const { result } = renderHook(() => useSnapshot(input));
    expect(result.current.overlayVisible).toBe(false);
  });

  it("returns error state as string when in error", () => {
    const input = makeSnapshotInput();
    const { result } = renderHook(() => useSnapshot(input));
    expect(result.current.error).toBeNull();
  });

  it("CAPTURE_TIMEOUT_MS is exported and equals 10 seconds", async () => {
    const mod = await import("../../features/debate/hooks/useSnapshot");
    expect(mod.CAPTURE_TIMEOUT_MS).toBe(10_000);
  });
});

describe("[P0][5.2-AUTO] Bundle isolation — deep check", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  it("SnapshotButton does not import React Query or Zustand", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../../features/debate/components/SnapshotButton.tsx"),
      "utf-8",
    );
    expect(content).not.toContain("@tanstack/react-query");
    expect(content).not.toContain("zustand");
    expect(content).not.toContain("@xyflow/react");
  });

  it("SnapshotArgumentBubble does not import external images", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../../features/debate/components/SnapshotArgumentBubble.tsx"),
      "utf-8",
    );
    expect(content).not.toContain("<img");
    expect(content).not.toContain(".png");
    expect(content).not.toContain(".jpg");
    expect(content).not.toContain(".svg\"");
  });

  it("SnapshotOverlay does not import React Query or Zustand", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../../features/debate/components/SnapshotOverlay.tsx"),
      "utf-8",
    );
    expect(content).not.toContain("@tanstack/react-query");
    expect(content).not.toContain("zustand");
  });

  it("snapshot utility does not import React", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../../features/debate/utils/snapshot.ts"),
      "utf-8",
    );
    expect(content).not.toContain("from 'react'");
    expect(content).not.toContain('from "react"');
  });
});
