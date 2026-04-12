import { submitVote, fetchDebateResult, getOrCreateVoterFingerprint, type VoteSuccessEnvelope } from "../../features/debate/api";

const mockFetch = jest.fn();
global.fetch = mockFetch;

Object.defineProperty(global, "crypto", {
  value: { randomUUID: () => "mock-uuid-" + Math.random().toString(36).slice(2, 10) },
});

describe("[3-2-UNIT] Vote API Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe("submitVote", () => {
    const validRequest = {
      debateId: "debate-1",
      choice: "bull" as const,
      voterFingerprint: "fp-123",
    };

    const successResponse: VoteSuccessEnvelope = {
      data: {
        voteId: "vote-1",
        debateId: "debate-1",
        choice: "bull",
        voterFingerprint: "fp-123",
        createdAt: new Date().toISOString(),
      },
      error: null,
      meta: { latencyMs: 50, isFinal: true },
    };

    test("[3-2-UNIT-API01] successful vote returns data envelope @p0", async () => {
      // Given: API returns 200 with success envelope
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(successResponse),
      });

      // When: calling submitVote
      const result = await submitVote(validRequest);

      // Then: result contains voteId and choice
      expect(result.data.voteId).toBe("vote-1");
      expect(result.data.choice).toBe("bull");
    });

    test("[3-2-UNIT-API02] 409 DUPLICATE_VOTE throws with code @p0", async () => {
      // Given: API returns 409 DUPLICATE_VOTE
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({
          data: null,
          error: { code: "DUPLICATE_VOTE", message: "Already voted" },
          meta: {},
        }),
      });

      // When/Then: submitVote rejects with DUPLICATE_VOTE code and 409 status
      await expect(submitVote(validRequest)).rejects.toMatchObject({
        code: "DUPLICATE_VOTE",
        status: 409,
      });
    });

    test("[3-2-UNIT-API03] 429 RATE_LIMITED throws with code @p0", async () => {
      // Given: API returns 429 RATE_LIMITED
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({
          data: null,
          error: { code: "RATE_LIMITED", message: "Too many votes" },
          meta: { retryAfterMs: 5000 },
        }),
      });

      // When/Then: submitVote rejects with RATE_LIMITED code and 429 status
      await expect(submitVote(validRequest)).rejects.toMatchObject({
        code: "RATE_LIMITED",
        status: 429,
      });
    });

    test("[3-2-UNIT-API04] 503 VOTING_DISABLED throws with code @p0", async () => {
      // Given: API returns 503 VOTING_DISABLED
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({
          data: null,
          error: { code: "VOTING_DISABLED", message: "Voting disabled" },
          meta: { estimatedWaitMs: 10000 },
        }),
      });

      // When/Then: submitVote rejects with VOTING_DISABLED code and 503 status
      await expect(submitVote(validRequest)).rejects.toMatchObject({
        code: "VOTING_DISABLED",
        status: 503,
      });
    });

    test("[3-2-UNIT-API05] non-JSON response handled gracefully @p0", async () => {
      // Given: API returns 500 with plain text body
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      // When/Then: submitVote rejects with INVALID_RESPONSE code
      await expect(submitVote(validRequest)).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    });

    test("[3-2-UNIT-API06] sends correct request body @p1", async () => {
      // Given: API will accept the vote
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(successResponse),
      });

      // When: calling submitVote
      await submitVote(validRequest);

      // Then: fetch called with correct URL, method, headers, and body
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/debate/vote"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validRequest),
        }),
      );
    });
  });

  describe("fetchDebateResult", () => {
    test("[3-2-UNIT-API07] returns debate result on success @p0", async () => {
      // Given: API returns 200 with debate result data
      const resultData = {
        data: {
          debateId: "debate-1",
          asset: "BTC",
          status: "running",
          currentTurn: 3,
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
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => resultData,
      });

      // When: calling fetchDebateResult
      const result = await fetchDebateResult("debate-1");

      // Then: result contains totalVotes and voteBreakdown
      expect(result.data.totalVotes).toBe(5);
      expect(result.data.voteBreakdown).toEqual({ bull: 3, bear: 2 });
    });

    test("[3-2-UNIT-API08] throws on non-OK response @p0", async () => {
      // Given: API returns 404
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      // When/Then: fetchDebateResult rejects with status 404
      await expect(fetchDebateResult("nonexistent")).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("getOrCreateVoterFingerprint", () => {
    test("[3-2-UNIT-API09] creates and returns new fingerprint @p0", () => {
      // Given: no existing fingerprint in session
      // When: calling getOrCreateVoterFingerprint
      const fp = getOrCreateVoterFingerprint();

      // Then: returns a non-empty string
      expect(fp).toBeTruthy();
      expect(fp.length).toBeGreaterThanOrEqual(1);
    });

    test("[3-2-UNIT-API10] returns existing fingerprint from sessionStorage @p0", () => {
      // Given: sessionStorage has an existing fingerprint
      sessionStorage.setItem("voter_fingerprint", "existing-fp");

      // When: calling getOrCreateVoterFingerprint
      const fp = getOrCreateVoterFingerprint();

      // Then: returns the existing fingerprint
      expect(fp).toBe("existing-fp");
    });

    test("[3-2-UNIT-API11] stores new fingerprint in sessionStorage @p1", () => {
      // Given: no existing fingerprint
      // When: calling getOrCreateVoterFingerprint
      getOrCreateVoterFingerprint();

      // Then: fingerprint is persisted in sessionStorage
      const stored = sessionStorage.getItem("voter_fingerprint");
      expect(stored).toBeTruthy();
    });

    test("[3-2-UNIT-API12] returns empty string when window is undefined @p1", () => {
      // Given: global.window is undefined (SSR environment)
      const saved = global.window;
      try {
        Object.defineProperty(global, "window", { value: undefined, writable: true, configurable: true });

        // When: calling getOrCreateVoterFingerprint
        const fp = getOrCreateVoterFingerprint();

        // Then: returns empty string without crashing
        expect(fp).toBe("");
      } finally {
        Object.defineProperty(global, "window", { value: saved, writable: true, configurable: true });
      }
    });
  });
});
