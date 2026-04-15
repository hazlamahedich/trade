import { render, screen } from "@testing-library/react";
import { RecentDebatesSection } from "@/features/landing/components/RecentDebatesSection";
import { createRecentDebatePreview } from "../factories/landing-factory";

describe("[4.4-UNIT-004] RecentDebatesSection", () => {
  it("given debates data, when the section renders, then it shows debate asset names", () => {
    const debates = [
      createRecentDebatePreview({ asset: "btc", winner: "bull" }),
      createRecentDebatePreview({ asset: "eth", winner: "bear", externalId: "deb_hist002" }),
    ];
    render(<RecentDebatesSection debates={debates} />);
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
  });

  it("given an empty debates array, when the section renders, then it renders nothing", () => {
    const { container } = render(<RecentDebatesSection debates={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("given debates data, when the section renders, then it has an accessible h2 heading", () => {
    const debates = [createRecentDebatePreview()];
    render(<RecentDebatesSection debates={debates} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /recent debates/i }),
    ).toBeInTheDocument();
  });
});
