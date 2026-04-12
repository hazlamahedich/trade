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

function createWrapperAndClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

describe("[3-5-2-UNIT] useVotingStatus WS gate polling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("[3-5-2-UNIT-WG01] poll suppressed when wsConnected=true and hasVoted=true @p0", () => {
    mockGetStoredChoice.mockReturnValue("bull");
    const { wrapper, queryClient } = createWrapperAndClient();

    renderHook(() => useVotingStatus("deb_test", { wsConnected: true }), { wrapper });

    const query = queryClient.getQueryCache().getAll()[0];
    expect(query).toBeDefined();
    const observer = query.observers[0];
    expect(observer.options.refetchInterval).toBe(false);
  });

  test("[3-5-2-UNIT-WG02] poll active when wsConnected=false and hasVoted=true @p0", () => {
    mockGetStoredChoice.mockReturnValue("bull");
    const { wrapper, queryClient } = createWrapperAndClient();

    renderHook(() => useVotingStatus("deb_test", { wsConnected: false }), { wrapper });

    const query = queryClient.getQueryCache().getAll()[0];
    expect(query).toBeDefined();
    const observer = query.observers[0];
    expect(observer.options.refetchInterval).toBe(VOTE_POLL_INTERVAL_MS);
  });

  test("[3-5-2-UNIT-WG03] poll inactive when hasVoted=false regardless of ws state @p0", () => {
    mockGetStoredChoice.mockReturnValue(null);
    const { wrapper, queryClient } = createWrapperAndClient();

    renderHook(() => useVotingStatus("deb_test", { wsConnected: true }), { wrapper });

    const query = queryClient.getQueryCache().getAll()[0];
    expect(query).toBeDefined();
    const observer = query.observers[0];
    expect(observer.options.refetchInterval).toBe(false);
  });

  test("[3-5-2-UNIT-WG04] default wsConnected=false polls when hasVoted=true @p1", () => {
    mockGetStoredChoice.mockReturnValue("bull");
    const { wrapper, queryClient } = createWrapperAndClient();

    renderHook(() => useVotingStatus("deb_test"), { wrapper });

    const query = queryClient.getQueryCache().getAll()[0];
    expect(query).toBeDefined();
    const observer = query.observers[0];
    expect(observer.options.refetchInterval).toBe(VOTE_POLL_INTERVAL_MS);
  });

  test("[3-5-2-UNIT-WG05] wsConnected=true overrides hasVoted=true @p0", () => {
    mockGetStoredChoice.mockReturnValue("bear");
    const { wrapper, queryClient } = createWrapperAndClient();

    renderHook(() => useVotingStatus("deb_test", { wsConnected: true }), { wrapper });

    expect(queryClient.getQueryCache().getAll()[0].observers[0].options.refetchInterval).toBe(false);
  });
});
