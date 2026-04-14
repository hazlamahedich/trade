import { extractVotes } from "@/features/debate/api/debate-history";

describe("extractVotes", () => {
  it("[P0] extracts bull, bear, and undecided votes from normal keys", () => {
    const result = extractVotes({ bull: 45, bear: 32, undecided: 5 });
    expect(result).toEqual({ bullVotes: 45, bearVotes: 32, undecidedVotes: 5 });
  });

  it("[P1] returns zeros for missing keys", () => {
    const result = extractVotes({});
    expect(result).toEqual({ bullVotes: 0, bearVotes: 0, undecidedVotes: 0 });
  });

  it("[P1] handles partial keys gracefully", () => {
    const result = extractVotes({ bull: 10 });
    expect(result).toEqual({ bullVotes: 10, bearVotes: 0, undecidedVotes: 0 });
  });

  it("[P1] handles extra unknown keys without throwing", () => {
    const result = extractVotes({ bull: 5, bear: 3, undecided: 2, other: 99 });
    expect(result).toEqual({ bullVotes: 5, bearVotes: 3, undecidedVotes: 2 });
  });

  it("[P0] never throws on any input", () => {
    expect(() => extractVotes({})).not.toThrow();
    expect(() => extractVotes({ random: 1 })).not.toThrow();
  });
});
