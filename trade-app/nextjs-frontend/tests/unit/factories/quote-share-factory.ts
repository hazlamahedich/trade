
import type { QuoteCardData } from "../../../features/debate/types/quote-share";

if (typeof globalThis.SVGImageElement === "undefined") {
  (globalThis as Record<string, unknown>).SVGImageElement = class SVGImageElement extends HTMLElement {};
}

let _counter = 0;

export function resetQuoteFactoryCounter() {
  _counter = 0;
}

export function makeQuoteCardData(overrides: Partial<QuoteCardData> = {}): QuoteCardData {
  _counter++;
  return {
    agent: "bull",
    content: `This is test argument #${_counter} about market trends`,
    timestamp: "2026-04-16T12:00:00.000Z",
    ...overrides,
  };
}
