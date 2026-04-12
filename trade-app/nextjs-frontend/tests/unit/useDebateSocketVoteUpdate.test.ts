import { renderHook, act } from "@testing-library/react";
import { useDebateSocket, type VoteUpdatePayload } from "../../features/debate/hooks/useDebateSocket";
import { createMockWebSocketSetup } from "../support/helpers/mock-websocket";

const { install, cleanup, waitForInstance } = createMockWebSocketSetup();

beforeEach(() => {
  install();
});

afterEach(() => {
  cleanup();
});

describe("[3-4-UNIT] useDebateSocket VOTE_UPDATE handler", () => {
  const debateId = "deb_test_ws";

  test("DEBATE/VOTE_UPDATE triggers onVoteUpdate callback with correct payload", async () => {
    const onVoteUpdate = jest.fn();

    renderHook(() =>
      useDebateSocket({
        debateId,
        onVoteUpdate,
      }),
    );

    const ws = await waitForInstance();
    act(() => {
      ws.simulateOpen();
    });

    const payload: VoteUpdatePayload = {
      debateId: "deb_test_ws",
      totalVotes: 42,
      voteBreakdown: { bull: 28, bear: 14 },
    };

    act(() => {
      ws.simulateMessage({
        type: "DEBATE/VOTE_UPDATE",
        payload,
        timestamp: new Date().toISOString(),
      });
    });

    expect(onVoteUpdate).toHaveBeenCalledTimes(1);
    expect(onVoteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        debateId: "deb_test_ws",
        totalVotes: 42,
        voteBreakdown: { bull: 28, bear: 14 },
      }),
    );
  });

  test("malformed payload does not crash the hook", async () => {
    const onVoteUpdate = jest.fn();

    renderHook(() =>
      useDebateSocket({
        debateId,
        onVoteUpdate,
      }),
    );

    const ws = await waitForInstance();
    act(() => {
      ws.simulateOpen();
    });

    act(() => {
      ws.simulateMessage({
        type: "DEBATE/VOTE_UPDATE",
        payload: null,
        timestamp: new Date().toISOString(),
      });
    });

    expect(onVoteUpdate).not.toHaveBeenCalled();

    act(() => {
      ws.simulateMessage({
        type: "DEBATE/VOTE_UPDATE",
        payload: { debateId: "x" },
        timestamp: new Date().toISOString(),
      });
    });

    expect(onVoteUpdate).not.toHaveBeenCalled();
  });

  test("rapid sequential VOTE_UPDATE events all fire callback", async () => {
    const onVoteUpdate = jest.fn();

    renderHook(() =>
      useDebateSocket({
        debateId,
        onVoteUpdate,
      }),
    );

    const ws = await waitForInstance();
    act(() => {
      ws.simulateOpen();
    });

    for (let i = 1; i <= 5; i++) {
      act(() => {
        ws.simulateMessage({
          type: "DEBATE/VOTE_UPDATE",
          payload: {
            debateId: "deb_test_ws",
            totalVotes: i * 10,
            voteBreakdown: { bull: i * 6, bear: i * 4 },
          },
          timestamp: new Date().toISOString(),
        });
      });
    }

    expect(onVoteUpdate).toHaveBeenCalledTimes(5);
  });
});
