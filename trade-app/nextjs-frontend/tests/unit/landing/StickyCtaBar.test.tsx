import { render } from "@testing-library/react";
import { act } from "react";
import { StickyCtaBar } from "@/features/landing/components/StickyCtaBar";

function mockIntersectionObserver() {
  const instances: Array<{
    callback: IntersectionObserverCallback;
    observe: jest.Mock;
    disconnect: jest.Mock;
  }> = [];

  const MockIO = jest.fn((callback: IntersectionObserverCallback) => ({
    callback,
    observe: jest.fn(),
    disconnect: jest.fn(),
  }));

  (window.IntersectionObserver as unknown) = MockIO;

  return {
    MockIO,
    getInstances: () => instances,
    getLastInstance: () => {
      const calls = MockIO.mock.results;
      return calls.length > 0 ? calls[calls.length - 1].value : null;
    },
  };
}

describe("[4.4-UNIT-007] StickyCtaBar", () => {
  let io: ReturnType<typeof mockIntersectionObserver>;

  beforeEach(() => {
    io = mockIntersectionObserver();
    const hero = document.createElement("div");
    hero.setAttribute("data-hero-section", "");
    document.body.appendChild(hero);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render when hero is intersecting", () => {
    const { container } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    act(() => {
      instance!.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(container.querySelector("[data-testid='sticky-cta-bar']")).toBeNull();
  });

  it("renders after hero exits viewport via IntersectionObserver", () => {
    const { container } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    act(() => {
      instance!.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(
      container.querySelector("[data-testid='sticky-cta-bar']"),
    ).toBeInTheDocument();
  });

  it("disconnects observer on unmount", () => {
    const { unmount } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    unmount();
    expect(instance!.disconnect).toHaveBeenCalled();
  });

  it("contains link to /debates", () => {
    const { container } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    act(() => {
      instance!.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    const link = container.querySelector("a[href='/debates']");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Enter the Arena");
  });

  it("has mobile-only visibility class (md:hidden)", () => {
    const { container } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    act(() => {
      instance!.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    const bar = container.querySelector("[data-testid='sticky-cta-bar']");
    expect(bar!.className).toContain("md:hidden");
  });
});
