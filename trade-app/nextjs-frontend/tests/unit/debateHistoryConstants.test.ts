import {
  SUPPORTED_ASSETS,
  VALID_OUTCOMES,
} from "@/features/debate/types/debate-history";

describe("Filter constants match backend", () => {
  it("SUPPORTED_ASSETS is a non-empty array", () => {
    expect(SUPPORTED_ASSETS.length).toBeGreaterThan(0);
  });

  it("SUPPORTED_ASSETS contains 6 values", () => {
    expect(SUPPORTED_ASSETS).toEqual(
      expect.arrayContaining(["btc", "eth", "sol", "bitcoin", "ethereum", "solana"]),
    );
  });

  it("VALID_OUTCOMES is a non-empty array", () => {
    expect(VALID_OUTCOMES.length).toBeGreaterThan(0);
  });

  it("VALID_OUTCOMES contains bull, bear, undecided", () => {
    expect(VALID_OUTCOMES).toEqual(
      expect.arrayContaining(["bull", "bear", "undecided"]),
    );
  });
});
