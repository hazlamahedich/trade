interface ShareDataInput {
  assetName: string;
  externalId: string;
  debateStatus?: "active" | "running" | "completed";
}

/** @client-only — callers must only invoke from client components or hooks */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
}

/** @client-only — relies on window.location.origin as env fallback */
export function buildDebateShareUrl(externalId: string): string {
  return `${getBaseUrl()}/debates/${encodeURIComponent(externalId)}`;
}

export function buildShareData(params: ShareDataInput): { title: string; text: string; url: string } {
  const { assetName, externalId, debateStatus } = params;
  const url = buildDebateShareUrl(externalId);
  const title = `Bull vs Bear on ${assetName} — AI Trading Debate Lab`;

  let text: string;
  if (debateStatus === "active" || debateStatus === "running") {
    text = `Watch AI agents debate ${assetName} live`;
  } else if (debateStatus === "completed") {
    text = `See how Bull & Bear argued on ${assetName}`;
  } else {
    text = `Check out this AI debate on ${assetName}`;
  }

  return { title, text, url };
}

export function isWebShareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
