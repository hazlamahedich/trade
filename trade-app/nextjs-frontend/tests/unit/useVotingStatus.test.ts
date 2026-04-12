import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useVotingStatus } from "../../features/debate/hooks/useVotingStatus";
import { type DebateResultData, type DebateResultEnvelope } from "../../features/debate/api";
import * as api from "../../features/debate/api";

jest.mock("../../features/debate/api", () => ({
  ...jest.requireActual("../../features/debate/api"),
  fetchDebateResult: jest.fn(),
}));

const mockFetchDebateResult = api.fetchDebateResult as jest.MockedFunction<typeof api.fetchDebateResult>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function mockResult(overrides: Partial<DebateResultData> = {}): DebateResultEnvelope {
  return {
    data: {
      debateId: "debate-1",
      asset: "AAPL",
      status: "running",
      currentTurn: 1,
      maxTurns: 6,
      guardianVerdict: null,
      guardianInterruptsCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      totalVotes: 0,
      voteBreakdown: {},
      ...overrides,
    },
    error: null,
    meta: {},
  };
}

describe("[3-2-UNIT] useVotingStatus Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test("[3-2-UNIT-VS01] initial state has hasVoted=false when no prior vote @p0", async () => {
    // Given: no stored vote in session, API returns running debate
    mockFetchDebateResult.mockResolvedValue(mockResult());

    // When: hook mounts
    const { result } = renderHook(() => useVotingStatus("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: hasVoted is false, userChoice is null
    expect(result.current.hasVoted).toBe(false);
    expect(result.current.userChoice).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  test("[3-2-UNIT-VS02] hasVoted=true when sessionStorage has stored choice @p0", async () => {
    // Given: sessionStorage has a bull vote, API returns vote counts
    sessionStorage.setItem("vote:debate-1", JSON.stringify({
      choice: "bull",
      timestamp: new Date().toISOString(),
    }));

    mockFetchDebateResult.mockResolvedValue(mockResult({ totalVotes: 10, voteBreakdown: { bull: 6, bear: 4 } }));

    // When: hook mounts
    const { result } = renderHook(() => useVotingStatus("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: hasVoted is true, voteCounts reflect API data, userChoice is bull
    await waitFor(() => {
      expect(result.current.hasVoted).toBe(true);
      expect(result.current.voteCounts).toEqual({ bull: 6, bear: 4 });
    });

    expect(result.current.userChoice).toBe("bull");
  });

  test("[3-2-UNIT-VS03] server-first authority — userChoice reflects sessionStorage @p0", async () => {
    // Given: sessionStorage has bull vote, server confirms vote counts
    sessionStorage.setItem("vote:debate-1", JSON.stringify({
      choice: "bull",
      timestamp: new Date().toISOString(),
    }));

    mockFetchDebateResult.mockResolvedValue(mockResult({ totalVotes: 10, voteBreakdown: { bull: 6, bear: 4 } }));

    // When: hook mounts
    const { result } = renderHook(() => useVotingStatus("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: server totalVotes reflects API, userChoice from session
    await waitFor(() => {
      expect(result.current.totalVotes).toBe(10);
    });

    expect(result.current.userChoice).toBe("bull");
    expect(result.current.voteCounts).toEqual({ bull: 6, bear: 4 });
  });

  test("[3-2-UNIT-VS04] reconciliation — sessionStorage says bull, no server match, trust session @p1", async () => {
    // Given: sessionStorage has bull vote, server returns 0 votes (reconciliation gap)
    sessionStorage.setItem("vote:debate-1", JSON.stringify({
      choice: "bull",
      timestamp: new Date().toISOString(),
    }));

    mockFetchDebateResult.mockResolvedValue(mockResult());

    // When: hook mounts
    const { result } = renderHook(() => useVotingStatus("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: session is trusted — hasVoted=true, userChoice=bull
    await waitFor(() => {
      expect(result.current.totalVotes).toBe(0);
    });

    expect(result.current.hasVoted).toBe(true);
    expect(result.current.userChoice).toBe("bull");
  });

  test("[3-2-UNIT-VS05] isLoading is true during initial fetch @p1", () => {
    // Given: fetchDebateResult never resolves
    mockFetchDebateResult.mockReturnValue(new Promise(() => {}));

    // When: hook mounts
    const { result } = renderHook(() => useVotingStatus("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: isLoading is true
    expect(result.current.isLoading).toBe(true);
  });

  test("[3-2-UNIT-VS06] isLoading is false after fetch @p1", async () => {
    // Given: fetchDebateResult resolves with mock data
    mockFetchDebateResult.mockResolvedValue(mockResult());

    // When: hook mounts and fetch completes
    const { result } = renderHook(() => useVotingStatus("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: isLoading is false
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  test("[3-2-UNIT-VS07] serverStatus returned from API response @p1", async () => {
    // Given: API returns a completed debate status
    mockFetchDebateResult.mockResolvedValue(mockResult({
      status: "completed",
      currentTurn: 6,
      guardianVerdict: "Caution",
      guardianInterruptsCount: 1,
      completedAt: new Date().toISOString(),
      totalVotes: 5,
      voteBreakdown: { bull: 3, bear: 2 },
    }));

    // When: hook mounts
    const { result } = renderHook(() => useVotingStatus("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: serverStatus reflects completed
    await waitFor(() => {
      expect(result.current.serverStatus).toBe("completed");
    });
  });
});
