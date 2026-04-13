import { renderHook, act } from "@testing-library/react";
import { useFirstVoter } from "../../features/debate/hooks/useFirstVoter";

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });

describe("[3-6-UNIT] useFirstVoter Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorageMock.clear();
  });

  test("[3-6-UNIT-FV01] first voter celebration triggers on vote from zero @p0", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    expect(result.current).toBe(false);

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });

    expect(result.current).toBe(true);
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith("first-voter-debate-1", "true");
  });

  test("[3-6-UNIT-FV02] celebration only fires once per session @p0", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(true);

    rerender({ totalVotes: 2, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(true);

    rerender({ totalVotes: 3, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(true);
  });

  test("[3-6-UNIT-FV03] session storage persistence prevents retrigger on remount @p0", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(true);

    const { result: result2 } = renderHook(
      () => useFirstVoter(1, "debate-1", true)
    );

    expect(result2.current).toBe(true);
  });

  test("[3-6-UNIT-FV04] no celebration when total votes already nonzero @p0", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 5, debateId: "debate-1", hasVoted: false } }
    );

    rerender({ totalVotes: 6, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(false);
  });

  test("[3-6-UNIT-FV05] no celebration when total votes is zero after remount @p0", () => {
    const { result } = renderHook(
      () => useFirstVoter(0, "debate-1", false)
    );

    expect(result.current).toBe(false);
  });

  test("[3-6-UNIT-FV06] debate id change resets first voter state @p1", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(true);

    rerender({ totalVotes: 0, debateId: "debate-2", hasVoted: false });
    expect(result.current).toBe(false);
  });

  test("[3-6-UNIT-FV07] rapid rerenders do not retrigger celebration @p1", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    act(() => {
      rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
      rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
      rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
    });

    expect(result.current).toBe(true);
    expect(sessionStorageMock.setItem).toHaveBeenCalledTimes(1);
  });

  test("[3-6-UNIT-FV08] strict mode double effect no duplicate celebration @p0", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(true);

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(true);
  });

  test("[3-6-UNIT-FV09] no celebration when hasVoted is false during 0-to-1 transition @p0", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: false });

    expect(result.current).toBe(false);
    expect(sessionStorageMock.setItem).not.toHaveBeenCalled();
  });

  test("[3-6-UNIT-FV10] no celebration when hasVoted becomes true after transition @p0", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: false });
    expect(result.current).toBe(false);

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(false);
  });

  test("[3-6-UNIT-FV11] prevTotalRef resets to zero on debateId change @p1", () => {
    const { result, rerender } = renderHook(
      ({ totalVotes, debateId, hasVoted }) => useFirstVoter(totalVotes, debateId, hasVoted),
      { initialProps: { totalVotes: 0, debateId: "debate-1", hasVoted: false } }
    );

    rerender({ totalVotes: 1, debateId: "debate-1", hasVoted: true });
    expect(result.current).toBe(true);

    rerender({ totalVotes: 0, debateId: "debate-2", hasVoted: false });
    expect(result.current).toBe(false);

    rerender({ totalVotes: 1, debateId: "debate-2", hasVoted: true });
    expect(result.current).toBe(true);
  });
});
