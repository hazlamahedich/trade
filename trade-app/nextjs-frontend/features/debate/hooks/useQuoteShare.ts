import { useCallback, useEffect, useRef, useState } from "react";
import type { QuoteCardData, QuoteShareState } from "../types/quote-share";
import { captureSnapshot } from "../utils/snapshot";
import {
  buildQuoteShareFilename,
  buildTweetIntentUrl,
  buildTweetText,
} from "../utils/quote-share";
import { toast } from "sonner";

const CAPTURE_TIMEOUT_MS = 10_000;
const REVOKE_DELAY_MS = 1_000;
const RENDER_SETTLE_MS = 200;

interface UseQuoteShareOptions {
  assetName: string;
  externalId: string;
}

function cleanup(
  timeoutId: ReturnType<typeof setTimeout> | null,
  isGeneratingRef: React.MutableRefObject<boolean>,
  setQuoteOverlayVisible: (v: boolean) => void,
  objectUrl: string | null,
  revokeTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
) {
  if (timeoutId !== null) clearTimeout(timeoutId);
  isGeneratingRef.current = false;
  setQuoteOverlayVisible(false);
  if (objectUrl) {
    revokeTimerRef.current = setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      REVOKE_DELAY_MS,
    );
  }
}

export function useQuoteShare({ assetName, externalId }: UseQuoteShareOptions) {
  const [state, setState] = useState<QuoteShareState>("idle");
  const [quoteOverlayVisible, setQuoteOverlayVisible] = useState(false);
  const [activeData, setActiveData] = useState<QuoteCardData | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const isGeneratingRef = useRef(false);
  const cancelledRef = useRef(false);
  const revokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (revokeTimerRef.current) clearTimeout(revokeTimerRef.current);
    };
  }, []);

  const generate = useCallback(
    async (data: QuoteCardData) => {
      if (isGeneratingRef.current) return;
      isGeneratingRef.current = true;
      cancelledRef.current = false;
      setState("generating");
      setActiveData(data);
      setQuoteOverlayVisible(true);

      let objectUrl: string | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelledRef.current) {
          cleanup(timeoutId, isGeneratingRef, setQuoteOverlayVisible, objectUrl, revokeTimerRef);
          return;
        }

        const overlay = overlayRef.current;
        if (!overlay) {
          throw new Error("Quote card overlay not mounted");
        }

        await document.fonts.ready.catch(() => undefined);
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        await new Promise((resolve) => setTimeout(resolve, RENDER_SETTLE_MS));

        if (cancelledRef.current) {
          cleanup(timeoutId, isGeneratingRef, setQuoteOverlayVisible, objectUrl, revokeTimerRef);
          return;
        }

        const capturePromise = captureSnapshot(overlay);
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Quote card generation timed out")),
            CAPTURE_TIMEOUT_MS,
          );
        });

        const blob = await Promise.race([capturePromise, timeoutPromise]);
        if (cancelledRef.current) {
          cleanup(timeoutId, isGeneratingRef, setQuoteOverlayVisible, objectUrl, revokeTimerRef);
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        const filename = buildQuoteShareFilename(data.agent, assetName);
        const file = new File([blob], filename, { type: "image/png" });

        let canShare = false;
        try {
          canShare =
            typeof navigator !== "undefined" &&
            typeof navigator.share === "function" &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [file] });
        } catch {
          canShare = false;
        }

        if (canShare) {
          try {
            setState("sharing");
            await navigator.share({
              files: [file],
              title: `${data.agent === "bull" ? "Bull" : "Bear"} take on ${assetName}`,
            });
            if (!cancelledRef.current) {
              setState("success");
              toast.success("Zinger captured!");
            }
          } catch (err: unknown) {
            const isAbort =
              err instanceof DOMException && err.name === "AbortError";
            const isNotAllowed =
              err instanceof DOMException && err.name === "NotAllowedError";
            if (isAbort || isNotAllowed) {
              if (!cancelledRef.current) setState("idle");
              return;
            }
            throw err;
          }
        } else {
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();

          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
          if (siteUrl) {
            const debateUrl = `${siteUrl}/debates/${externalId}`;
            const tweetText = buildTweetText(data.agent, assetName);
            const intentUrl = buildTweetIntentUrl({
              text: tweetText,
              url: debateUrl,
            });

            try {
              const win = window.open(intentUrl, "_blank", "noopener,noreferrer");
              if (!win) {
                toast.info("Tweet link ready", {
                  description: debateUrl,
                });
              }
            } catch {
              toast.info("Tweet link ready", {
                description: debateUrl,
              });
            }
          }

          if (!cancelledRef.current) {
            setState("success");
            toast.success("Zinger captured!");
          }
        }
      } catch {
        if (!cancelledRef.current) {
          setState("error");
          toast.error("Could not generate quote card. Please try again.");
        }
      } finally {
        cleanup(timeoutId, isGeneratingRef, setQuoteOverlayVisible, objectUrl, revokeTimerRef);
      }
    },
    [assetName, externalId],
  );

  const resetState = useCallback(() => {
    setState("idle");
  }, []);

  return {
    state,
    quoteOverlayVisible,
    overlayRef,
    activeData,
    generate,
    resetState,
  };
}
