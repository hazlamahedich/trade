import { getStoredVote, getStoredChoice, setStoredVote } from "../../features/debate/hooks/storedVote";

describe("[3-2-UNIT] storedVote utility", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test("[3-2-UNIT-SV01] getStoredVote returns null when no vote stored @p0", () => {
    // Given: empty sessionStorage
    // When: calling getStoredVote
    // Then: returns null
    expect(getStoredVote("debate-1")).toBeNull();
  });

  test("[3-2-UNIT-SV02] getStoredChoice returns null when no vote stored @p0", () => {
    // Given: empty sessionStorage
    // When: calling getStoredChoice
    // Then: returns null
    expect(getStoredChoice("debate-1")).toBeNull();
  });

  test("[3-2-UNIT-SV03] setStoredVote persists choice and getStoredVote retrieves it @p0", () => {
    // Given: no prior vote stored
    // When: storing a bull vote for debate-1
    setStoredVote("debate-1", "bull");

    // Then: getStoredVote returns the stored vote with choice and timestamp
    const stored = getStoredVote("debate-1");
    expect(stored).not.toBeNull();
    expect(stored!.choice).toBe("bull");
    expect(stored!.timestamp).toBeTruthy();
  });

  test("[3-2-UNIT-SV04] getStoredChoice returns choice after setStoredVote @p0", () => {
    // Given: a stored bear vote for debate-2
    // When: calling getStoredChoice
    // Then: returns "bear"
    setStoredVote("debate-2", "bear");
    expect(getStoredChoice("debate-2")).toBe("bear");
  });

  test("[3-2-UNIT-SV05] different debate IDs have independent storage @p0", () => {
    // Given: two debates with different votes
    // When: storing bull for debate-a, bear for debate-b
    setStoredVote("debate-a", "bull");
    setStoredVote("debate-b", "bear");

    // Then: each debate retrieves its own choice
    expect(getStoredChoice("debate-a")).toBe("bull");
    expect(getStoredChoice("debate-b")).toBe("bear");
  });

  test("[3-2-UNIT-SV06] setStoredVote overwrites previous vote for same debate @p1", () => {
    // Given: a stored bull vote
    // When: overwriting with bear vote for same debate
    setStoredVote("debate-1", "bull");
    setStoredVote("debate-1", "bear");

    // Then: latest choice is returned
    expect(getStoredChoice("debate-1")).toBe("bear");
  });

  test("[3-2-UNIT-SV07] getStoredVote handles corrupted JSON gracefully @p0", () => {
    // Given: corrupted JSON in sessionStorage
    // When: calling getStoredVote
    // Then: returns null without throwing
    sessionStorage.setItem("vote:debate-1", "not-json");
    expect(getStoredVote("debate-1")).toBeNull();
  });

  test("[3-2-UNIT-SV08] getStoredVote handles JSON without choice field @p1", () => {
    // Given: valid JSON but missing choice field
    // When: calling getStoredVote
    // Then: returns object with undefined choice
    sessionStorage.setItem("vote:debate-1", JSON.stringify({ timestamp: new Date().toISOString() }));
    expect(getStoredVote("debate-1")).toEqual({ timestamp: expect.any(String), choice: undefined });
  });
});
