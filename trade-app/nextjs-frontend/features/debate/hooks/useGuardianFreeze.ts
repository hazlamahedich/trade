"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { GuardianInterruptPayload } from "./useDebateSocket";
import type { ArgumentMessage } from "../components/DebateStream";

export type GuardianFreezeState =
  | { status: "active" }
  | { status: "frozen"; data: GuardianInterruptPayload; triggerArg: ArgumentMessage | null }
  | { status: "error"; data: GuardianInterruptPayload; triggerArg: ArgumentMessage | null; error: string };

type GuardianFreezeAction =
  | { type: "TRIGGER_FREEZE"; payload: GuardianInterruptPayload; triggerArg: ArgumentMessage | null }
  | { type: "ACKNOWLEDGE_SUCCESS" }
  | { type: "ACKNOWLEDGE_ERROR"; error: string }
  | { type: "CLEAR" };

const COOLDOWN_MS = 5000;

function freezeReducer(state: GuardianFreezeState, action: GuardianFreezeAction): GuardianFreezeState {
  switch (action.type) {
    case "TRIGGER_FREEZE":
      return {
        status: "frozen",
        data: action.payload,
        triggerArg: action.triggerArg,
      };
    case "ACKNOWLEDGE_SUCCESS":
    case "CLEAR":
      return { status: "active" };
    case "ACKNOWLEDGE_ERROR":
      if (state.status === "frozen" || state.status === "error") {
        return {
          status: "error",
          data: state.data,
          triggerArg: state.triggerArg,
          error: action.error,
        };
      }
      return state;
    default:
      return state;
  }
}

interface QueuedInterrupt {
  payload: GuardianInterruptPayload;
  triggerArg: ArgumentMessage | null;
}

interface UseGuardianFreezeOptions {
  sendGuardianAck: () => boolean;
  onDebateResumed?: (() => void) | undefined;
}

export function useGuardianFreeze({ sendGuardianAck, onDebateResumed }: UseGuardianFreezeOptions) {
  const [state, dispatch] = useReducer(freezeReducer, { status: "active" } as GuardianFreezeState);
  const lastFreezeTime = useRef<number>(0);
  const queuedInterrupt = useRef<QueuedInterrupt | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<GuardianFreezeState["status"]>("active");

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearTimeout(cooldownTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.status === "active" && queuedInterrupt.current) {
      const queued = queuedInterrupt.current;
      queuedInterrupt.current = null;
      dispatch({ type: "TRIGGER_FREEZE", payload: queued.payload, triggerArg: queued.triggerArg });
      lastFreezeTime.current = Date.now();
      scheduleCooldown();
    }
  }, [state.status]);

  const scheduleCooldown = useCallback(() => {
    if (cooldownTimer.current) {
      clearTimeout(cooldownTimer.current);
    }
    cooldownTimer.current = setTimeout(() => {
      cooldownTimer.current = null;
    }, COOLDOWN_MS);
  }, []);

  const triggerFreeze = useCallback(
    (payload: GuardianInterruptPayload, triggerArg: ArgumentMessage | null) => {
      const now = Date.now();
      const currentStatus = statusRef.current;
      if ((currentStatus === "frozen" || currentStatus === "error") && now - lastFreezeTime.current < COOLDOWN_MS) {
        queuedInterrupt.current = { payload, triggerArg };
        return;
      }
      dispatch({ type: "TRIGGER_FREEZE", payload, triggerArg });
      lastFreezeTime.current = now;
      scheduleCooldown();
    },
    [scheduleCooldown]
  );

  const sendAndAcknowledge = useCallback(() => {
    const sent = sendGuardianAck();
    if (sent) {
      dispatch({ type: "ACKNOWLEDGE_SUCCESS" });
    } else {
      dispatch({ type: "ACKNOWLEDGE_ERROR", error: "Failed to send acknowledgment — WebSocket not connected" });
    }
  }, [sendGuardianAck]);

  const acknowledgeFreeze = useCallback(() => {
    sendAndAcknowledge();
  }, [sendAndAcknowledge]);

  const ignoreFreeze = useCallback(() => {
    sendAndAcknowledge();
  }, [sendAndAcknowledge]);

  const retryAck = useCallback(() => {
    sendAndAcknowledge();
  }, [sendAndAcknowledge]);

  const clearFreeze = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const handleDebateResumed = useCallback(() => {
    dispatch({ type: "CLEAR" });
    onDebateResumed?.();
  }, [onDebateResumed]);

  const isFrozen = state.status !== "active";

  const currentData =
    state.status === "frozen" || state.status === "error"
      ? { data: state.data, triggerArg: state.triggerArg }
      : null;

  return {
    state,
    isFrozen,
    triggerFreeze,
    acknowledgeFreeze,
    ignoreFreeze,
    retryAck,
    clearFreeze,
    handleDebateResumed,
    currentData,
  };
}
