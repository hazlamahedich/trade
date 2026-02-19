---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
inputDocuments:
  - product-brief-trade-2026-02-18.md
  - research/domain-AI_Trading_Debate_Lab-research-2026-02-18.md
  - research/technical-AI_Trading_Debate_Lab-research-2026-02-18.md
workflowType: 'prd'
classification:
  projectType: web_app
  domain: fintech
  complexity: high
  projectContext: greenfield
vision_insights:
  vision: "Externalized reasoning platform that offloads the mental burden of trading decisions."
  differentiator: "Cognitive Offloading as a Service"
  core_insight: "Confidence Engine - users want the absence of doubt, not just a signal."
---

# Product Requirements Document - trade

**Author:** team mantis a
**Date:** 2026-02-18

## Executive Summary

**AI Trading Debate Lab** externalizes the professional trader's internal monologue into a live, transparent debate between opposing AI agents. By visualizing the conflict between a **Bull** and **Bear** agent—moderated by a **Risk Guardian**—the platform offers **Cognitive Offloading as a Service**, allowing users to bypass analysis paralysis and understand market reasoning without black-box opacity.

Designed for **High Complexity** regulatory environments, the system functions as a strictly educational "Reasoning Engine," ensuring users receive actionable logic without crossing the boundary into financial advice.

### What Makes This Special

**Cognitive Offloading as a Service:**
Unlike traditional signals that provide a flat "Buy/Sell" output, the Debate Lab creates a **Confidence Engine**. It visualizes the *absence of doubt* by showing exactly how the sausage is made. The core differentiator is the emotional relief provided by the **Risk Guardian**, which acts as a "Designated Adult," flagging dangers in real-time so the user doesn't have to fear what they might be missing. This transforms trading from a stress-inducing gamble into a structured, learnable skill.

## Project Classification

- **Project Type:** Web Application (SPA / React + FastAPI)
- **Domain:** Fintech (Trading Education)
- **Complexity:** High (Real-time agent orchestration, Regulatory constraints, AI hallucination risk)
- **Context:** Greenfield (New Product Development)

## Success Criteria

### User Success

- **Debate Completion:** >60% of users watch a debate to the final recommendation.
- **Confidence Lift:** Users self-report a measurable increase in trading confidence after 1 month.
- **Progression:** >15% of active users graduate from "Watchers" to "Customizers" (Value Ladder).
- **"Aha" Moment:** Users explicitly identify the Risk Guardian's intervention as the primary value driver.

### Business Success

- **Retention:** Day 30 retention > 20% (Critical Hard Gate for Phase 2).
- **Monetization:** Free-to-Paid conversion > 5% within 3 months.
- **Sustainability:** Subscription revenue covers operational costs by Month 6.

### Technical & Compliance Success

- **Responsiveness (TTFT):** Time to First Argument < 2 seconds (immediate engagement).
- **Readability (Duration):** Total Debate Duration < 20 seconds (ensures "deep thought" feel without being too slow).
- **Hallucination Rate:** < 1% of generated arguments contain factual market errors (verified by LLM-as-a-Judge).
- **Compliance Safety:** 100% of debates include prominent "Educational Use Only" disclaimers.
- **Auditability:** Complete logs of every agent thought process stored for potential review.

## Product Scope

### MVP - Minimum Viable Product

- **Core Debate Engine:** Bull, Bear, and Risk Guardian agents debating on **Simulated/Mock Data**.
- **Interface:** Web App (React) with "Traffic Light" confidence display and linear argument feed.
- **User System:** Auth, Personal Debate History, Basic Preferences.
- **Constraint:** No real-time market data connection (mock used to minimize MVP complexity).

### Growth Features (Post-MVP)

- **Real Data Integration:** Live connection to Yahoo Finance / CoinGecko.
- **Interactive Graph:** Visualization of the argument tree (React Flow).
- **Social Sharing:** "Share this Debate" features for viral growth.

### Vision (Future)

- **Portfolio Intelligence:** Analyzing a user's entire portfolio.
- **"Teach the AI":** Users building their own agent personas.
- **The "Daily Driver":** Becoming the default start-of-day tool for retail traders.

## User Journeys

### Journey 1: Miguel Finds an Adult in the Room (The "Aha" Moment)

- **Persona:** Miguel, 27, burnt by signal groups. Anxious about losing money.
- **Trigger:** Clicks an ad for "Why you lost money on Bitcoin."
- **Steps:**
    1.  **Onboarding:** Sees a simple interface. No charts, just "What do you want to trade?". Selects BTC.
    2.  **The Wait (Active Loading):** Instead of a spinner, he sees text updates: *"Bull Agent analyzing trend..."*, *"Bear Agent checking news..."*.
    3.  **The Debate:** He watches the Bull make a strong case. He almost clicks "Buy."
    4.  **The Turn:** The **Risk Guardian** interrupts: *"Hold on. Volatility is abnormally high."*
    5.  **The Aha:** Miguel realizes, *"I would have bought there and lost."*
    6.  **Resolution:** The final recommendation is **"Wait"**. The UI celebrates this as a "Discipline Win".

### Journey 2: Diana Teaches the Machine (The "Power User" Validation)

- **Persona:** Diana, 32, active trader. Has a specific pullback strategy but lacks discipline.
- **Trigger:** Wants to know if her strategy would have worked on yesterday's chop.
- **Steps:**
    1.  **Configuration:** Enters "Agent Config." She tells the Bull: *"Only look for RSI < 30."*
    2.  **Simulation:** She runs the simulation on yesterday's data.
    3.  **The Conflict:** The Bear counters: *"RSI is low, but market structure is breaking down."*
    4.  **Refinement:** She tweaks the Bull: *"Add a moving average filter."*
    5.  **Resolution:** She now has a "Diana-Bot" that argues *her* logic, but better.

### Journey 3: The Hallucination Hunt (Admin/Operational)

- **Persona:** Sarah, Internal Ops/Support.
- **Trigger:** Automated flag from the "LLM Judge" regarding a debate with factually incorrect data.
- **Steps:**
    1.  **Alert:** Dashboard shows "Debate #1024 - Flagged for Factuality."
    2.  **Review:** She opens the logs. The Bear Agent claimed "Google earnings were yesterday" (false).
    3.  **Correction:** She marks the specific argument as "Hallucination."
    4.  **Tuning:** She adds this to the "Negative Examples" dataset.
    5.  **Resolution:** The user gets a notification: *"Correction issued for Debate #1024."*

### Journey Requirements Summary

- **Frontend:** "Active Waiting" states, "Celebration" UI for negative outcomes.
- **Agent Config:** Interface for "Teaching" agents specific rules.
- **Admin Dashboard:** Log review tool, "Hallucination" flagging workflow.

## Domain-Specific Requirements

### Compliance & Regulatory

- **No Personalized Advice:** The system must NEVER suggest a trade based on a user's specific financial situation.
- **Prominent Disclaimers:** A "This is not financial advice" banner must constitute at least 5% of the viewport height.
- **Forbidden Phrase Filter:** Strict regex filtering of promissory language (e.g., "Guaranteed").

### Technical Constraints

- **Deterministic Latency:** Debate arguments must arrive in correct sequence.
- **Data Freshness:** If market data is >1 minute old, the system must pause debates and flag "Data Stale."

### Integration Requirements

- **Market Data Aggregator:** Connection to a unified API (e.g., Yahoo Finance) with fallback.
- **LLM "Judge" Engine:** A separate, isolated LLM pipeline that scores every argument for safety.

### Risk Mitigations

- **Real-time Risk Guardian Corrections:** Interrupts chat to correct mistakes turning errors into teachable moments.
- **Tamper-Evident Logging:** Cryptographic hashing of all debate logs.

## Innovation & Novel Patterns

### Detected Innovation Areas

- **Cognitive Offloading Interface:** Outsourcing the mental labor of *weighing* arguments.
- **The "Anti-Nudge":** Gamifying *inaction* (discipline).
- **Visualized Dialectics:** Turning indicators into natural language conversation.

### Blue Ocean Opportunities

- **Reverse Debate (Active Mode):** User argues a thesis, AI attempts to dismantle it.
- **Instant Replay:** AI reconstructs the debate that *should* have happened after a trade.
- **Social Guardians:** Marketplace for custom Risk Profiles.

### Market Context

- **Status Quo:** Signal groups or Tools.
- **The Gap:** No tool for "Guided Reasoning."
- **Competitive Moat:** The "Risk Guardian" persona and trust.

## Web App Specific Requirements

### Project-Type Overview

- **Architecture:** Hybrid Approach (Next.js Marketing + React SPA App).
- **Real-Time Strategy:** **Server-Sent Events (SSE)** for unidirectional streaming.

### Technical Architecture Considerations

- **Browser Support:** Evergreen Browsers Only.
- **Accessibility (A11y):** "Best Effort" compliance (Keyboard nav, contrast).
- **Performance:**
    - Marketing LCP: < 1.2s.
    - App TTI: < 2s.

### Implementation Considerations

- **SEO Strategy:** Programmatic SEO for "Comparison Pages" (e.g., /debate/btc-vs-eth).
- **State Management:** React Context + React Query.

## Project Scoping & Phased Development

### MVP Strategy: "The Viewer"

Prove that *watching* the debate provides "Cognitive Offloading" before building complex features.

### MVP Feature Set (Phase 1)

- **Must-Have Capabilities:**
    - **Live Debate Stream:** Unidirectional SSE stream.
    - **The Risk Guardian:** Real-time interjections.
    - **Vote Interaction:** Simple "Who Won?" buttons.
    - **Marketing Site:** High-conversion landing page.

### Post-MVP Features

- **Phase 2 (Engagement):** Reverse Debate, User Accounts, "Virtual PnL".
- **Phase 3 (Expansion):** Social Guardians, Creator Mode.

### Risk Mitigation Strategy

- **Technical Risks (SSE Scale):** Use standard HTTP/2 and CDN caching.
- **Market Risks (Boredom):** "Vote" feature ensures skin in the game.
- **Resource Risks:** Dropping "Reverse Debate" from MVP.

## Functional Requirements

### Debate Experience

- **FR-01:** Users can view a live, streaming text debate between "Bull" and "Bear" agents.
- **FR-02:** Users can see distinctive personas for each agent.
- **FR-03:** The System must enforce clear turn-taking in the chat interface.
- **FR-04:** Users can clearly distinguish between "Live" and "Archived" debates.
- **FR-05:** **Debate Archival:** Finished debates must automatically convert to static history pages.

### Risk Guardian System

- **FR-06:** Users can see "Risk Interjections" flagging dangerous logic.
- **FR-07:** The System must generate a "Summary Verdict" (e.g., "High Risk / Wait").
- **FR-08:** **Forbidden Phrase Filter:** Strict real-time filtering of promissory language.
- **FR-09:** **Moderation Transparency:** Visual indicator for modified messages.

### User Interaction

- **FR-10:** Users can vote "Bull Won" or "Bear Won".
- **FR-11:** **Anti-Spam Voting:** Rate-limit voting (1 vote per session/IP).
- **FR-12:** Users can see "Community Sentiment" *after* voting.
- **FR-13:** Users can share a "Debate Snapshot" to social media.
- **FR-14:** **Quote Sharing:** Users can share specific arguments as image quotes.

### Market Data & System

- **FR-15:** The System must connect to a live market data provider.
- **FR-16:** The System must pause debate if market data is >1 minute old.

### Marketing & Onboarding

- **FR-17:** Users can access a high-conversion Landing Page.
- **FR-18:** **SEO Archives:** System must generate static Comparison Pages.

## Non-Functional Requirements

### Performance

- **NFR-01 (Stream Latency):** Agent text to User UI display **< 500ms** (via SSE).
- **NFR-02 (Load Time):** Marketing Landing Page LCP **< 1.2s** on mobile 4G.

### Scalability (Tiered Strategy)

- **NFR-03 (Viewers - Read):** Support **50,000 concurrent viewers** (via CDN).
- **NFR-04 (Voters - Write):** Support **10,000 concurrent voters** (DB limit).
- **NFR-05 (Graceful Degradation):** **Disable Voting API** if active users > 10,000.

### Reliability

- **NFR-06 (Uptime):** **99.9% availability** during core Market Hours.
- **NFR-07 (LLM Failover):** Auto-switch provider if primary fails/timeouts (>5s).

### Security

- **NFR-08 (Vote Integrity):** Strict rate-limiting (**1 vote per session**).
- **NFR-09 (Tamper-Evidence):** Immutable append-only logs for Risk Guardian interventions.
