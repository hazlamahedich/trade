stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
completedAt: '2026-02-18'

# trade - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for trade, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR-01: Users can view a live, streaming text debate between "Bull" and "Bear" agents.
- FR-02: Users can see distinctive personas for each agent.
- FR-03: The System must enforce clear turn-taking in the chat interface.
- FR-04: Users can clearly distinguish between "Live" and "Archived" debates.
- FR-05: **Debate Archival:** Finished debates must automatically convert to static history pages.
- FR-06: Users can see "Risk Interjections" flagging dangerous logic.
- FR-07: The System must generate a "Summary Verdict" (e.g., "High Risk / Wait").
- FR-08: **Forbidden Phrase Filter:** Strict real-time filtering of promissory language.
- FR-09: **Moderation Transparency:** Visual indicator for modified messages.
- FR-10: Users can vote "Bull Won" or "Bear Won".
- FR-11: **Anti-Spam Voting:** Rate-limit voting (1 vote per session/IP).
- FR-12: Users can see "Community Sentiment" *after* voting.
- FR-13: Users can share a "Debate Snapshot" to social media.
- FR-14: **Quote Sharing:** Users can share specific arguments as image quotes.
- FR-15: The System must connect to a live market data provider.
- FR-16: The System must pause debate if market data is >1 minute old.
- FR-17: Users can access a high-conversion Landing Page.
- FR-18: **SEO Archives:** System must generate static Comparison Pages.
- Journey-Req-1: **Frontend:** "Active Waiting" states, "Celebration" UI for negative outcomes.
- Journey-Req-2: **Agent Config:** Interface for "Teaching" agents specific rules.
- Journey-Req-3: **Admin Dashboard:** Log review tool, "Hallucination" flagging workflow.

### NonFunctional Requirements

- NFR-01 (Stream Latency): Agent text to User UI display **< 500ms** (via SSE/WebSocket).
- NFR-02 (Load Time): Marketing Landing Page LCP **< 1.2s** on mobile 4G.
- NFR-03 (Viewers - Read): Support **50,000 concurrent viewers** (via CDN).
- NFR-04 (Voters - Write): Support **10,000 concurrent voters** (DB limit).
- NFR-05 (Graceful Degradation): **Disable Voting API** if active users > 10,000.
- NFR-06 (Uptime): **99.9% availability** during core Market Hours.
- NFR-07 (LLM Failover): Auto-switch provider if primary fails/timeouts (>5s).
- NFR-08 (Vote Integrity): Strict rate-limiting (**1 vote per session**).
- NFR-09 (Tamper-Evidence): Immutable append-only logs for Risk Guardian interventions.

### Additional Requirements

**Architecture:**
- **Starter Template:** **Vinta Software `nextjs-fastapi-template`**. (**CRITICAL FOR EPIC 1**)
- **Infrastructure:** Split stack hosting (Frontend: Vercel, Backend: Railway).
- **Communication Protocol:** **Native FastAPI WebSockets** (Overriding PRD's SSE suggestion for bi-directional needs).
- **Authentication:** `fastapi-users` (Starter Default) with Bearer Token pattern for WebSockets.
- **Database:** Railway Managed PostgreSQL 16.
- **Naming Convention:** Strict **`snake_case` (Backend)** <-> **`camelCase` (Frontend)** with Pydantic alias generator.
- **API Standard:** Standard Response Envelope and WebSocket Action structure.
- **Security:** "Guardian" agent must filter output *before* WebSocket stream.

**UX Design:**
- **Mobile-First:** Portrait Mode optimization with "Thumb Zone" navigation (Bottom 30%).
- **Visual Feedback:** "Traffic Light" system (Red/Green/Purple) and "Living UI" ambient background tinting.
- **Interaction Pattern:** "Guardian Interrupt" modal must freeze UI (grayscale) and require explicit choice.
- **Component Specific:** `DebateStream` requires virtualization for performance.
- **Accessibility:** WCAG AA Strict, Dual-Coding for color (Icons + Text), Motion Safety.
- **Animation:** "Active Waiting" typing indicators to turn latency into anticipation.

### FR Coverage Map

- FR-01: Epic 1 - Live debate streaming
- FR-02: Epic 1 - Agent personas
- FR-03: Epic 1 - Turn-taking enforcement
- FR-04: Epic 4 - Live vs Archived distinction
- FR-05: Epic 4 - Auto-archival
- FR-06: Epic 2 - Risk interjections
- FR-07: Epic 2 - Summary verdict
- FR-08: Epic 2 - Phrase filter
- FR-09: Epic 2 - Moderation transparency
- FR-10: Epic 3 - Voting
- FR-11: Epic 3 - Rate limiting
- FR-12: Epic 3 - Sentiment reveal
- FR-13: Epic 5 - Social snapshot
- FR-14: Epic 5 - Quote sharing
- FR-15: Epic 1 - Market data connection
- FR-16: Epic 1 - Stale data pause
- FR-17: Epic 4 - Landing page
- FR-18: Epic 4 - SEO archives
- Journey-Req-1: Epic 1/2 - UX states
- Journey-Req-2: Epic 6 - Agent config
- Journey-Req-3: Epic 6 - Admin tools

## Epic List

### Epic 1: Live Market Reasoning (The Arena - MVP Core)

Users can view a live, dramatized debate between AI agents to understand immediate market conditions without establishing an account.

**FRs covered:** FR-01, FR-02, FR-03, FR-15, FR-16, Journey-Req-1

### Story 1.1: Project Initialization & Infrastructure

As a Developer,
I want to initialize the project repository with the Vinta starter and deploy the split stack,
So that we have a production-ready foundation for development.

**Acceptance Criteria:**

**Given** no existing repository
**When** I run the initialization script
**Then** the `nextjs-fastapi-template` is cloned and structure verified

**Given** the repository
**When** I configure the `Dockerfile`
**Then** it builds successfully for the Railway (Backend) environment

**Given** the Vercel project
**When** I deploy the frontend
**Then** the specific Vercel URL is reachable and serves the Next.js app

**Given** the split stack
**When** I configure CORS settings
**Then** the frontend can successfully call the backend health check endpoint

### Story 1.2: Market Data Service

As a System,
I want to fetch and cache live market data,
So that the agents have up-to-date context for their debate.

**Acceptance Criteria:**

**Given** a target asset (e.g., BTC)
**When** the service is triggered
**Then** it fetches current price and news from the external provider (e.g., Yahoo/CoinGecko)

**Given** the fetched data
**When** processing is complete
**Then** it is cached in Redis with a precise timestamp

**Given** a failure to fetch from provider
**When** the provider is down
**Then** the service returns the last cached data with a "Stale" flag (if < 1 min old) or a specific error code

### Story 1.3: Debate Engine Core (LangGraph)

As a User,
I want the system to orchestrate a discussion between Bull and Bear agents,
So that I can read their opposing arguments based on the same data.

**Acceptance Criteria:**

**Given** a valid market context
**When** the debate starts
**Then** the Bull agent generates an argument specifically citing the data

**Given** the construction of the Bull's argument
**When** it is complete
**Then** the Bear agent generates a counter-argument that explicitly references the Bull's points

**Given** the LangGraph workflow
**When** executing the debate loop
**Then** it strictly maintains the state of the conversation and agent turn order

### Story 1.4: WebSocket Streaming Layer

As a User,
I want to see arguments stream in token-by-token,
So that I don't have to wait for the entire text to generate (low latency).

**Acceptance Criteria:**

**Given** a running debate
**When** an agent generates text
**Then** the backend streams tokens via WebSocket to the connected client in real-time

**Given** the stream
**When** a full message is complete
**Then** a special "End of Message" event is sent to the client

**Given** a disconnection
**When** the client reconnects
**Then** the system handles the reconnection gracefully (either resetting or resuming state)

### Story 1.5: Debate Stream UI (The Arena)

As a User,
I want to view the debate in a chat-like interface,
So that I can easily follow the conversation.

**Acceptance Criteria:**

**Given** the WebSocket stream
**When** messages arrive
**Then** they are displayed in a chat list (Bull on left/green, Bear on right/red)

**Given** an incomplete message
**When** streaming is in progress
**Then** "Active Waiting" indicators (typing...) are shown to the user

**Given** the UI
**When** viewed in Portrait mode on mobile
**Then** the chat is fully visible, readable, and scrollable (Thumb Zone compliant)

### Story 1.6: Stale Data Guard

As a User,
I want the debate to pause if data is old,
So that I don't make decisions based on outdated information.

**Acceptance Criteria:**

**Given** the market data
**When** it is older than 1 minute
**Then** the system prevents a new debate from starting and shows an error

**Given** an active debate
**When** data becomes stale
**Then** the debate pauses and a visible "Data Stale" warning is displayed to the user

### Story 1.7: Visual Reasoning Graph (Decision Visualization)

As a User,
I want to see a visual node graph of the agents' thought process,
So that I understand exactly *how* the decision was reached (White Box AI).

**Acceptance Criteria:**

**Given** a debate in progress
**When** agents generate arguments
**Then** a "Reasoning Graph" visualization (e.g., React Flow) updates in real-time below the chat

**Given** the graph
**When** displayed
**Then** it shows nodes for "Data Input", "Bull Analysis", "Bear Counter", and "Risk Check" connected by directional edges

**Given** the final verdict
**When** reached
**Then** the graph highlights the "Winning Path" that led to the conclusion

### Epic 2: Risk Guardian Protection (The Differentiator)

Users receive real-time, intervening warnings when debate logic becomes dangerous or speculative, ensuring safety.

**FRs covered:** FR-06, FR-07, FR-08, FR-09, Journey-Req-1

### Story 2.1: Guardian Agent Logic (The Interrupter)

As a System,
I want the Guardian Agent to analyze the live debate for fallacies and high-risk logic,
So that dangerous financial advice is flagged immediately.

**Acceptance Criteria:**

**Given** a stream of arguments from Bull/Bear
**When** the Guardian detects a specific logical fallacy or dangerous claim
**Then** it generates an "Interrupt" signal with a specific reason and a "Summary Verdict" (FR-07)

**Given** safe arguments
**When** the Guardian analyzes them
**Then** it remains silent and does not interrupt the flow

**Given** the Guardian's prompt
**When** configured
**Then** it prioritizes "Capital Preservation" over all other metrics

### Story 2.2: Debate Engine Integration (The Pause)

As a System,
I want the debate engine to halt when the Guardian interrupts,
So that the user pays attention to the risk warning.

**Acceptance Criteria:**

**Given** an "Interrupt" signal from the Guardian
**When** received by the LangGraph engine
**Then** the current agent generation is immediately stopped

**Given** the interruption
**When** the flow is paused
**Then** the Guardian's warning message is injected as the next message in the stream

**Given** the warning is delivered
**When** the user acknowledges (in UI)
**Then** the engine resumes the debate flow (or ends it based on severity)

### Story 2.3: Guardian UI Overlay (The Freeze)

As a User,
I want the UI to visually freeze when a risk is flagged,
So that I understand the gravity of the warning.

**Acceptance Criteria:**

**Given** a Guardian Interrupt message in the stream
**When** it arrives at the frontend
**Then** the UI applies a grayscale filter to the background debate

**Given** the "Freeze" state
**When** active
**Then** a modal overlay appears with the specific warning and a "Summary Verdict"

**Given** the overlay
**When** displayed
**Then** I must explicitly click "I Understand" or "Ignore" to dismiss it (no clicking outside)

### Story 2.4: Forbidden Phrase Filter (Regex)

As a Compliance Officer,
I want a deterministic filter to catch specific promissory words,
So that we never accidentally display "Guaranteed" financial advice.

**Acceptance Criteria:**

**Given** a list of forbidden words (e.g., "Guaranteed", "Risk-free", "Safe bet")
**When** any agent generates text containing these words
**Then** the system redacts them (e.g., `[REDACTED]`) *before* sending via WebSocket

**Given** a redaction
**When** it occurs
**Then** the system logs the incident for audit (NFR-09)

### Story 2.5: Moderation Transparency (The Badge)

As a User,
I want to know if a message has been modified,
So that I trust the platform is being transparent.

**Acceptance Criteria:**

**Given** a message was redacted or modified by the Guardian
**When** it is displayed in the chat
**Then** a visual "Moderated" badge or icon is visible next to the message

**Given** the "Moderated" badge
**When** hovered/tapped
**Then** a tooltip explains "Modified for Safety Compliance"

### Epic 3: User Verdict & Voting (Engagement)

Users can actively participate in the debate by casting votes on the winner and seeing community sentiment.

**FRs covered:** FR-10, FR-11, FR-12, NFR-03, NFR-04, NFR-05, NFR-08

### Story 3.1: Voting API & Data Model

As a Developer,
I want to implement the backend voting logic with rate limiting,
So that we can collect user sentiment securely without spam.

**Acceptance Criteria:**

**Given** a POST /vote request
**When** received
**Then** the vote is stored in the database linked to the specific debate ID

**Given** the Redis rate limiter
**When** a user tries to vote twice in the same session (IP/Fingerprint)
**Then** the API returns a 429 Too Many Requests error (NFR-08)

**Given** high load (NFR-05)
**When** active users > 10,000
**Then** the system gracefully degrades (e.g., queuing votes or disabling the endpoint)

### Story 3.2: Voting UI Components

As a User,
I want to click "Bull Won" or "Bear Won" during a debate,
So that I can express my opinion.

**Acceptance Criteria:**

**Given** the Voting Controls in the UI
**When** I tap a vote button
**Then** it updates immediately to a "Voted" state (Optimistic UI)

**Given** the "Voted" state
**When** the API confirms success
**Then** the UI transitions to show the Sentiment Reveal

**Given** an API failure
**When** voting fails
**Then** the UI reverts the optimistic update and shows a toast error

### Story 3.3: Sentiment Aggregation Service

As a System,
I want to calculate the percentage of votes efficient,
So that I can serve fresh stats to thousands of users without crashing.

**Acceptance Criteria:**

**Given** the votes table
**When** queried
**Then** the system uses an optimized aggregation query (or cached counter) to return % Bull vs % Bear

**Given** the Redis cache
**When** calculating stats
**Then** the result is cached for a short TTL (e.g., 5-10s) to preventing DB thrashing (NFR-04)

### Story 3.4: Real-time Sentiment Reveal

As a User,
I want to see what others thought only *after* I vote,
So that my opinion isn't biased by the crowd (and I get a reward for voting).

**Acceptance Criteria:**

**Given** I have not voted
**When** I view the debate
**Then** current community sentiment stats are HIDDEN (FR-12)

**Given** I have successfully voted
**When** the "Reveal" animation plays
**Then** the sentiment bars expand to show the community breakdown

**Given** the vote count
**When** updated
**Then** the sentiment display updates periodically via polling or WebSocket push

### Epic 4: Debate History & Discovery (Retention)

Users can search and review past debates to learn from historical market scenarios.

**FRs covered:** FR-04, FR-05, FR-17, FR-18, NFR-02

### Story 4.1: Debate Archival Service

As a Developer,
I want an automated process to archive finished debates,
So that the live system remains lightweight while history is preserved.

**Acceptance Criteria:**

**Given** a debate that has concluded (Risk Guardian ended it or time expired)
**When** the "End" signal is processed
**Then** the full transcript, winner, and sentiment stats are persisted to the PostgreSQL database

**Given** the archival process
**When** complete
**Then** the debate is removed from the active hot memory (Redis) to free up resources

### Story 4.2: Debate History Page (The Archive)

As a User,
I want to browse past debates by asset or outcome,
So that I can learn from previous market situations.

**Acceptance Criteria:**

**Given** the History Page
**When** I load it
**Then** I see a paginated list of past debates with clear "Winner" badges

**Given** the list
**When** I filter by "ETH" or "Bull Wins"
**Then** the list updates to show only matching debates

**Given** a debate card
**When** clicked
**Then** it navigates to the static detail page for that debate

### Story 4.3: Static Debate Page (SEO)

As a Marketer,
I want finished debates to be static HTML pages,
So that search engines can index the unique content (e.g., "Bull vs Bear on ETH").

**Acceptance Criteria:**

**Given** a finished debate ID
**When** the page is requested
**Then** the server renders a static (or ISR) page with the full transcript (FR-18)

**Given** the static page
**When** viewed
**Then** it contains correct Schema.org markup for "Article" or "Discussion"

**Given** a "Live" user
**When** visiting an old link
**Then** they clearly see an "Archived" badge (FR-04)

### Story 4.4: High-Conversion Landing Page

As a Product Owner,
I want a fast, compelling landing page,
So that we convert visitors into debate watchers.

**Acceptance Criteria:**

**Given** a mobile 4G connection
**When** the landing page loads
**Then** the Largest Contentful Paint (LCP) is under 1.2 seconds (NFR-02)

**Given** the hero section
**When** viewed
**Then** it features a "Live Now" ticker deep-linking to the active arena

**Given** the value prop section
**When** viewed
**Then** it explains "Cognitive Offloading" with a simple graphic or animation

### Epic 5: Social Growth (Viral Loop)

Users can share specific valid arguments or debate outcomes to their social networks.

**FRs covered:** FR-13, FR-14

### Story 5.1: Dynamic OG Image Generation

As a System,
I want to generate dynamic social preview images for every debate,
So that links shared on Twitter/Discord look data-rich and clickable.

**Acceptance Criteria:**

**Given** a distinct debate link
**When** a crawler requests the page metadata
**Then** the `og:image` tag points to a dynamically generated image (using `satori` or `ImageResponse`)

**Given** the image generation
**When** rendered
**Then** it displays the Asset Name, Current/Final Winner, and Sentiment Bar visual

### Story 5.2: Debate Snapshot Tool

As a User,
I want to take a designed snapshot of the current debate state,
So that I can save a record of the argument.

**Acceptance Criteria:**

**Given** an active debate
**When** I click "Snapshot"
**Then** the system generates a PNG/JPG of the visible debate stream properly branded with the "Trade" logo (FR-13)

**Given** the snapshot
**When** created
**Then** it automatically prompts the browser's download or share dialog

### Story 5.3: Quote Sharing Flow

As a User,
I want to share a specific "Zinger" argument from an agent,
So that I can highlight a specific point (FR-14).

**Acceptance Criteria:**

**Given** a specific argument bubble
**When** I click the "Share" icon
**Then** it generates a focused image card containing the Agent's Avatar and their text

**Given** the generated card
**When** shared to Twitter
**Then** it pre-fills the tweet text with the debate link and a relevant hashtag

### Story 5.4: Social Share Actions

As a Mobile User,
I want to use my phone's native share sheet,
So that sharing feels natural and frictionless.

**Acceptance Criteria:**

**Given** the "Share Debate" button
**When** checked on a mobile device
**Then** it uses the Web Share API (`navigator.share`) to open the native share sheet

**Given** a desktop browser
**When** clicked
**Then** it falls back to copying the link to the clipboard and showing a toast notification

### Epic 6: Operations & Advanced Config (Power & Admin)

Power users can tune agent parameters to their strategy, and Admins can audit/flag hallucinations.

**FRs covered:** Journey-Req-2, Journey-Req-3, NFR-09

### Story 6.1: Admin Dashboard (Logs & Hallucinations)

As a Compliance Officer,
I want to view a table of all debates and flag hallucinations,
So that we can improve the system and remove dangerous content.

**Acceptance Criteria:**

**Given** a staff user
**When** loading `/admin/debates`
**Then** I see a paginated table of recent debates with "Risk Score" columns

**Given** a specific debate
**When** I flag a message as "Hallucination"
**Then** it is marked in the DB (Journey-Req-3) and added to the "Negative Examples" dataset

### Story 6.2: Agent Strategy Config UI (Diana Persona)

As a Power User,
I want to customize the Bull/Bear agents with my own rules (e.g., "RSI < 30"),
So that the debate reflects my personal trading strategy.

**Acceptance Criteria:**

**Given** the "Strategy Config" modal
**When** I enter a natural language instruction (e.g., "Only buy if RSI is low")
**Then** the system updates my session's agent prompt (Journey-Req-2)

**Given** a custom strategy
**When** I start a new debate
**Then** the agents explicitly reference my rules ("Per your RSI rule...")
