import { useRef, useState } from "react";
import { toast } from "sonner";
import { buildShareData, buildDebateShareUrl, isWebShareSupported } from "../utils/share-debate";
import { trackEvent } from "../utils/analytics";

interface UseShareDebateInput {
  assetName: string;
  externalId: string;
  debateStatus?: "active" | "completed";
  source?: "debate_detail" | "debate_stream";
}

export function useShareDebate({ assetName, externalId, debateStatus, source }: UseShareDebateInput) {
  const [isSharing, setIsSharing] = useState(false);
  const isSharingRef = useRef(false);

  async function share(): Promise<void> {
    if (isSharingRef.current) return;
    isSharingRef.current = true;
    setIsSharing(true);

    try {
      const data = buildShareData({ assetName, externalId, debateStatus });
      const url = buildDebateShareUrl(externalId);

      if (isWebShareSupported()) {
        try {
          await navigator.share(data);
          try {
            trackEvent({
              name: "debate_shared",
              properties: { method: "web_share_api", external_id: externalId, source: source ?? "unknown" },
            });
          } catch {
            // analytics isolation — never surface to user
          }
        } catch (err: unknown) {
          const isAbort = err instanceof DOMException && err.name === "AbortError";
          const isNotAllowed = err instanceof DOMException && err.name === "NotAllowedError";
          if (!isAbort && !isNotAllowed) {
            toast.error(`Could not share. Copy this link: ${url}`);
          }
        }
      } else {
        if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("Link copied to clipboard");
            try {
              trackEvent({
                name: "debate_link_copied",
                properties: { external_id: externalId, source: source ?? "unknown" },
              });
            } catch {
              // analytics isolation
            }
          } catch {
            toast.error(`Could not copy link. Copy this link: ${url}`);
          }
        } else {
          toast.error(`Could not copy link. Copy this link: ${url}`);
        }
      }
    } finally {
      isSharingRef.current = false;
      setIsSharing(false);
    }
  }

  return { share, isSharing };
}
