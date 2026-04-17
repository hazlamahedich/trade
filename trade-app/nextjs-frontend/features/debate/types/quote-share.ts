export interface QuoteCardData {
  agent: "bull" | "bear";
  content: string;
  timestamp: string;
}

export type QuoteShareState = "idle" | "generating" | "sharing" | "error" | "success";

export interface TweetIntentParams {
  text: string;
  url: string;
  hashtags?: string;
}
