
import type { ArgumentMessage, SnapshotInput } from "../../../features/debate/types/snapshot";

if (typeof globalThis.SVGImageElement === "undefined") {
  (globalThis as Record<string, unknown>).SVGImageElement = class SVGImageElement extends HTMLElement {};
}

let _idCounter = 0;

export function resetFactoryCounter() {
  _idCounter = 0;
}

export function makeMessage(overrides: Partial<ArgumentMessage> = {}): ArgumentMessage {
  return {
    id: `msg-${++_idCounter}`,
    type: "argument",
    agent: "bull",
    content: "Test argument content",
    timestamp: "2026-04-16T12:00:00.000Z",
    ...overrides,
  };
}

export function makeSnapshotInput(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    debateId: "debate-1",
    assetName: "BTC/USDT",
    externalId: "ext-1",
    messages: [makeMessage(), makeMessage({ agent: "bear", id: "msg-auto" })],
    voteData: { bullVotes: 5, bearVotes: 3 },
    ...overrides,
  };
}
