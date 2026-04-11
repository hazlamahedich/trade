import { act, renderHook, waitFor } from "@testing-library/react";
import { useDebateSocket } from "../../features/debate/hooks/useDebateSocket";
import type { ArgumentPayload } from "../../features/debate/hooks/useDebateSocket";
import { createMockWebSocketSetup } from "../support/helpers/mock-websocket";

describe("[2-4] useDebateSocket — isRedacted Field Handling", () => {
  const wsSetup = createMockWebSocketSetup();

  beforeEach(() => {
    wsSetup.install();
  });

  afterEach(() => {
    wsSetup.cleanup();
  });

  describe("[P0] isRedacted Field in ARGUMENT_COMPLETE", () => {
    test("[2-4-UNIT-001] receives isRedacted=true from ARGUMENT_COMPLETE @p0", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-redacted",
          onArgumentComplete,
        })
      );

      const ws = await wsSetup.waitForInstance();
      await act(async () => { ws.simulateOpen(); });

      await act(async () => {
        ws.simulateMessage({
          type: "DEBATE/ARGUMENT_COMPLETE",
          payload: {
            debateId: "test-debate-redacted",
            agent: "bull",
            content: "This is a [REDACTED] profit opportunity.",
            turn: 1,
            isRedacted: true,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          isRedacted: true,
          content: expect.stringContaining("[REDACTED]"),
        })
      );
    });

    test("[2-4-UNIT-002] receives isRedacted=false for clean arguments @p0", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-clean",
          onArgumentComplete,
        })
      );

      const ws = await wsSetup.waitForInstance();
      await act(async () => { ws.simulateOpen(); });

      await act(async () => {
        ws.simulateMessage({
          type: "DEBATE/ARGUMENT_COMPLETE",
          payload: {
            debateId: "test-debate-clean",
            agent: "bear",
            content: "Market risks remain elevated.",
            turn: 1,
            isRedacted: false,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          isRedacted: false,
        })
      );
    });

    test("[2-4-UNIT-003] handles missing isRedacted gracefully (backward compat) @p0", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-legacy",
          onArgumentComplete,
        })
      );

      const ws = await wsSetup.waitForInstance();
      await act(async () => { ws.simulateOpen(); });

      await act(async () => {
        ws.simulateMessage({
          type: "DEBATE/ARGUMENT_COMPLETE",
          payload: {
            debateId: "test-debate-legacy",
            agent: "bull",
            content: "Standard argument without isRedacted field.",
            turn: 1,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Standard argument without isRedacted field.",
        })
      );
    });

    test("[2-4-UNIT-004] ArgumentPayload type includes isRedacted optional field @p0", () => {
      const payloadWithRedaction: ArgumentPayload = {
        debateId: "deb-1",
        agent: "bull",
        content: "[REDACTED] content",
        turn: 1,
        isRedacted: true,
      };

      const payloadWithoutRedaction: ArgumentPayload = {
        debateId: "deb-2",
        agent: "bear",
        content: "Clean content",
      };

      expect(payloadWithRedaction.isRedacted).toBe(true);
      expect(payloadWithoutRedaction.isRedacted).toBeUndefined();
    });
  });

  describe("[P1] Redacted Content Handling Patterns", () => {
    test("[2-4-UNIT-005] multiple redacted arguments across turns @p1", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-multi",
          onArgumentComplete,
        })
      );

      const ws = await wsSetup.waitForInstance();
      await act(async () => { ws.simulateOpen(); });

      await act(async () => {
        ws.simulateMessage({
          type: "DEBATE/ARGUMENT_COMPLETE",
          payload: {
            debateId: "test-debate-multi",
            agent: "bull",
            content: "This is [REDACTED] and [REDACTED].",
            turn: 1,
            isRedacted: true,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      await act(async () => {
        ws.simulateMessage({
          type: "DEBATE/ARGUMENT_COMPLETE",
          payload: {
            debateId: "test-debate-multi",
            agent: "bear",
            content: "However, risks are significant.",
            turn: 2,
            isRedacted: false,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledTimes(2);
      expect(onArgumentComplete).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ isRedacted: true, agent: "bull" })
      );
      expect(onArgumentComplete).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ isRedacted: false, agent: "bear" })
      );
    });
  });
});
