import { render, screen } from "@testing-library/react";
import { LiveNowTicker } from "@/features/landing/components/LiveNowTicker";
import { createActiveDebateSummary } from "../factories/landing-factory";

describe("[4.4-UNIT-008] LiveNowTicker", () => {
  it("renders live state when active debate has status 'active'", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText(/BTC Bull vs Bear/i)).toBeInTheDocument();
  });

  it("links to the active debate detail page", () => {
    const debate = createActiveDebateSummary({ id: "deb_abc", status: "active" });
    render(<LiveNowTicker activeDebate={debate} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/debates/deb_abc");
  });

  it("renders scheduled state when debate has status 'scheduled'", () => {
    const debate = createActiveDebateSummary({ status: "scheduled" });
    render(<LiveNowTicker activeDebate={debate} />);
    expect(screen.getByText(/Next debate scheduled/i)).toBeInTheDocument();
  });

  it("renders empty state when activeDebate is null", () => {
    render(<LiveNowTicker activeDebate={null} />);
    expect(screen.getByText(/arena is resting/i)).toBeInTheDocument();
  });

  it("has aria-live='polite' on the ticker container", () => {
    const { container } = render(<LiveNowTicker activeDebate={null} />);
    const ticker = container.querySelector("[data-testid='live-now-ticker']");
    expect(ticker).toHaveAttribute("aria-live", "polite");
  });

  it("has role='status' on the ticker container", () => {
    const { container } = render(<LiveNowTicker activeDebate={null} />);
    const ticker = container.querySelector("[data-testid='live-now-ticker']");
    expect(ticker).toHaveAttribute("role", "status");
  });

  it("live state has animate-ping on the dot", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const ping = container.querySelector(".animate-ping");
    expect(ping).toBeInTheDocument();
  });

  it("all interactive elements have min 44px height", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const link = container.querySelector("a");
    expect(link!.className).toContain("min-h-[44px]");
  });
});
