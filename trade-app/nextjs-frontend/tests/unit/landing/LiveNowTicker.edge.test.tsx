import { render, screen, fireEvent } from "@testing-library/react";
import { LiveNowTicker } from "@/features/landing/components/LiveNowTicker";
import { createActiveDebateSummary } from "../factories/landing-factory";

describe("[4.4-UNIT-008-EDGE] LiveNowTicker edge cases", () => {
  it("given a debate with unknown status, when the ticker renders, then it falls back to empty state", () => {
    const debate = createActiveDebateSummary({ status: "completed" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.getByText(/arena is resting/i)).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });

  it("given null activeDebate, when the ticker renders, then it links to /debates with CTA text", () => {
    render(<LiveNowTicker activeDebate={null} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/debates");
    expect(link).toHaveTextContent(/start the first debate/i);
  });

  it("given an active debate, when the ticker renders, then it does not show scheduled or empty content", () => {
    const debate = createActiveDebateSummary({ status: "active", asset: "sol" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.queryByText(/Next debate scheduled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/arena is resting/i)).not.toBeInTheDocument();
  });

  it("given a scheduled debate, when the ticker renders, then it does not show live or empty content", () => {
    const debate = createActiveDebateSummary({ status: "scheduled" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.queryByText(/arena is resting/i)).not.toBeInTheDocument();
  });

  it("given an active debate with lowercase asset, when the ticker renders, then it shows the asset name in uppercase", () => {
    const debate = createActiveDebateSummary({ status: "active", asset: "eth" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.getByText(/ETH Bull vs Bear/i)).toBeInTheDocument();
  });

  it("given an active debate, when the ticker renders, then the live dot has aria-hidden (dual-coding rule)", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const dotWrapper = container.querySelector("span[aria-hidden='true']");
    expect(dotWrapper).toBeInTheDocument();
  });

  it("given null activeDebate, when the ticker renders, then the empty state link has min-h-[44px]", () => {
    const { container } = render(<LiveNowTicker activeDebate={null} />);
    const link = container.querySelector("a");
    expect(link!.className).toContain("min-h-[44px]");
  });

  it("given a scheduled debate, when the ticker renders, then it has min-h-[44px] for touch targets", () => {
    const debate = createActiveDebateSummary({ status: "scheduled" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const scheduledBox = container.querySelector(".min-h-\\[44px\\]");
    expect(scheduledBox).toBeInTheDocument();
  });

  it("given the ticker, when rendered in any state, then the container has flex and justify-center classes", () => {
    const { container } = render(<LiveNowTicker activeDebate={null} />);
    const ticker = container.querySelector("[data-testid='live-now-ticker']");
    expect(ticker!.className).toContain("flex");
    expect(ticker!.className).toContain("justify-center");
  });
});


