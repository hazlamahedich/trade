export interface SnapshotOptions {
  pixelRatio?: number;
  backgroundColor?: string;
  cacheBust?: boolean;
}

async function getToBlob() {
  const mod = await import("html-to-image");
  return mod.toBlob;
}

function getDefaultOptions(): SnapshotOptions {
  return {
    pixelRatio: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 2,
    backgroundColor: "#0f172a",
    cacheBust: true,
  };
}

export async function captureSnapshot(
  element: HTMLElement,
  options?: SnapshotOptions,
): Promise<Blob> {
  const merged = { ...getDefaultOptions(), ...options };

  const backdropElements = element.querySelectorAll("[data-backdrop]");
  const overrides: HTMLDivElement[] = [];

  backdropElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const origPosition = htmlEl.style.position;
    if (!origPosition || origPosition === "static") {
      htmlEl.style.position = "relative";
    }
    const computed = window.getComputedStyle(el);
    const bg = computed.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)") {
      const div = document.createElement("div");
      div.style.backgroundColor = bg;
      div.style.position = "absolute";
      div.style.inset = "0";
      div.style.zIndex = "-1";
      div.style.borderRadius = computed.borderRadius;
      htmlEl.appendChild(div);
      overrides.push(div);
    }
  });

  try {
    const toBlob = await getToBlob();
    const blob = await toBlob(element, {
      pixelRatio: merged.pixelRatio,
      backgroundColor: merged.backgroundColor,
      cacheBust: merged.cacheBust,
      style: {
        transform: "none",
      },
    });

    if (!blob || blob.size === 0) {
      throw new Error("Snapshot generation produced an empty result");
    }

    return blob;
  } finally {
    overrides.forEach((div) => {
      div.remove();
    });
  }
}

export function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
