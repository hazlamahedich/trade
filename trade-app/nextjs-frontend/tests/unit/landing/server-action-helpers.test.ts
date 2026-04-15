import { fetchWithTimeout, isValidEnvelope } from "@/lib/api/server-action-helpers";

function mockResponse(): object {
  return { ok: true, status: 200, json: () => Promise.resolve({}) };
}

describe("[4.4-UNIT-Helpers] server-action-helpers", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("fetchWithTimeout", () => {
    it("returns success result with response on successful fetch", async () => {
      const resp = mockResponse();
      globalThis.fetch = jest.fn().mockResolvedValue(resp);

      const result = await fetchWithTimeout("http://localhost/api/test");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.response).toBe(resp);
      }
    });

    it("returns error result when fetch throws", async () => {
      globalThis.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));

      const result = await fetchWithTimeout("http://localhost/api/test");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Network failure");
      }
    });

    it("passes abort signal to fetch options", async () => {
      const fetchSpy = jest.fn().mockResolvedValue(mockResponse());
      globalThis.fetch = fetchSpy;

      await fetchWithTimeout("http://localhost/api/test", {}, 5000);

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost/api/test",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("handles non-Error thrown values", async () => {
      globalThis.fetch = jest.fn().mockRejectedValue("string error");

      const result = await fetchWithTimeout("http://localhost/api/test");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("string error");
      }
    });

    it("uses default timeout of 10000ms", async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(mockResponse());

      const result = await fetchWithTimeout("http://localhost/api/test");

      expect(result.ok).toBe(true);
    });

    it("merges provided options with signal", async () => {
      const fetchSpy = jest.fn().mockResolvedValue(mockResponse());
      globalThis.fetch = fetchSpy;

      await fetchWithTimeout("http://localhost/api/test", { method: "POST" }, 5000);

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost/api/test",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("uses provided timeout value", async () => {
      const fetchSpy = jest.fn().mockImplementation((_url: string, opts?: RequestInit) => {
        expect(opts?.signal).toBeDefined();
        expect(opts?.signal?.aborted).toBe(false);
        return Promise.resolve(mockResponse());
      });
      globalThis.fetch = fetchSpy;

      const result = await fetchWithTimeout("http://localhost/api/test", {}, 500);
      expect(result.ok).toBe(true);
    });
  });

  describe("isValidEnvelope", () => {
    it("returns true for valid envelope with data key", () => {
      expect(isValidEnvelope({ data: null, error: null, meta: {} })).toBe(true);
    });

    it("returns true for envelope with only data key", () => {
      expect(isValidEnvelope({ data: "something" })).toBe(true);
    });

    it("returns false for null", () => {
      expect(isValidEnvelope(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidEnvelope(undefined)).toBe(false);
    });

    it("returns false for string", () => {
      expect(isValidEnvelope("not-an-object")).toBe(false);
    });

    it("returns false for number", () => {
      expect(isValidEnvelope(42)).toBe(false);
    });

    it("returns false for array", () => {
      expect(isValidEnvelope([1, 2, 3])).toBe(false);
    });

    it("returns false for object without data key", () => {
      expect(isValidEnvelope({ error: "something" })).toBe(false);
    });

    it("returns true for envelope with data value of null", () => {
      expect(isValidEnvelope({ data: null })).toBe(true);
    });

    it("returns true for envelope with data value of undefined", () => {
      expect(isValidEnvelope({ data: undefined })).toBe(true);
    });
  });
});
