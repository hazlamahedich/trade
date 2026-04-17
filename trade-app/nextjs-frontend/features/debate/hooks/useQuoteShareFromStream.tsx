import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArgumentMessage } from "./useDebateMessages";
import type { QuoteCardData } from "../types/quote-share";
import { useQuoteShare } from "./useQuoteShare";
import { QuoteCardOverlay } from "../components/QuoteCardOverlay";
import type { SnapshotState } from "../types/snapshot";

interface UseQuoteShareFromStreamOptions {
  assetName: string;
  externalId: string;
  snapshotState: SnapshotState;
}

export function useQuoteShareFromStream({
  assetName,
  externalId,
  snapshotState,
}: UseQuoteShareFromStreamOptions) {
  const {
    state: quoteShareState,
    quoteOverlayVisible,
    overlayRef: quoteOverlayRef,
    activeData,
    generate,
  } = useQuoteShare({ assetName, externalId });

  const [activeShareId, setActiveShareId] = useState<string | null>(null);

  useEffect(() => {
    if (quoteShareState === "idle" || quoteShareState === "error" || quoteShareState === "success") {
      if (activeShareId !== null) setActiveShareId(null);
    }
  }, [quoteShareState, activeShareId]);

  const handleShareMessage = useCallback(
    (message: ArgumentMessage) => {
      if (snapshotState === "generating") return;
      if (quoteShareState === "generating" || quoteShareState === "sharing") return;

      const frozen: QuoteCardData = structuredClone({
        agent: message.agent,
        content: message.content,
        timestamp: message.timestamp,
      });

      setActiveShareId(message.id);
      generate(frozen);
    },
    [snapshotState, quoteShareState, generate],
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const debateUrl = siteUrl
    ? `${siteUrl}/debates/${externalId}`
    : undefined;

  const quoteOverlay = useMemo(() => {
    if (!quoteOverlayVisible || !activeData) return null;
    return (
      <QuoteCardOverlay
        overlayRef={quoteOverlayRef}
        agent={activeData.agent}
        content={activeData.content}
        timestamp={activeData.timestamp}
        assetName={assetName}
        debateUrl={debateUrl}
      />
    );
  }, [quoteOverlayVisible, activeData, quoteOverlayRef, assetName, debateUrl]);

  return {
    quoteShareState,
    quoteOverlayVisible,
    quoteOverlayRef,
    activeShareId,
    handleShareMessage,
    quoteOverlay,
  };
}
