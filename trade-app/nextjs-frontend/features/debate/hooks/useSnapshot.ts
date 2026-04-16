import { useCallback, useEffect, useRef, useState } from "react";
import type { SnapshotInput, SnapshotState } from "../types/snapshot";
import { captureSnapshot, slug } from "../utils/snapshot";

const CAPTURE_TIMEOUT_MS = 10_000;
const REVOKE_DELAY_MS = 1_000;
const RENDER_SETTLE_MS = 200;
const SNAPSHOT_HIDDEN_STATUSES = new Set(["idle", "error"]);

export { SNAPSHOT_HIDDEN_STATUSES, CAPTURE_TIMEOUT_MS };

export function useSnapshot(input: SnapshotInput) {
  const [state, setState] = useState<SnapshotState>("idle");
  const [overlayVisible, setOverlayVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const isGeneratingRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const generateSnapshot = useCallback(async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    cancelledRef.current = false;
    setState("generating");
    setOverlayVisible(true);

    let objectUrl: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (cancelledRef.current) return;

      const overlay = overlayRef.current;
      if (!overlay) {
        throw new Error("Snapshot overlay not mounted");
      }

      await document.fonts.ready.catch(() => undefined);

      const images = overlay.querySelectorAll("img");
      if (images.length > 0) {
        await Promise.all(
          Array.from(images).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((r) => {
                  img.onload = () => r();
                  img.onerror = () => r();
                }),
          ),
        );
      }

      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise((resolve) => setTimeout(resolve, RENDER_SETTLE_MS));

      if (cancelledRef.current) return;

      const capturePromise = captureSnapshot(overlay);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Snapshot generation timed out")),
          CAPTURE_TIMEOUT_MS,
        );
      });

      const blob = await Promise.race([capturePromise, timeoutPromise]);

      if (cancelledRef.current) return;

      objectUrl = URL.createObjectURL(blob);
      const file = new File([blob], "debate.png", { type: "image/png" });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `debate-${slug(input.assetName)}-${timestamp}.png`;

      const canShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShare) {
        try {
          await navigator.share({
            files: [file],
            title: `Debate: ${input.assetName}`,
          });
        } catch (err: unknown) {
          const isAbort = err instanceof DOMException && err.name === "AbortError";
          const isNotAllowed = err instanceof DOMException && err.name === "NotAllowedError";
          if (!isAbort && !isNotAllowed) {
            throw err;
          }
        }
      } else {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      if (!cancelledRef.current) {
        setState("idle");
      }
    } catch {
      if (!cancelledRef.current) {
        setState("error");
      }
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
      isGeneratingRef.current = false;
      setOverlayVisible(false);
      if (objectUrl) {
        setTimeout(() => URL.revokeObjectURL(objectUrl!), REVOKE_DELAY_MS);
      }
    }
  }, [input]);

  return {
    generateSnapshot,
    isGenerating: state === "generating",
    error: state === "error" ? "Snapshot failed" : null,
    overlayVisible,
    overlayRef,
    state,
  };
}
