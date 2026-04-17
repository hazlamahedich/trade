interface ShareDataInput {
  assetName: string;
  externalId: string;
  debateStatus?: "active" | "completed";
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
}

export function buildDebateShareUrl(externalId: string): string {
  return `${getBaseUrl()}/debates/${externalId}`;
}

export function buildShareData(params: ShareDataInput): { title: string; text: string; url: string } {
  const { assetName, externalId, debateStatus } = params;
  const url = buildDebateShareUrl(externalId);
  const title = `Bull vs Bear on ${assetName} — AI Trading Debate Lab`;

  let text: string;
  if (debateStatus === "active") {
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
