import { slug } from "./snapshot";
import { truncateUnicode } from "./truncate";
import type { QuoteCardData, TweetIntentParams } from "../types/quote-share";

const T_CO_URL_LENGTH = 23;
const TWEET_MAX_LENGTH = 280;
const HASHTAG_TEXT = "AITradingDebate";

export function buildTweetText(agent: string, assetName: string): string {
  const label = agent.charAt(0).toUpperCase() + agent.slice(1);
  const truncatedAsset = truncateUnicode(assetName, 10);
  return `Check out this ${label} take on ${truncatedAsset} \u{1F525} #${HASHTAG_TEXT}`;
}

export function validateTweetLength(text: string, url?: string): string {
  const hashtagLen = HASHTAG_TEXT.length + 1;
  const urlLen = url ? T_CO_URL_LENGTH : 0;
  const nonTextLen = urlLen + hashtagLen + (url ? 1 : 0);
  const maxTextLen = TWEET_MAX_LENGTH - nonTextLen;

  if (maxTextLen <= 0) return "";

  const textChars = Array.from(text);
  if (textChars.length <= maxTextLen) return text;

  return textChars.slice(0, maxTextLen - 1).join("") + "…";
}

export function buildTweetIntentUrl(params: TweetIntentParams): string {
  const hashtags = params.hashtags ?? HASHTAG_TEXT;
  const validatedText = validateTweetLength(params.text, params.url);
  const query = new URLSearchParams({
    text: validatedText,
    url: params.url,
    ...(hashtags ? { hashtags } : {}),
  });
  return `https://twitter.com/intent/tweet?${query.toString()}`;
}

export function buildQuoteShareFilename(agent: QuoteCardData["agent"], assetName: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `quote-${agent}-${slug(assetName)}-${ts}.png`;
}
