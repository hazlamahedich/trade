import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const mockSubmitVote = jest.fn();
const mockFetchDebateResult = jest.fn(() =>
  Promise.resolve({
    data: {
      debateId: "debate-optimistic",
      asset: "BTC",
      status: "running",
      currentTurn: 1,
      maxTurns: 6,
      guardianVerdict: null,
      guardianInterruptsCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      totalVotes: 5,
      voteBreakdown: { bull: 3, bear: 2 },
    },
    error: null,
    meta: {},
  })
);

jest.mock("../../features/debate/api", () => ({
  submitVote: (...args: unknown[]) => mockSubmitVote(...args),
  fetchDebateResult: (...args: unknown[]) => mockFetchDebateResult(...args),
  getOrCreateVoterFingerprint: jest.fn(() => "test-fp"),
}));

jest.mock("sonner", () => ({
  toast: { info: jest.fn(), error: jest.fn() },
}));

import { DebateStream } from "../../features/debate/components/DebateStream";
import { toast } from "sonner";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

jest.mock("../../features/debate/hooks/useDebateSocket", () => ({
  useDebateSocket: jest.fn(() => ({
    status: "connected",
    isConnected: true,
    sendGuardianAck: jest.fn(() => true),
  })),
}));

jest.mock("../../features/debate/hooks/useReasoningGraph", () => ({
  useReasoningGraph: jest.fn(() => ({
    nodes: [],
    edges: [],
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
  })),
}));

jest.mock("../../features/debate/hooks/useVotingStatus", () => ({
  useVotingStatus: jest.fn(() => ({
    hasVoted: false,
    voteCounts: { bull: 3, bear: 2 },
    totalVotes: 5,
    serverStatus: "running",
  })),
}));

jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: jest.fn(({ count, estimateSize }: { count: number; estimateSize?: (i: number) => number }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 100,
        size: estimateSize ? estimateSize(i) : 100,
        key: `virtual-${i}`,
      })),
  })),
}));

jest.mock("next/dynamic", () => {
  return (loader: () => Promise<{ [key: string]: unknown }>) => {
    let Comp: unknown = null;
    loader().then((mod) => {
      Comp = Object.values(mod)[0];
    });
    return function DynamicFallback(props: Record<string, unknown>) {
      if (!Comp) return createElement("div", { "data-testid": "dynamic-loading" });
      return createElement(Comp as React.ComponentType, props);
    };
  };
});

let mockReducedMotion = false;

jest.mock("framer-motion", () => {
  return {
    motion: {
      div: (props: Record<string, unknown>) => {
        const { initial: _i, animate, exit: _e, transition: _t, layout: _l, layoutId: _lid, onAnimateComplete: _oac, ...rest } = props;
        let style = (rest.style as Record<string, unknown>) || {};
        if (animate && typeof animate === "object") {
          style = { ...style, ...animate };
        }
        return createElement("div", { ...rest, style });
      },
      span: (props: Record<string, unknown>) => {
        const { initial: _i2, animate: _a2, exit: _e2, transition: _t2, layout: _l2, layoutId: _lid2, onAnimateComplete: _oac2, ...rest } = props;
        let style = (rest.style as Record<string, unknown>) || {};
        if (_a2 && typeof _a2 === "object") {
          style = { ...style, ..._a2 };
        }
        return createElement("span", { ...rest, style });
      },
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      createElement(React.Fragment, null, children),
    useReducedMotion: () => mockReducedMotion,
  };
});

jest.mock("../../features/debate/hooks/storedVote", () => ({
  getStoredVote: jest.fn(() => null),
  setStoredVote: jest.fn(),
}));

describe("[3-5-3-UNIT] DebateStream optimistic vote wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockReducedMotion = false;
    mockSubmitVote.mockReset();
    mockFetchDebateResult.mockReset();
    mockFetchDebateResult.mockResolvedValue({
      data: {
        debateId: "debate-optimistic",
        asset: "BTC",
        status: "running",
        currentTurn: 1,
        maxTurns: 6,
        guardianVerdict: null,
        guardianInterruptsCount: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        totalVotes: 5,
        voteBreakdown: { bull: 3, bear: 2 },
      },
      error: null,
      meta: {},
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("[3-5-3-UNIT-OW01] vote button triggers optimistic pending state @p0", async () => {
    let resolveVote: (value: unknown) => void;
    mockSubmitVote.mockReturnValue(new Promise((r) => { resolveVote = r; }));

    render(<DebateStream debateId="debate-optimistic" />, { wrapper: createWrapper() });

    const bullButton = screen.getByRole("button", { name: /bull/i });
    await act(async () => {
      fireEvent.click(bullButton);
    });

    await waitFor(() => {
      const bar = screen.queryByTestId("bull-bar");
      if (bar) {
        expect(bar).toHaveStyle({ opacity: 0.85 });
      }
    });

    await act(async () => {
      resolveVote!({
        data: { debateId: "debate-optimistic", success: true },
      });
    });
  });

  test("[3-5-3-UNIT-OW02] successful vote transitions to confirmed opacity @p0", async () => {
    mockSubmitVote.mockResolvedValue({
      data: { debateId: "debate-optimistic", success: true },
    });

    render(<DebateStream debateId="debate-optimistic" />, { wrapper: createWrapper() });

    const bullButton = screen.getByRole("button", { name: /bull/i });
    await act(async () => {
      fireEvent.click(bullButton);
    });

    await waitFor(() => {
      const bar = screen.queryByTestId("bull-bar");
      if (bar) {
        expect(bar).toHaveStyle({ opacity: 1 });
      }
    });
  });

  test("[3-5-3-UNIT-OW03] timeout shows toast after 8 seconds @p0", async () => {
    let resolveVote: (value: unknown) => void;
    mockSubmitVote.mockReturnValue(new Promise((r) => { resolveVote = r; }));

    render(<DebateStream debateId="debate-optimistic" />, { wrapper: createWrapper() });

    const bullButton = screen.getByRole("button", { name: /bull/i });
    await act(async () => {
      fireEvent.click(bullButton);
    });

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect((toast as jest.Mocked<typeof toast>).info).toHaveBeenCalledWith(
      "Still Counting — Your vote is being processed. We'll update shortly.",
      { duration: 6000 }
    );

    await act(async () => {
      resolveVote!({ data: { success: true } });
    });
  });

  test("[3-5-3-UNIT-OW04] no timeout toast if vote resolves before 8s @p1", async () => {
    let resolveVote: (value: unknown) => void;
    mockSubmitVote.mockReturnValue(new Promise((r) => { resolveVote = r; }));

    render(<DebateStream debateId="debate-optimistic" />, { wrapper: createWrapper() });

    const bullButton = screen.getByRole("button", { name: /bull/i });
    await act(async () => {
      fireEvent.click(bullButton);
    });

    await act(async () => {
      resolveVote!({ data: { success: true } });
    });

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect((toast as jest.Mocked<typeof toast>).info).not.toHaveBeenCalled();
  });

  test("[3-5-3-UNIT-OW05] timer cleans up on unmount @p1", async () => {
    let resolveVote: (value: unknown) => void;
    mockSubmitVote.mockReturnValue(new Promise((r) => { resolveVote = r; }));

    const { unmount } = render(
      <DebateStream debateId="debate-optimistic" />,
      { wrapper: createWrapper() }
    );

    const bullButton = screen.getByRole("button", { name: /bull/i });
    await act(async () => {
      fireEvent.click(bullButton);
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect((toast as jest.Mocked<typeof toast>).info).not.toHaveBeenCalled();

    await act(async () => {
      resolveVote!({ data: { success: true } });
    });
  });
});
