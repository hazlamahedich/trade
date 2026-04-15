import { generateMetadata } from "@/app/page";

describe("[4.4-UNIT-012] generateMetadata", () => {
  it("given generateMetadata, when called, then it returns a title containing 'AI Trading Debate'", () => {
    const meta = generateMetadata();
    expect(meta.title).toContain("AI Trading Debate");
  });

  it("given generateMetadata, when called, then it returns a non-empty description", () => {
    const meta = generateMetadata();
    expect(typeof meta.description).toBe("string");
    expect((meta.description as string).length).toBeGreaterThan(10);
  });

  it("given generateMetadata, when called, then it includes openGraph metadata with type website", () => {
    const meta = generateMetadata();
    expect(meta.openGraph).toBeDefined();
    expect(meta.openGraph!.type).toBe("website");
    expect(meta.openGraph!.title).toBe(meta.title);
  });

  it("given generateMetadata, when called, then it includes openGraph images with og-default.png", () => {
    const meta = generateMetadata();
    expect(meta.openGraph!.images).toBeDefined();
    const images = meta.openGraph!.images as Array<{ url: string }>;
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].url).toContain("og-default.png");
  });

  it("given generateMetadata, when called, then it includes twitter card metadata", () => {
    const meta = generateMetadata();
    expect(meta.twitter).toBeDefined();
    expect(meta.twitter!.card).toBe("summary_large_image");
  });

  it("given generateMetadata, when called, then it includes twitter images with og-default.png", () => {
    const meta = generateMetadata();
    expect(meta.twitter!.images).toBeDefined();
    const images = meta.twitter!.images as string[];
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toContain("og-default.png");
  });
});
