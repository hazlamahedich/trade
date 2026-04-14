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

  it("[P0] re-throws Error with original message", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue(
      new Error("Network timeout"),
    );

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("Network timeout");
  });

  it("[P0] re-throws HTTP error without double-wrapping", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue(
      new Error("Failed to fetch debate history: HTTP 500"),
    );

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("Failed to fetch debate history: HTTP 500");
  });

  it("[P0] throws Unknown error for non-Error throws", async () => {
    jest.mocked(fetchDebateHistory).mockRejectedValue("string error");

    await expect(
      getDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("Failed to fetch debate history: Unknown error");
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

  it("[P0] rejects invalid page number (page=0)", async () => {
    await expect(
      getDebateHistory({ page: 0, size: 20 }),
    ).rejects.toThrow();
  });

  it("[P0] rejects negative page number", async () => {
    await expect(
      getDebateHistory({ page: -1, size: 20 }),
    ).rejects.toThrow();
  });

  it("[P0] rejects invalid outcome value", async () => {
    await expect(
      getDebateHistory({ page: 1, size: 20, outcome: "banana" }),
    ).rejects.toThrow();
  });

  it("[P1] accepts valid outcome values", async () => {
    jest.mocked(fetchDebateHistory).mockResolvedValue({
      data: [],
      error: null,
      meta: { page: 1, size: 20, total: 0, pages: 0 },
    });

    await expect(
      getDebateHistory({ page: 1, size: 20, outcome: "bull" }),
    ).resolves.toBeDefined();
  });
});
