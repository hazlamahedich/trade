import { queryKeys } from "../../features/debate/hooks/queryKeys";

describe("[3-2-UNIT] queryKeys factory", () => {
  test("[3-2-UNIT-QK01] debateResult returns correct key @p1", () => {
    // Given: a debateId "abc"
    // When: calling debateResult("abc")
    // Then: returns ["debate", "abc", "result"]
    expect(queryKeys.debateResult("abc")).toEqual(["debate", "abc", "result"]);
  });

  test("[3-2-UNIT-QK02] keys are deterministic @p1", () => {
    // Given: same debateId called twice
    // When: calling debateResult("xyz") twice
    // Then: both calls return the same key
    expect(queryKeys.debateResult("xyz")).toEqual(queryKeys.debateResult("xyz"));
  });

  test("[3-2-UNIT-QK03] different debateIds produce different keys @p1", () => {
    // Given: two different debateIds
    // When: calling debateResult for each
    // Then: keys are distinct
    expect(queryKeys.debateResult("a")).not.toEqual(queryKeys.debateResult("b"));
  });
});
