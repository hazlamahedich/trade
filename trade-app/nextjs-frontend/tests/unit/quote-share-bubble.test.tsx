import { render, screen, fireEvent } from "@testing-library/react";
import { jest } from "@jest/globals";
import { ArgumentBubble } from "../../features/debate/components/ArgumentBubble";
import { TooltipProvider } from "@/components/ui/tooltip";

jest.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  },
}));

function renderBubble(props: Partial<Parameters<typeof ArgumentBubble>[0]> = {}) {
  return render(
    <TooltipProvider>
      <ArgumentBubble
        agent="bull"
        content="Test argument"
        timestamp={new Date().toISOString()}
        {...props}
      />
    </TooltipProvider>,
  );
}

describe("[P0][5.3-bubble] ArgumentBubble — share integration", () => {
  it("renders ShareButton when onShare is provided", () => {
    renderBubble({ onShare: jest.fn() });
    expect(screen.getByTestId("share-button")).toBeInTheDocument();
  });

  it("does NOT render ShareButton when onShare is undefined", () => {
    renderBubble();
    expect(screen.queryByTestId("share-button")).not.toBeInTheDocument();
  });

  it("does NOT render ShareButton when isStreaming=true", () => {
    renderBubble({ onShare: jest.fn(), isStreaming: true });
    expect(screen.queryByTestId("share-button")).not.toBeInTheDocument();
  });

  it("does NOT render ShareButton when isRedacted=true", () => {
    renderBubble({ onShare: jest.fn(), isRedacted: true });
    expect(screen.queryByTestId("share-button")).not.toBeInTheDocument();
  });

  it("fires onShare when S key pressed on focused bubble", () => {
    const onShare = jest.fn();
    renderBubble({ onShare });
    const bubble = screen.getByTestId("argument-bubble");
    fireEvent.keyDown(bubble, { key: "s" });
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onShare when S key pressed inside input", () => {
    const onShare = jest.fn();
    renderBubble({ onShare });
    const bubble = screen.getByTestId("argument-bubble");
    const input = document.createElement("input");
    bubble.appendChild(input);
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "s" });
    expect(onShare).not.toHaveBeenCalled();
  });

  it("does NOT fire onShare when S key pressed inside textarea", () => {
    const onShare = jest.fn();
    renderBubble({ onShare });
    const bubble = screen.getByTestId("argument-bubble");
    const textarea = document.createElement("textarea");
    bubble.appendChild(textarea);
    fireEvent.focus(textarea);
    fireEvent.keyDown(textarea, { key: "s" });
    expect(onShare).not.toHaveBeenCalled();
  });

  it("fires onShare when ShareButton is clicked", () => {
    const onShare = jest.fn();
    renderBubble({ onShare });
    const btn = screen.getByTestId("share-button");
    fireEvent.click(btn);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("passes shareState to ShareButton", () => {
    renderBubble({ onShare: jest.fn(), shareState: "generating" });
    const btn = screen.getByTestId("share-button");
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("ShareButton has group-hover opacity class on desktop", () => {
    const { container } = renderBubble({ onShare: jest.fn() });
    const wrapper = container.querySelector(".sm\\:opacity-0");
    expect(wrapper).toBeInTheDocument();
  });

  it("uses roving tabindex — tabIndex=-1 when not focused", () => {
    renderBubble({ onShare: jest.fn(), isFocused: false });
    const bubble = screen.getByTestId("argument-bubble");
    expect(bubble.getAttribute("tabindex")).toBe("-1");
  });

  it("uses roving tabindex — tabIndex=0 when focused", () => {
    renderBubble({ onShare: jest.fn(), isFocused: true });
    const bubble = screen.getByTestId("argument-bubble");
    expect(bubble.getAttribute("tabindex")).toBe("0");
  });

  it("calls onFocusRequest on focus", () => {
    const onFocusRequest = jest.fn();
    renderBubble({ onFocusRequest });
    const bubble = screen.getByTestId("argument-bubble");
    fireEvent.focus(bubble);
    expect(onFocusRequest).toHaveBeenCalledTimes(1);
  });
});
