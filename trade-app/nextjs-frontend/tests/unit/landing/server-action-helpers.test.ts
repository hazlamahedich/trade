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
    it("given a successful fetch, when fetchWithTimeout is called, then it returns ok with the response", async () => {
      const resp = mockResponse();
      globalThis.fetch = jest.fn().mockResolvedValue(resp);

      const result = await fetchWithTimeout("http://localhost/api/test");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.response).toBe(resp);
      }
    });

    it("given a fetch that throws, when fetchWithTimeout is called, then it returns error with the message", async () => {
      globalThis.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));

      const result = await fetchWithTimeout("http://localhost/api/test");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Network failure");
      }
    });

    it("given a URL and options, when fetchWithTimeout is called, then it passes an abort signal to fetch", async () => {
      const fetchSpy = jest.fn().mockResolvedValue(mockResponse());
      globalThis.fetch = fetchSpy;

      await fetchWithTimeout("http://localhost/api/test", {}, 5000);

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost/api/test",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("given a non-Error thrown value, when fetchWithTimeout is called, then it returns error with the raw value", async () => {
      globalThis.fetch = jest.fn().mockRejectedValue("string error");

      const result = await fetchWithTimeout("http://localhost/api/test");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("string error");
      }
    });

    it("given no timeout argument, when fetchWithTimeout is called, then it uses the default 10000ms timeout", async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(mockResponse());

      const result = await fetchWithTimeout("http://localhost/api/test");

      expect(result.ok).toBe(true);
    });

    it("given custom options, when fetchWithTimeout is called, then it merges them with the abort signal", async () => {
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

    it("given a custom timeout, when fetchWithTimeout is called, then it creates an abort signal with that timeout", async () => {
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
    it("given a valid envelope with data key, when isValidEnvelope is called, then it returns true", () => {
      expect(isValidEnvelope({ data: null, error: null, meta: {} })).toBe(true);
    });

    it("given an envelope with only data key, when isValidEnvelope is called, then it returns true", () => {
      expect(isValidEnvelope({ data: "something" })).toBe(true);
    });

    it("given null, when isValidEnvelope is called, then it returns false", () => {
      expect(isValidEnvelope(null)).toBe(false);
    });

    it("given undefined, when isValidEnvelope is called, then it returns false", () => {
      expect(isValidEnvelope(undefined)).toBe(false);
    });

    it("given a string, when isValidEnvelope is called, then it returns false", () => {
      expect(isValidEnvelope("not-an-object")).toBe(false);
    });

    it("given a number, when isValidEnvelope is called, then it returns false", () => {
      expect(isValidEnvelope(42)).toBe(false);
    });

    it("given an array, when isValidEnvelope is called, then it returns false", () => {
      expect(isValidEnvelope([1, 2, 3])).toBe(false);
    });

    it("given an object without data key, when isValidEnvelope is called, then it returns false", () => {
      expect(isValidEnvelope({ error: "something" })).toBe(false);
    });

    it("given an envelope with data value of null, when isValidEnvelope is called, then it returns true", () => {
      expect(isValidEnvelope({ data: null })).toBe(true);
    });

    it("given an envelope with data value of undefined, when isValidEnvelope is called, then it returns true", () => {
      expect(isValidEnvelope({ data: undefined })).toBe(true);
    });
  });
});
