import { render, screen } from "@testing-library/react";
import { LiveNowTicker } from "@/features/landing/components/LiveNowTicker";
import { createActiveDebateSummary } from "../factories/landing-factory";

describe("[4.4-UNIT-008] LiveNowTicker", () => {
  it("given an active debate, when the ticker renders, then it shows LIVE badge and asset name", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText(/BTC Bull vs Bear/i)).toBeInTheDocument();
  });

  it("given an active debate with id, when the ticker renders, then it links to the debate detail page", () => {
    const debate = createActiveDebateSummary({ id: "deb_abc", status: "active" });
    render(<LiveNowTicker activeDebate={debate} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/debates/deb_abc");
  });

  it("given a scheduled debate, when the ticker renders, then it shows the scheduled state", () => {
    const debate = createActiveDebateSummary({ status: "scheduled" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.getByText(/No upcoming debates right now/i)).toBeInTheDocument();
  });

  it("given null activeDebate, when the ticker renders, then it shows the empty state", () => {
    render(<LiveNowTicker activeDebate={null} />);
    expect(screen.getByText(/arena is resting/i)).toBeInTheDocument();
  });

  it("given the ticker, when rendered, then it has aria-live='polite' for accessibility", () => {
    const { container } = render(<LiveNowTicker activeDebate={null} />);
    const ticker = container.querySelector("[data-testid='live-now-ticker']");
    expect(ticker).toHaveAttribute("aria-live", "polite");
  });

  it("given the ticker, when rendered, then it has role='status' for accessibility", () => {
    const { container } = render(<LiveNowTicker activeDebate={null} />);
    const ticker = container.querySelector("[data-testid='live-now-ticker']");
    expect(ticker).toHaveAttribute("role", "status");
  });

  it("given an active debate, when the ticker renders, then the live dot has animate-ping", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const ping = container.querySelector(".animate-ping");
    expect(ping).toBeInTheDocument();
  });

  it("given an active debate, when the ticker renders, then interactive elements have min 44px height", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const link = container.querySelector("a");
    expect(link!.className).toContain("min-h-[44px]");
  });
});
