import { render } from "@testing-library/react";
import { act } from "react";
import { StickyCtaBar } from "@/features/landing/components/StickyCtaBar";
import { createIntersectionObserverFixture } from "../fixtures/intersection-observer";

describe("[4.4-UNIT-007] StickyCtaBar", () => {
  let io: ReturnType<typeof createIntersectionObserverFixture>;

  beforeEach(() => {
    io = createIntersectionObserverFixture();
    const hero = document.createElement("div");
    hero.setAttribute("data-hero-section", "");
    document.body.appendChild(hero);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("given hero is intersecting, when StickyCtaBar renders, then it does not appear", () => {
    const { container } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    act(() => {
      instance!.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(container.querySelector("[data-testid='sticky-cta-bar']")).toBeNull();
  });

  it("given hero exits viewport, when IntersectionObserver fires, then the sticky bar appears", () => {
    const { container } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    act(() => {
      instance!.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(
      container.querySelector("[data-testid='sticky-cta-bar']"),
    ).toBeInTheDocument();
  });

  it("given the bar is rendered, when it unmounts, then the observer is disconnected", () => {
    const { unmount } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    unmount();
    expect(instance!.disconnect).toHaveBeenCalled();
  });

  it("given hero exits viewport, when the bar appears, then it contains a link to /debates with 'Enter the Arena' text", () => {
    const { container } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    act(() => {
      instance!.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    const link = container.querySelector("a[href='/debates']");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Enter the Arena");
  });

  it("given hero exits viewport, when the bar appears, then it has mobile-only visibility class (md:hidden)", () => {
    const { container } = render(<StickyCtaBar />);
    const instance = io.getLastInstance();
    act(() => {
      instance!.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    const bar = container.querySelector("[data-testid='sticky-cta-bar']");
    expect(bar!.className).toContain("md:hidden");
  });
});
