import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useVote } from "../../features/debate/hooks/useVote";
import * as api from "../../features/debate/api";
import type { VoteSuccessEnvelope } from "../../features/debate/api";

const mockToastInfo = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    success: jest.fn(),
  },
}));

jest.mock("../../features/debate/api", () => ({
  ...jest.requireActual("../../features/debate/api"),
  submitVote: jest.fn(),
  getOrCreateVoterFingerprint: jest.fn(() => "test-fingerprint"),
}));

const mockSubmitVote = api.submitVote as jest.MockedFunction<typeof api.submitVote>;

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

function mockSuccessResponse(choice: string): VoteSuccessEnvelope {
  return {
    data: {
      voteId: "vote-1",
      debateId: "debate-1",
      choice,
      voterFingerprint: "test-fingerprint",
      createdAt: new Date().toISOString(),
    },
    error: null,
    meta: { latencyMs: 50, isFinal: true },
  };
}

function mockApiError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { code, status, meta: {} });
}

describe("[3-2-UNIT] useVote Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test("[3-2-UNIT-UV01] initial state is idle with no userVote @p0", () => {
    // Given: hook mounted with no prior session state
    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: voteStatus is idle, userVote is null, error is null
    expect(result.current.voteStatus).toBe("idle");
    expect(result.current.userVote).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("[3-2-UNIT-UV02] vote('bull') transitions to voting immediately @p0", () => {
    // Given: hook mounted, submitVote returns a pending promise
    mockSubmitVote.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: calling vote('bull')
    act(() => {
      result.current.vote("bull");
    });

    // Then: voteStatus is 'voting' and userVote is 'bull' immediately
    expect(result.current.voteStatus).toBe("voting");
    expect(result.current.userVote).toBe("bull");
  });

  test("[3-2-UNIT-UV03] API success transitions to voted with correct choice @p0", async () => {
    // Given: submitVote will resolve successfully
    mockSubmitVote.mockResolvedValue(mockSuccessResponse("bull"));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: calling vote('bull')
    act(() => {
      result.current.vote("bull");
    });

    // Then: transitions to 'voted' with userVote='bull'
    await waitFor(() => {
      expect(result.current.voteStatus).toBe("voted");
    });

    expect(result.current.userVote).toBe("bull");
  });

  test("[3-2-UNIT-UV04] API 409 DUPLICATE_VOTE confirms voted state with toast.info @p0", async () => {
    // Given: submitVote rejects with 409 DUPLICATE_VOTE
    mockSubmitVote.mockRejectedValue(mockApiError("DUPLICATE_VOTE", "Already voted", 409));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: calling vote('bull')
    act(() => {
      result.current.vote("bull");
    });

    // Then: voteStatus becomes 'voted', userVote confirmed, toast.info shown
    await waitFor(() => {
      expect(result.current.voteStatus).toBe("voted");
    });

    expect(result.current.userVote).toBe("bull");
    expect(mockToastInfo).toHaveBeenCalledWith("Your vote is already counted!");
  });

  test("[3-2-UNIT-UV04b] DUPLICATE_VOTE preserves existing stored vote @p1", async () => {
    // Given: sessionStorage already has a bull vote for debate-1
    sessionStorage.setItem("vote:debate-1", JSON.stringify({
      choice: "bull",
      timestamp: new Date().toISOString(),
    }));

    mockSubmitVote.mockRejectedValue(mockApiError("DUPLICATE_VOTE", "Already voted", 409));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: hook loads with existing vote, then tries to vote('bear')
    await waitFor(() => {
      expect(result.current.voteStatus).toBe("voted");
    });

    expect(result.current.userVote).toBe("bull");

    act(() => {
      result.current.vote("bear");
    });

    // Then: userVote remains 'bull' — DUPLICATE_VOTE preserves original
    await waitFor(() => {
      expect(result.current.voteStatus).toBe("voted");
    });

    expect(result.current.userVote).toBe("bull");
  });

  test("[3-2-UNIT-UV05] API 429 RATE_LIMITED transitions to error @p0", async () => {
    // Given: submitVote rejects with 429 RATE_LIMITED
    mockSubmitVote.mockRejectedValue(mockApiError("RATE_LIMITED", "Too many votes", 429));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: calling vote('bull')
    act(() => {
      result.current.vote("bull");
    });

    // Then: voteStatus is 'error', userVote reverted to null, toast error shown
    await waitFor(() => {
      expect(result.current.voteStatus).toBe("error");
    });

    expect(result.current.userVote).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith("Slow down! Please wait a moment before voting again.");
  });

  test("[3-2-UNIT-UV06] API 503 VOTING_DISABLED transitions to error @p0", async () => {
    // Given: submitVote rejects with 503 VOTING_DISABLED
    mockSubmitVote.mockRejectedValue(mockApiError("VOTING_DISABLED", "Voting disabled", 503));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: calling vote('bull')
    act(() => {
      result.current.vote("bull");
    });

    // Then: voteStatus is 'error', userVote reverted to null
    await waitFor(() => {
      expect(result.current.voteStatus).toBe("error");
    });

    expect(result.current.userVote).toBeNull();
  });

  test("[3-2-UNIT-UV07] network error transitions to error and reverts @p0", async () => {
    // Given: submitVote rejects with a generic network error
    mockSubmitVote.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: calling vote('bull')
    act(() => {
      result.current.vote("bull");
    });

    // Then: voteStatus is 'error', userVote reverted to null
    await waitFor(() => {
      expect(result.current.voteStatus).toBe("error");
    });

    expect(result.current.userVote).toBeNull();
  });

  test("[3-2-UNIT-UV08] userVote persisted to sessionStorage @p0", async () => {
    // Given: submitVote will succeed
    mockSubmitVote.mockResolvedValue(mockSuccessResponse("bull"));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: voting bull and waiting for completion
    act(() => {
      result.current.vote("bull");
    });

    await waitFor(() => {
      expect(result.current.voteStatus).toBe("voted");
    });

    // Then: vote is persisted in sessionStorage
    const stored = sessionStorage.getItem("vote:debate-1");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).choice).toBe("bull");
  });

  test("[3-2-UNIT-UV09] userVote loaded from sessionStorage on mount via effect @p0", async () => {
    // Given: sessionStorage has a bear vote for debate-1
    sessionStorage.setItem("vote:debate-1", JSON.stringify({
      choice: "bear",
      timestamp: new Date().toISOString(),
    }));

    // When: hook mounts
    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // Then: userVote is 'bear' and voteStatus is 'voted'
    await waitFor(() => {
      expect(result.current.userVote).toBe("bear");
      expect(result.current.voteStatus).toBe("voted");
    });
  });

  test("[3-2-UNIT-UV10] race condition — vote() while voting is no-op @p0", async () => {
    // Given: submitVote returns a never-resolving promise
    mockSubmitVote.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    // When: voting bull, then trying to vote bear mid-flight
    act(() => {
      result.current.vote("bull");
    });

    await waitFor(() => {
      expect(result.current.voteStatus).toBe("voting");
    });

    act(() => {
      result.current.vote("bear");
    });

    // Then: submitVote called only once, userVote stays 'bull'
    expect(mockSubmitVote).toHaveBeenCalledTimes(1);
    expect(result.current.userVote).toBe("bull");
  });

  test("[3-2-UNIT-UV10b] vote() after voted is also no-op @p0", async () => {
    // Given: a successful vote completes
    mockSubmitVote.mockResolvedValue(mockSuccessResponse("bull"));

    const { result } = renderHook(() => useVote("debate-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.vote("bull");
    });

    await waitFor(() => {
      expect(result.current.voteStatus).toBe("voted");
    });

    // When: trying to vote again after already voted
    mockSubmitVote.mockClear();

    act(() => {
      result.current.vote("bear");
    });

    // Then: submitVote not called again, userVote stays 'bull'
    expect(mockSubmitVote).not.toHaveBeenCalled();
    expect(result.current.userVote).toBe("bull");
  });

  test("[3-2-UNIT-UV11] concurrent debates don't cross-contaminate @p1", async () => {
    // Given: debate-a has a stored bull vote, debate-b has nothing
    sessionStorage.setItem("vote:debate-a", JSON.stringify({
      choice: "bull",
      timestamp: new Date().toISOString(),
    }));

    // When: mounting hooks for both debates
    const { result: resultA } = renderHook(() => useVote("debate-a"), {
      wrapper: createWrapper(),
    });
    const { result: resultB } = renderHook(() => useVote("debate-b"), {
      wrapper: createWrapper(),
    });

    // Then: debate-a shows voted with bull, debate-b stays idle
    await waitFor(() => {
      expect(resultA.current.userVote).toBe("bull");
      expect(resultA.current.voteStatus).toBe("voted");
    });

    expect(resultB.current.userVote).toBeNull();
    expect(resultB.current.voteStatus).toBe("idle");
  });
});
