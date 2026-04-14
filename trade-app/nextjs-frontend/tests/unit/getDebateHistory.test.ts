import { ZodError } from "zod";

jest.mock("../../features/debate/api/debate-history", () => ({
  fetchDebateHistory: jest.fn(),
}));

import { fetchDebateHistory } from "@/features/debate/api/debate-history";
import { getDebateHistory } from "@/features/debate/actions/debate-history-action";

describe("getDebateHistory error handling", () => {
  beforeEach(() => {
    jest.mocked(fetchDebateHistory).mockReset();
  });

  it("[P0] throws Invalid response shape on ZodError", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue(new ZodError([]));

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("Invalid response shape from debate history API");
  });

  it("[P0] wraps generic Error with prefix message", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue(
      new Error("Network timeout"),
    );

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("Failed to fetch debate history: Network timeout");
  });

  it("[P0] throws Unknown error for non-Error throws", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue("string error");

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("Failed to fetch debate history: Unknown error");
  });

  it("[P1] wraps HTTP error messages from fetch layer", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue(
      new Error("Failed to fetch debate history: HTTP 500"),
    );

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow(
      "Failed to fetch debate history: Failed to fetch debate history: HTTP 500",
    );
  });

  it("[P1] handles null error input", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue(null);

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("Failed to fetch debate history: Unknown error");
  });

  it("[P1] handles undefined error input", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue(undefined);

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("Failed to fetch debate history: Unknown error");
  });
});
