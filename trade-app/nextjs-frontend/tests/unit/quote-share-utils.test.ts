import { jest } from "@jest/globals";
import { makeQuoteCardData } from "./factories/quote-share-factory";

const {
  buildTweetIntentUrl,
  buildQuoteShareFilename,
  buildTweetText,
  validateTweetLength,
} = require("../../features/debate/utils/quote-share");

const { truncateUnicode } = require("../../features/debate/utils/truncate");

describe("[P0][5.3-utils] quote share utilities", () => {
  describe("buildTweetIntentUrl", () => {
    it("constructs valid Twitter intent URL", () => {
      const url = buildTweetIntentUrl({
        text: "Check out this Bull take on BTC",
        url: "https://example.com/debates/ext-1",
      });
      expect(url).toContain("https://twitter.com/intent/tweet");
      expect(url).toContain("text=");
      expect(url).toContain("url=");
    });

    it("handles special characters in text", () => {
      const url = buildTweetIntentUrl({
        text: "Bull says: \"BTC is great!\" & <strong>",
        url: "https://example.com/debates/1",
      });
      expect(url).toContain("text=");
    });

    it("handles Unicode content", () => {
      const url = buildTweetIntentUrl({
        text: "火🔥 BTC rocket 🚀",
        url: "https://example.com/d/1",
      });
      expect(url).toContain("text=");
    });

    it("includes hashtag by default", () => {
      const url = buildTweetIntentUrl({
        text: "test",
        url: "https://example.com/d/1",
      });
      expect(url).toContain("hashtags=AITradingDebate");
    });
  });

  describe("buildQuoteShareFilename", () => {
    it("returns correct filename format", () => {
      const name = buildQuoteShareFilename("bull", "BTC/USDT");
      expect(name).toMatch(/^quote-bull-btc-usdt-.*\.png$/);
    });

    it("sanitizes special characters", () => {
      const name = buildQuoteShareFilename("bear", "ETH-USD!!!");
      expect(name).toMatch(/^quote-bear-eth-usd.*\.png$/);
    });
  });

  describe("buildTweetText", () => {
    it("builds correct tweet text", () => {
      const text = buildTweetText("bull", "BTC/USDT", "https://example.com/d/1");
      expect(text).toContain("Bull");
      expect(text).toContain("BTC/USDT");
      expect(text).toContain("#AITradingDebate");
    });

    it("capitalizes agent name", () => {
      const text = buildTweetText("bear", "ETH", "https://example.com/d/1");
      expect(text).toContain("Bear");
    });

    it("truncates long asset names", () => {
      const text = buildTweetText("bull", "A".repeat(20), "https://example.com/d/1");
      expect(Array.from(text).length).toBeLessThan(280);
    });
  });

  describe("validateTweetLength", () => {
    it("returns text unchanged when under 280", () => {
      const text = "Short text";
      expect(validateTweetLength(text)).toBe(text);
    });

    it("truncates long text to fit", () => {
      const text = "A".repeat(300);
      const result = validateTweetLength(text);
      expect(Array.from(result).length).toBeLessThanOrEqual(256);
      expect(result).toContain("…");
    });

    it("handles empty text", () => {
      expect(validateTweetLength("")).toBe("");
    });
  });

  describe("truncateUnicode", () => {
    it("returns string unchanged when under limit", () => {
      expect(truncateUnicode("hello", 10)).toBe("hello");
    });

    it("truncates at exact limit", () => {
      expect(truncateUnicode("hello", 5)).toBe("hello");
    });

    it("truncates and adds ellipsis", () => {
      expect(truncateUnicode("hello world", 5)).toBe("hello…");
    });

    it("handles multi-byte emoji correctly", () => {
      expect(truncateUnicode("🔥🚀💰🎉", 2)).toBe("🔥🚀…");
    });

    it("handles mixed content", () => {
      expect(truncateUnicode("hello 🔥 world", 8)).toBe("hello 🔥 …");
    });

    it("handles empty string", () => {
      expect(truncateUnicode("", 5)).toBe("");
    });
  });
});
