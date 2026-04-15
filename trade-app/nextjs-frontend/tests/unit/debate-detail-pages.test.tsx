import { render, screen } from "@testing-library/react";
import DebateDetailError from "@/app/debates/[externalId]/error";
import DebateNotFound from "@/app/debates/[externalId]/not-found";
import DebateDetailLoading from "@/app/debates/[externalId]/loading";
import { permanentRedirect } from "next/navigation";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

jest.mock("next/navigation", () => ({
  permanentRedirect: jest.fn((path: string) => {
    throw new Error(`PERMANENT_REDIRECT:${path}`);
  }),
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("DebateDetailError (error.tsx)", () => {
  it("[P1][4.3-048] given an error, renders 'Something went wrong' heading", () => {
    render(<DebateDetailError error={new Error("test")} reset={jest.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("[P1][4.3-049] given an error, renders 'Try Again' button", () => {
    render(<DebateDetailError error={new Error("test")} reset={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("[P1][4.3-050] given retry button, has 44px minimum touch target", () => {
    render(<DebateDetailError error={new Error("test")} reset={jest.fn()} />);
    const button = screen.getByRole("button", { name: /try again/i });
    expect(button.className).toContain("min-h-[44px]");
  });

  it("[P1][4.3-051] given retry button click, calls reset handler once", () => {
    const reset = jest.fn();
    render(<DebateDetailError error={new Error("test")} reset={reset} />);
    screen.getByRole("button", { name: /try again/i }).click();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("DebateNotFound (not-found.tsx)", () => {
  it("[P1][4.3-052] given non-existent debate, renders 'Debate Not Found' heading", () => {
    render(<DebateNotFound />);
    expect(screen.getByText("Debate Not Found")).toBeInTheDocument();
  });

  it("[P1][4.3-053] given 404 page, renders CTA link to debate history", () => {
    render(<DebateNotFound />);
    const link = screen.getByRole("link", { name: /view debate history/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/dashboard/debates");
  });
});

describe("DebateDetailLoading (loading.tsx)", () => {
  it("[P1][4.3-054] given loading state, renders main with aria-busy='true'", () => {
    const { container } = render(<DebateDetailLoading />);
    const main = container.querySelector("main");
    expect(main?.getAttribute("aria-busy")).toBe("true");
  });

  it("[P1][4.3-055] given loading state, renders main with role='status'", () => {
    const { container } = render(<DebateDetailLoading />);
    const main = container.querySelector("main");
    expect(main?.getAttribute("role")).toBe("status");
  });

  it("[P1][4.3-056] given loading state, renders skeleton pulse placeholders", () => {
    const { container } = render(<DebateDetailLoading />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });
});

describe("LegacyDebateDetailPage (AC-14 redirect)", () => {
  it("[P0][4.3-057] given dashboard debate URL, when page loads, then issues permanentRedirect to /debates/[externalId]", async () => {
    const { default: LegacyPage } = await import(
      "@/app/dashboard/debates/[externalId]/page"
    );

    await expect(
      LegacyPage({
        params: Promise.resolve({ externalId: "deb_abc123" }),
      }),
    ).rejects.toThrow("PERMANENT_REDIRECT:/debates/deb_abc123");

    expect(permanentRedirect).toHaveBeenCalledWith("/debates/deb_abc123");
  });
});
