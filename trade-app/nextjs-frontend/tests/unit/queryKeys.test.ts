import { queryKeys } from "../../features/debate/hooks/queryKeys";

describe("[3-2-UNIT] queryKeys factory", () => {
  test("[3-2-UNIT-QK01] debateResult returns correct key @p1", () => {
    expect(queryKeys.debateResult("abc")).toEqual(["debate", "abc", "result"]);
  });

  test("[3-2-UNIT-QK02] keys are deterministic @p1", () => {
    expect(queryKeys.debateResult("xyz")).toEqual(queryKeys.debateResult("xyz"));
  });

  test("[3-2-UNIT-QK03] different debateIds produce different keys @p1", () => {
    expect(queryKeys.debateResult("a")).not.toEqual(queryKeys.debateResult("b"));
  });
});
