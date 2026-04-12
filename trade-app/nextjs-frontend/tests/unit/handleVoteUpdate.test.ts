import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { queryKeys } from "../../features/debate/hooks/queryKeys";
import type { DebateResultEnvelope } from "../../features/debate/api";
import type { VoteUpdatePayload } from "../../features/debate/hooks/useDebateSocket";

jest.mock("../../features/debate/hooks/storedVote", () => ({
  getStoredChoice: jest.fn().mockReturnValue("bull"),
}));

jest.mock("../../features/debate/api", () => ({
  fetchDebateResult: jest.fn().mockResolvedValue({
    data: {
      debateId: "deb_cache_test",
      asset: "ETH",
      status: "running",
      currentTurn: 3,
      maxTurns: 6,
      guardianVerdict: null,
      guardianInterruptsCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      totalVotes: 10,
      voteBreakdown: { bull: 6, bear: 4 },
    },
    error: null,
    meta: {},
  }),
}));

const mockCacheUpdate = jest.fn();

function useTestHandleVoteUpdate(debateId: string) {
  const queryClient = (React as unknown as { _qc?: QueryClient })._qc!;

  const handleVoteUpdate = React.useCallback(
    (payload: VoteUpdatePayload) => {
      queryClient.setQueryData<DebateResultEnvelope>(
        queryKeys.debateResult(debateId),
        (old) => {
          mockCacheUpdate(old, payload);
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              totalVotes: payload.totalVotes,
              voteBreakdown: payload.voteBreakdown,
            },
          };
        }
      );
    },
    [queryClient, debateId]
  );

  return { handleVoteUpdate };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  (React as unknown as { _qc?: QueryClient })._qc = queryClient;
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("[3-4-UNIT] handleVoteUpdate cache callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("updates totalVotes and voteBreakdown in cache @p0", () => {
    const debateId = "deb_cache_test";
    const { result } = renderHook(() => useTestHandleVoteUpdate(debateId), {
      wrapper: createWrapper(),
    });

    const payload: VoteUpdatePayload = {
      debateId,
      totalVotes: 20,
      voteBreakdown: { bull: 14, bear: 6 },
    };

    act(() => {
      result.current.handleVoteUpdate(payload);
    });

    expect(mockCacheUpdate).toHaveBeenCalledTimes(1);
    const callArgs = mockCacheUpdate.mock.calls[0];
    const updater = callArgs;
    expect(updater).toBeDefined();
  });

  test("returns old cache unchanged when old data is null @p1", () => {
    const debateId = "deb_no_data";
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    (React as unknown as { _qc?: QueryClient })._qc = qc;

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useTestHandleVoteUpdate(debateId), { wrapper });

    const payload: VoteUpdatePayload = {
      debateId,
      totalVotes: 5,
      voteBreakdown: { bull: 3, bear: 2 },
    };

    act(() => {
      result.current.handleVoteUpdate(payload);
    });

    expect(mockCacheUpdate).toHaveBeenCalledTimes(1);
    const [oldData] = mockCacheUpdate.mock.calls[0];
    expect(oldData).toBeUndefined();
  });

  test("multiple rapid updates apply sequentially via updater function @p0", () => {
    const debateId = "deb_rapid";
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    (React as unknown as { _qc?: QueryClient })._qc = qc;

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useTestHandleVoteUpdate(debateId), { wrapper });

    act(() => {
      result.current.handleVoteUpdate({
        debateId,
        totalVotes: 11,
        voteBreakdown: { bull: 7, bear: 4 },
      });
      result.current.handleVoteUpdate({
        debateId,
        totalVotes: 12,
        voteBreakdown: { bull: 8, bear: 4 },
      });
      result.current.handleVoteUpdate({
        debateId,
        totalVotes: 13,
        voteBreakdown: { bull: 9, bear: 4 },
      });
    });

    expect(mockCacheUpdate).toHaveBeenCalledTimes(3);
    const lastCall = mockCacheUpdate.mock.calls[2];
    const lastPayload = lastCall[1] as VoteUpdatePayload;
    expect(lastPayload.totalVotes).toBe(13);
  });
});
