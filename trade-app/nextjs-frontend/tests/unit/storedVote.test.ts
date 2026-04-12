import { getStoredVote, getStoredChoice, setStoredVote } from "../../features/debate/hooks/storedVote";

describe("[3-2-UNIT] storedVote utility", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test("[3-2-UNIT-SV01] getStoredVote returns null when no vote stored @p0", () => {
    expect(getStoredVote("debate-1")).toBeNull();
  });

  test("[3-2-UNIT-SV02] getStoredChoice returns null when no vote stored @p0", () => {
    expect(getStoredChoice("debate-1")).toBeNull();
  });

  test("[3-2-UNIT-SV03] setStoredVote persists choice and getStoredVote retrieves it @p0", () => {
    setStoredVote("debate-1", "bull");

    const stored = getStoredVote("debate-1");
    expect(stored).not.toBeNull();
    expect(stored!.choice).toBe("bull");
    expect(stored!.timestamp).toBeTruthy();
  });

  test("[3-2-UNIT-SV04] getStoredChoice returns choice after setStoredVote @p0", () => {
    setStoredVote("debate-2", "bear");
    expect(getStoredChoice("debate-2")).toBe("bear");
  });

  test("[3-2-UNIT-SV05] different debate IDs have independent storage @p0", () => {
    setStoredVote("debate-a", "bull");
    setStoredVote("debate-b", "bear");

    expect(getStoredChoice("debate-a")).toBe("bull");
    expect(getStoredChoice("debate-b")).toBe("bear");
  });

  test("[3-2-UNIT-SV06] setStoredVote overwrites previous vote for same debate @p1", () => {
    setStoredVote("debate-1", "bull");
    setStoredVote("debate-1", "bear");

    expect(getStoredChoice("debate-1")).toBe("bear");
  });

  test("[3-2-UNIT-SV07] getStoredVote handles corrupted JSON gracefully @p0", () => {
    sessionStorage.setItem("vote:debate-1", "not-json");
    expect(getStoredVote("debate-1")).toBeNull();
  });

  test("[3-2-UNIT-SV08] getStoredVote handles JSON without choice field @p1", () => {
    sessionStorage.setItem("vote:debate-1", JSON.stringify({ timestamp: new Date().toISOString() }));
    expect(getStoredVote("debate-1")).toEqual({ timestamp: expect.any(String), choice: undefined });
  });
});
