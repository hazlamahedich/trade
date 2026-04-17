import { buildShareData, buildDebateShareUrl, isWebShareSupported } from "../../features/debate/utils/share-debate";

describe("[P0][5.4-utils] share debate utilities", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  describe("buildDebateShareUrl", () => {
    it("uses NEXT_PUBLIC_SITE_URL when set", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://myapp.com";
      const url = buildDebateShareUrl("ext-123");
      expect(url).toBe("https://myapp.com/debates/ext-123");
    });

    it("falls back to window.location.origin when env is empty string", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "";
      const url = buildDebateShareUrl("ext-123");
      expect(url).toContain("/debates/ext-123");
    });

    it("falls back to window.location.origin when env is undefined", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      const url = buildDebateShareUrl("ext-123");
      expect(url).toContain("/debates/ext-123");
    });

    it("encodes special chars in externalId", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://myapp.com";
      const url = buildDebateShareUrl("ext-with special?chars");
      expect(url).toBe("https://myapp.com/debates/ext-with%20special%3Fchars");
    });

    it("handles dashes and underscores without encoding", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://myapp.com";
      const url = buildDebateShareUrl("ext-with-dashes_and_underscores");
      expect(url).toBe("https://myapp.com/debates/ext-with-dashes_and_underscores");
    });
  });

  describe("buildShareData", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://myapp.com";
    });

    it("returns correct structure", () => {
      const result = buildShareData({ assetName: "BTC", externalId: "ext-1" });
      expect(result).toEqual({
        title: "Bull vs Bear on BTC — AI Trading Debate Lab",
        text: "Check out this AI debate on BTC",
        url: "https://myapp.com/debates/ext-1",
      });
    });

    it("uses active text for debateStatus=active", () => {
      const result = buildShareData({ assetName: "ETH", externalId: "ext-2", debateStatus: "active" });
      expect(result.text).toBe("Watch AI agents debate ETH live");
    });

    it("uses active text for debateStatus=running (backend compatibility)", () => {
      const result = buildShareData({ assetName: "ETH", externalId: "ext-2b", debateStatus: "running" as "active" });
      expect(result.text).toBe("Watch AI agents debate ETH live");
    });

    it("uses completed text for debateStatus=completed", () => {
      const result = buildShareData({ assetName: "SOL", externalId: "ext-3", debateStatus: "completed" });
      expect(result.text).toBe("See how Bull & Bear argued on SOL");
    });

    it("uses default text when no debateStatus", () => {
      const result = buildShareData({ assetName: "DOGE", externalId: "ext-4" });
      expect(result.text).toBe("Check out this AI debate on DOGE");
    });

    it("handles Unicode asset names", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://myapp.com";
      const result = buildShareData({ assetName: "BTC/¥€$", externalId: "ext-5" });
      expect(result.title).toBe("Bull vs Bear on BTC/¥€$ — AI Trading Debate Lab");
      expect(result.url).toBe("https://myapp.com/debates/ext-5");
    });
  });

  describe("isWebShareSupported", () => {
    const originalNavigator = globalThis.navigator;

    afterEach(() => {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it("returns true when navigator.share exists", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { share: jest.fn() },
        writable: true,
        configurable: true,
      });
      expect(isWebShareSupported()).toBe(true);
    });

    it("returns false when navigator.share is missing", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });
      expect(isWebShareSupported()).toBe(false);
    });

    it("returns false when navigator is undefined (SSR)", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isWebShareSupported()).toBe(false);
    });
  });
});
