import { trackEvent } from "@/features/debate/utils/analytics";

const originalWindow = global.window;
const originalEnv = process.env.NODE_ENV;

describe("trackEvent (analytics stub)", () => {
  const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

  afterEach(() => {
    consoleLogSpy.mockClear();
    process.env.NODE_ENV = originalEnv;
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    global.window = originalWindow;
  });

  it("[P2][4.3-062] given trackEvent call in development, logs to console", () => {
    process.env.NODE_ENV = "development";
    trackEvent({ name: "debate_detail_page_viewed", properties: { external_id: "test-123" } });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[Analytics]",
      "debate_detail_page_viewed",
      { external_id: "test-123" },
    );
  });

  it("[P2][4.3-063] given trackEvent with no properties, logs event name only", () => {
    process.env.NODE_ENV = "development";
    trackEvent({ name: "debate_detail_cta_clicked" });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[Analytics]",
      "debate_detail_cta_clicked",
      undefined,
    );
  });

  it("[P2][4.3-064] given trackEvent in production, does not log to console", () => {
    process.env.NODE_ENV = "production";
    trackEvent({ name: "debate_detail_page_viewed" });

    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      "[Analytics]",
      expect.anything(),
      expect.anything(),
    );
  });

  it("[P2][4.3-065] given trackEvent without window (SSR), returns early without error", () => {
    const savedWindow = global.window;
    Object.defineProperty(global, "window", {
      value: undefined,
      writable: true,
    });

    expect(() =>
      trackEvent({ name: "debate_detail_page_viewed" }),
    ).not.toThrow();

    Object.defineProperty(global, "window", {
      value: savedWindow,
      writable: true,
    });
  });
});
