import type { RefObject } from "react";
import type { QuoteCardData } from "../types/quote-share";
import { QuoteCardTemplate } from "./QuoteCardTemplate";

interface QuoteCardOverlayProps extends QuoteCardData {
  overlayRef: RefObject<HTMLDivElement | null>;
  assetName: string;
  debateUrl?: string;
}

export function QuoteCardOverlay({
  overlayRef,
  agent,
  content,
  assetName,
  debateUrl,
}: QuoteCardOverlayProps) {
  return (
    <div
      ref={overlayRef}
      data-testid="quote-card-overlay"
      aria-hidden="true"
      role="presentation"
      style={{
        position: "fixed",
        left: -9999,
        top: 0,
        visibility: "visible",
        display: "block",
        width: 600,
        overflow: "hidden",
      }}
    >
      <QuoteCardTemplate
        agent={agent}
        content={content}
        assetName={assetName}
        debateUrl={debateUrl}
      />
    </div>
  );
}
