type EventName =
  | "debate_detail_page_viewed"
  | "debate_detail_cta_clicked"
  | "debate_detail_back_clicked"
  | "debate_detail_transcript_expanded";

interface AnalyticsEvent {
  name: EventName;
  properties?: Record<string, string | number | boolean>;
}

function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics]", event.name, event.properties);
  }

  if (typeof window !== "undefined" && "dataLayer" in window) {
    (window as Record<string, unknown[]>).dataLayer?.push({
      event: event.name,
      ...event.properties,
    });
  }
}

export { trackEvent };
export type { EventName, AnalyticsEvent };
