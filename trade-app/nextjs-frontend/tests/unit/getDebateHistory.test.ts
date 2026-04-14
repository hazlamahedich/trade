import { ZodError } from "zod";

function getDebateHistoryErrorRouter(error: unknown): Error {
  if (error instanceof ZodError) {
    return new Error("Invalid response shape from debate history API");
  }
  if (error instanceof Error) {
    return new Error(`Failed to fetch debate history: ${error.message}`);
  }
  return new Error("Failed to fetch debate history: Unknown error");
}

describe("getDebateHistory error handling logic", () => {
  it("throws Invalid response shape on ZodError", () => {
    const result = getDebateHistoryErrorRouter(new ZodError([]));
    expect(result.message).toBe("Invalid response shape from debate history API");
  });

  it("wraps generic Error with prefix message", () => {
    const result = getDebateHistoryErrorRouter(new Error("Network timeout"));
    expect(result.message).toBe("Failed to fetch debate history: Network timeout");
  });

  it("throws Unknown error for non-Error throws", () => {
    const result = getDebateHistoryErrorRouter("string error");
    expect(result.message).toBe("Failed to fetch debate history: Unknown error");
  });

  it("wraps HTTP error messages from fetch layer", () => {
    const result = getDebateHistoryErrorRouter(
      new Error("Failed to fetch debate history: HTTP 500"),
    );
    expect(result.message).toBe(
      "Failed to fetch debate history: Failed to fetch debate history: HTTP 500",
    );
  });

  it("handles null error input", () => {
    const result = getDebateHistoryErrorRouter(null);
    expect(result.message).toBe("Failed to fetch debate history: Unknown error");
  });

  it("handles undefined error input", () => {
    const result = getDebateHistoryErrorRouter(undefined);
    expect(result.message).toBe("Failed to fetch debate history: Unknown error");
  });
});
