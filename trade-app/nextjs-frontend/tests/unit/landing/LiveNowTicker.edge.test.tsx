import { render, screen, fireEvent } from "@testing-library/react";
import { LiveNowTicker } from "@/features/landing/components/LiveNowTicker";
import { createActiveDebateSummary } from "../factories/landing-factory";

describe("[4.4-UNIT-008-EDGE] LiveNowTicker edge cases", () => {
  it("treats unknown status as empty state", () => {
    const debate = createActiveDebateSummary({ status: "completed" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.getByText(/arena is resting/i)).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });

  it("empty state links to /debates with CTA text", () => {
    render(<LiveNowTicker activeDebate={null} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/debates");
    expect(link).toHaveTextContent(/start the first debate/i);
  });

  it("live state does not render scheduled or empty content", () => {
    const debate = createActiveDebateSummary({ status: "active", asset: "sol" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.queryByText(/Next debate scheduled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/arena is resting/i)).not.toBeInTheDocument();
  });

  it("scheduled state does not render live or empty content", () => {
    const debate = createRecentDebateSummary({ status: "scheduled" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.queryByText(/arena is resting/i)).not.toBeInTheDocument();
  });

  it("live state shows asset name in uppercase", () => {
    const debate = createActiveDebateSummary({ status: "active", asset: "eth" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.getByText(/ETH Bull vs Bear/i)).toBeInTheDocument();
  });

  it("live dot has aria-hidden (decorative, dual-coding rule)", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const dotWrapper = container.querySelector("span[aria-hidden='true']");
    expect(dotWrapper).toBeInTheDocument();
  });

  it("empty state has min-h-[44px] for touch targets", () => {
    const { container } = render(<LiveNowTicker activeDebate={null} />);
    const link = container.querySelector("a");
    expect(link!.className).toContain("min-h-[44px]");
  });

  it("scheduled state has min-h-[44px] for touch targets", () => {
    const debate = createActiveDebateSummary({ status: "scheduled" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const scheduledBox = container.querySelector(".min-h-\\[44px\\]");
    expect(scheduledBox).toBeInTheDocument();
  });

  it("ticker container has correct base classes", () => {
    const { container } = render(<LiveNowTicker activeDebate={null} />);
    const ticker = container.querySelector("[data-testid='live-now-ticker']");
    expect(ticker!.className).toContain("flex");
    expect(ticker!.className).toContain("justify-center");
  });
});

function createRecentDebateSummary(overrides: Partial<{ status: string }> = {}) {
  return createActiveDebateSummary({ ...overrides });
}
