import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useVotingStatus, VOTE_POLL_INTERVAL_MS } from "../../features/debate/hooks/useVotingStatus";

jest.mock("../../features/debate/hooks/storedVote", () => ({
  getStoredChoice: jest.fn(),
}));

jest.mock("../../features/debate/api", () => ({
  fetchDebateResult: jest.fn().mockResolvedValue({
    data: {
      debateId: "deb_test",
      asset: "BTC",
      status: "running",
      currentTurn: 6,
      maxTurns: 6,
      guardianVerdict: null,
      guardianInterruptsCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      totalVotes: 10,
      voteBreakdown: { bull: 7, bear: 3 },
    },
    error: null,
    meta: {},
  }),
}));

import { getStoredChoice } from "../../features/debate/hooks/storedVote";

const mockGetStoredChoice = getStoredChoice as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("[3-4-UNIT] useVotingStatus polling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("refetchInterval is false when hasVoted is false", () => {
    mockGetStoredChoice.mockReturnValue(null);

    const { result } = renderHook(() => useVotingStatus("deb_test"), {
      wrapper: createWrapper(),
    });

    expect(result.current.hasVoted).toBe(false);
  });

  test("refetchInterval is VOTE_POLL_INTERVAL_MS when hasVoted is true", () => {
    mockGetStoredChoice.mockReturnValue("bull");

    const { result } = renderHook(() => useVotingStatus("deb_test"), {
      wrapper: createWrapper(),
    });

    expect(result.current.hasVoted).toBe(true);
    expect(VOTE_POLL_INTERVAL_MS).toBe(5000);
  });

  test("VOTE_POLL_INTERVAL_MS is 5000", () => {
    expect(VOTE_POLL_INTERVAL_MS).toBe(5000);
  });

  test("useQuery receives correct refetchInterval options", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    mockGetStoredChoice.mockReturnValue("bull");
    renderHook(() => useVotingStatus("deb_test"), { wrapper });

    const query = queryClient.getQueryCache().getAll()[0];
    expect(query).toBeDefined();
    const observer = query.observers[0];
    expect(observer.options.refetchInterval).toBe(VOTE_POLL_INTERVAL_MS);
    expect(observer.options.refetchIntervalInBackground).toBe(false);
  });

  test("useQuery refetchInterval is false when hasVoted is false", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    mockGetStoredChoice.mockReturnValue(null);
    renderHook(() => useVotingStatus("deb_test"), { wrapper });

    const query = queryClient.getQueryCache().getAll()[0];
    expect(query).toBeDefined();
    const observer = query.observers[0];
    expect(observer.options.refetchInterval).toBe(false);
  });
});
