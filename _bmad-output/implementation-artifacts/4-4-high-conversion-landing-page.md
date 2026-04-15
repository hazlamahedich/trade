# Story 4.4: High-Conversion Landing Page

Status: done

## Adversarial Review Record

**Review date:** 2026-04-15
**Reviewers:** Winston (Architect), Sally (UX), Amelia (Dev), Murat (Test Architect)
**Findings:** 4 Critical, 7 High, 10 Medium, 4 Low → all triaged and addressed below

---

## Story

As a Product Owner,
I want a fast, compelling landing page,
So that we convert visitors into debate watchers.

## Acceptance Criteria

1. **AC-1 (Performance):** Given a mobile 4G connection, when the landing page loads, then the Largest Contentful Paint (LCP) is under 1.2 seconds (NFR-02). Verified by Lighthouse CI budget gate in CI pipeline.

2. **AC-2 (Hero + Live Now Ticker):** Given the hero section, when viewed, then it features a "Live Now" ticker deep-linking to the active arena. The ticker renders in one of three defined states: **Live** (active debate), **Scheduled** (next debate countdown), or **Empty** ("Start the first debate" CTA).

3. **AC-3 (Value Prop):** Given the value prop section, when viewed, then it explains the core benefit in user-facing language ("Two AI agents argue both sides. You listen, weigh the evidence, decide.") with a CSS-based graphic. The term "Cognitive Offloading" may appear as a tagline, not the primary headline.

4. **AC-4 (CTA):** Given the landing page, when a user clicks the primary CTA, then they are navigated to the live arena (the debate page where a new debate can start or an active one is streaming). A sticky bottom CTA bar appears on mobile after the LiveNowTicker scrolls out of view.

5. **AC-5 (Mobile-First):** Given a mobile viewport (< 768px), when the page loads, then the layout is fully usable in portrait mode with thumb-zone-friendly tap targets (min 44x44px). Primary actions are positioned in the bottom-third thumb zone.

6. **AC-6 (Accessibility):** Given any viewport, when navigated via keyboard, then all interactive elements are reachable, a skip-to-content link is present, heading hierarchy follows h1→h2 only, all animations respect `prefers-reduced-motion: reduce`, and contrast ratios meet WCAG AA (4.5:1 for normal text, verified per-section against `bg-slate-900`).

7. **AC-7 (Regulatory):** Given the landing page, when viewed, then a "This is not financial advice" disclaimer is visible constituting at least ~5% of viewport height. The banner is collapsible — summary line visible at min-height, "Read full disclaimer" expands inline. The CTA section includes a ref link: "By entering, you acknowledge our risk disclosure."

8. **AC-8 (SEO):** Given the landing page, when crawled, then proper `<title>`, `<meta description>`, and Open Graph tags are present for social sharing. Metadata content is specified in Task 4.

9. **AC-9 (Graceful Degradation):** Given the landing page, when the backend `/api/debate/active` endpoint is unavailable, times out, or returns an error, then the hero section, value props, CTA, and disclaimer still render correctly. The LiveNowTicker shows the Empty state.

10. **AC-10 (Bundle Isolation):** Given the landing page bundle, when analyzed, then it does NOT import React Query hooks, WebSocket connection logic, Zustand stores, `@xyflow/react`, or Framer Motion in above-fold components. RecentDebatesSection uses static preview components, not live debate components.

## Tasks / Subtasks

### Task 0: Shared Utilities (AC: 2, 9) — MUST be completed first

- [x] 0.1: Extract `getApiBaseUrl()` from `features/debate/api/debate-history.ts` to `lib/api/config.ts` — update all existing imports in debate-history action AND `features/debate/actions/debate-detail-action.ts` to use new location. **NOTE:** `lib/clientConfig.ts` also handles API base URL for the OpenAPI client — do NOT duplicate; keep that as-is (different consumer). The new `lib/api/config.ts` is for server actions only.
- [x] 0.2: Add `lib/api/server-action-helpers.ts` — shared `fetchWithTimeout(url, options, timeoutMs)` with AbortController, response envelope validation, and graceful-error return type

### Task 1: Backend — Active Debate Endpoint (AC: 2, 9)

- [x] 1.1: Add `ActiveDebateSummary` Pydantic schema in `app/services/debate/schemas.py` (schemas are co-located in `app/services/debate/`, NOT in `app/schemas/` — that directory does not exist). See "Backend API Contract" section for exact shape.
- [x] 1.2: Add `get_active_debate()` repository method in `app/services/debate/repository.py` — returns single most-recent active debate or `None`. Includes `status` field in response to handle race conditions. **REUSE:** Consider leveraging the existing `get_filtered_debates(status="active")` method rather than writing a new SQL query from scratch.
- [x] 1.3: Add `GET /api/debate/active` route in `app/routes/debate.py` — returns `200 { data: ActiveDebateSummary | null, error: null, meta: { latency_ms } }`. Sets `Cache-Control: public, s-maxage=15, stale-while-revalidate=30`.
- [x] 1.4: Add Redis cache layer (10-15s TTL) in the service — landing page should never trigger a full DB query

### Task 2: Replace boilerplate `app/page.tsx` — Page Shell (AC: 1, 4, 5, 7, 8)

- [x] 2.1: Create `features/landing/components/HeroSection.tsx` — hero with headline, subtext, soft CTA ("See it in action"), and inline SVG agent icons (NOT `AgentAvatar` — it's a `"use client"` component and HeroSection is a Server Component). CSS-only animations (`@keyframes` pulse, fade-in). Respects `prefers-reduced-motion: reduce`.
- [x] 2.2: Create `features/landing/components/LiveNowTicker.tsx` — **client component** (`"use client"`) implementing three states: Live / Scheduled / Empty (see "LiveNowTicker States" section). Uses `aria-live="polite"` for state changes.
- [x] 2.3: Create `features/landing/components/HowItWorksSection.tsx` — 3-step visual (Bull argues → Bear counters → You decide) using inline SVG icons (NOT `AgentAvatar` — Server Component, and `AgentAvatar` is `"use client"`). CSS-only animations, below-fold Framer Motion stagger acceptable.
- [x] 2.4: Create `features/landing/components/ValuePropSection.tsx` — outcome-focused headline and subtext (see "Copy Direction" section) with CSS-based flow diagram. Optionally uses Framer Motion stagger (below fold).
- [x] 2.5: Create `features/landing/components/RecentDebatesSection.tsx` — shows up to 3 recent completed debates using **static preview components** (`DebatePreviewCard`, `VotePreviewBar`) from `features/landing/components/`, NOT live debate components.
- [x] 2.6: Create `features/landing/components/DebatePreviewCard.tsx` — lightweight, static card accepting props (asset, winner, votePercentages, completedAt). Pure CSS, no React Query / WebSocket / Zustand deps.
- [x] 2.7: Create `features/landing/components/VotePreviewBar.tsx` — lightweight, pure-CSS vote bar accepting bullPct/bearPct as props. No React Query, no live data hooks.
- [x] 2.8: Create `features/landing/components/DisclaimerBanner.tsx` — collapsible regulatory disclaimer (see "Regulatory/Compliance" section). `min-h-[5vh]`, summary line + "Read full disclaimer" expandable.
- [x] 2.9: Create `features/landing/components/LandingFooter.tsx` — minimal footer with branding, links to Terms, Privacy, Risk Disclosure, Contact. See "Footer Specification" section.
- [x] 2.10: Create `features/landing/components/StickyCtaBar.tsx` — **client component** (`"use client"`). Mobile-only sticky bottom bar that appears after LiveNowTicker scrolls out of view. Min 44px height. Uses IntersectionObserver on the hero section.
- [x] 2.11: Wire all sections into `app/page.tsx` as a Server Component with ISR. Document the server/client boundary (see "Server/Client Boundary Map" section). Each component ≤300 lines — decompose if exceeding.

### Task 3: Server Action for Landing Page Data (AC: 2, 9)

- [x] 3.1: Create `features/landing/actions/landing-data-action.ts` — server action fetching active debate + recent debates from backend. Uses `fetchWithTimeout` from `lib/api/server-action-helpers.ts`. Graceful degradation: wraps fetch in try/catch, returns `null` data on any failure (hero still renders).
- [x] 3.2: Create `features/landing/types.ts` — TypeScript types matching backend response contracts (`ActiveDebateSummary`, `RecentDebatePreview`, `LandingPageData`).

### Task 4: ISR + Performance Optimization (AC: 1)

- [x] 4.1: Add `export const revalidate = 30` to `app/page.tsx` for ISR with 30-second TTL — this is CDN-cacheable, achieving ~0ms TTFB on repeat visits
- [x] 4.2: Verify `next/font` uses `display: 'swap'` for Geist Sans (already in root layout — confirm no FOIT on LCP element)
- [x] 4.3: Use CSS animations (`@keyframes`) for all above-fold elements — NO Framer Motion in HeroSection or LiveNowTicker
- [x] 4.4: Use `next/image` with `priority` for any images (limited — Glass Cockpit is text-based)
- [x] 4.5: No heavy deps: verify landing page bundle does NOT import React Query, Zustand, WebSocket hooks, or `@xyflow/react`. Use bundle analyzer if needed.

### Task 5: SEO Metadata (AC: 8)

- [x] 5.1: Implement `generateMetadata()` in `app/page.tsx` with:
  - `<title>`: "AI Trading Debate Arena — Watch Bulls & Bears Argue Your Next Trade"
  - `meta description`: "Two AI agents debate both sides of every trade in real time. Watch the arguments, weigh the evidence, and make smarter decisions." (under 160 chars)
  - Open Graph: `og:title`, `og:description`, `og:image` (dark theme branded card — design asset), `og:url`, `og:type`
  - Twitter Card: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`

### Task 6: Testing

- [x] 6.1: Unit tests for each landing section component (HeroSection, HowItWorksSection, ValuePropSection, RecentDebatesSection, DisclaimerBanner, LandingFooter, StickyCtaBar) — test IDs: `[4.4-UNIT-001]` through `[4.4-UNIT-007]`
- [x] 6.2: Unit test for LiveNowTicker — all three states (Live / Scheduled / Empty), state transitions, `aria-live` presence, animation class toggling with `prefers-reduced-motion` mock
- [x] 6.3: Unit test for DebatePreviewCard and VotePreviewBar — static rendering with various prop combinations (0/0 votes, 50/50, null winner)
- [x] 6.4: Unit test for server action — explicit sub-cases: success (active debate), success (null debate = empty state), timeout, malformed response (200 with bad JSON), network error, concurrent invocation. Test ID: `[4.4-UNIT-SERVER-ACTION]`
- [x] 6.5: Unit test for `generateMetadata()` — verifies title, description, OG tags render correctly
- [x] 6.6: Backend test for `GET /api/debate/active` — sub-cases: active debate returned, no active debate (null data), multiple active (returns most recent), stale data filter, response includes `status` field, Cache-Control header present. **Use `engine`/`db_session` fixtures from `tests/conftest.py` (real PostgreSQL, NOT in-memory SQLite — per AGENTS.md lesson #7).** Test ID: `[4.4-BACKEND-001]`
- [x] 6.7: Integration test — FastAPI TestClient serves `/api/debate/active`, server action wrapper calls it, validates full round-trip contract. Catches envelope shape mismatches. Test ID: `[4.4-INTEG-001]`
- [x] 6.8: Accessibility tests — cover ALL items from AGENTS.md Frontend Accessibility Pre-Submission Checklist:
  - Reduced motion: mock `prefers-reduced-motion: reduce`, verify no pulse/stagger classes
  - Skip-to-content link present
  - `aria-live="polite"` on ticker
  - Keyboard tab order through all sections and CTAs
  - Heading hierarchy (single h1, h2s only)
  - Touch targets ≥ 44×44px (computed style assertions on CTAs)
  - Color contrast per-section (use `jest-axe` or axe-core assertions)
  - Dual-coding: LIVE badge has both color AND text label
  - Semantic landmarks: `<main>`, `<section>`, `<footer>`
- [x] 6.9: Performance regression test — Lighthouse CI budget file (`lighthouse-budget.json`) asserting LCP < 1200ms, CLS < 0.1, FID < 100ms. Run in CI after build. Test ID: `[4.4-PERF-001]`
- [x] 6.10: E2E smoke test (Playwright) — page loads, hero renders, CTA clickable, metadata present in `<head>`. Test ID: `[4.4-E2E-001]`
- [x] 6.11: Style guard tests — verify `border-white/15` (not `/10`), `text-slate-400` minimum (not `text-slate-500`), component line counts ≤300. Snapshot or class-name assertions.
- [x] 6.12: Test data factories — create `tests/unit/factories/landing-factory.ts` with `createActiveDebateSummary()`, `createRecentDebatePreview()`, `createServerActionResult()` matching backend Pydantic schemas

### Task 7: Task Ordering Dependencies

Tasks MUST be completed in this order:
1. **Task 0** (shared utilities) — unblocks Tasks 1, 3
2. **Task 1** (backend endpoint) — defines the contract; unblocks Tasks 3, 6.6, 6.7
3. **Tasks 2, 3, 4, 5** (frontend) — can proceed in parallel once Tasks 0-1 are done
4. **Task 6** (testing) — final, after all implementation tasks

## Dev Notes

### Architecture & Performance Strategy

**REVISED — ISR replaces full SSR (critical finding from adversarial review)**

The original spec mandated full SSR on every request. This is architecturally wrong for a landing page targeting LCP < 1.2s on mobile 4G. The waterfall on a cold 4G hit (DNS + TLS + TTFB + SSR fetch to FastAPI + HTML generation + font download) totals 750-1300ms before LCP element renders — already at or past budget.

- **Use ISR with `revalidate = 30`:** The landing page is ~90% static content (hero, value props, how it works, disclaimer, footer, SEO metadata). Only the "Live Now" ticker data is dynamic. ISR gives CDN-cacheable HTML with ~0ms TTFB on repeat visits while keeping data reasonably fresh at 30s intervals.
- **Server/client island pattern:** `app/page.tsx` is a Server Component that fetches active debate data on revalidation. `LiveNowTicker` and `StickyCtaBar` are client component islands that hydrate after load.
- **Error boundary:** The active debate fetch is wrapped in try/catch with static fallback. Hero, value props, CTA, and disclaimer render regardless of API health.
- **No Framer Motion above the fold** — CSS `@keyframes` for hero animations (pulse on LIVE badge, fade-in). Framer Motion acceptable only for below-fold stagger effects.
- **Font loading:** Geist Sans + Geist Mono are loaded via `localFont()` from `./fonts/GeistVF.woff` and `./fonts/GeistMonoVF.woff` in root layout. CSS variables `--font-geist-sans` and `--font-geist-mono` applied to `<body>`. **VERIFY** that `display: 'swap'` is set (currently not explicitly configured in `localFont()` call — add if missing to prevent FOIT on LCP heading).

**CDN / Caching Headers:**

Under 50K concurrent viewers (NFR-03), full SSR on every request is a DoS scenario. The strategy:
- Landing page HTML: CDN-cached, 30s TTL via ISR `revalidate`
- `GET /api/debate/active`: `Cache-Control: public, s-maxage=15, stale-while-revalidate=30`
- Redis cache (10-15s TTL) in FastAPI for the active debate query
- Under 50K load, origin sees ~2 req/s, not 50,000

### Server/Client Boundary Map

```
app/page.tsx (Server Component — ISR, revalidate=30)
  ├── fetches activeDebate + recentDebates via server action
  ├── wraps fetch in try/catch → null fallback
  │
  ├── <HeroSection />              — Server Component (static, CSS animations)
  ├── <LiveNowTicker />            — CLIENT COMPONENT ("use client") — hydrates with server data
  ├── <HowItWorksSection />        — Server Component (static, CSS animations)
  ├── <ValuePropSection />         — Server Component (static, optional Framer Motion below fold)
  ├── <RecentDebatesSection />     — Server Component (static cards with server data)
  ├── <DisclaimerBanner />         — Server Component (collapsible — if JS needed, thin client wrapper)
  ├── <LandingFooter />            — Server Component (static)
  └── <StickyCtaBar />             — CLIENT COMPONENT ("use client") — IntersectionObserver + scroll
```

### Conversion Funnel — Section Order (REVISED)

The section order is redesigned to build understanding before asking for commitment:

```
1. HeroSection         → Curiosity hook + soft CTA ("See it in action")
2. LiveNowTicker       → Social proof + excitement (live debate or smart empty state)
3. HowItWorksSection   → 3-step visual — NOW I understand what this is
4. ValuePropSection    → Outcome-focused benefit — "Two AI agents argue both sides"
5. RecentDebatesSection → Proof it's real — actual completed debates
6. CTA Section         → Hard conversion ask — "Ready to watch?" / "Enter the Arena"
7. DisclaimerBanner    → Regulatory compliance
8. LandingFooter       → Trust signals + legal links
```

The hero creates *curiosity*, not commitment. The hard CTA comes after understanding and proof.

### Backend API Contract

**`GET /api/debate/active`**

Request: No parameters. Unauthenticated.

Response (200):
```json
{
  "data": {
    "id": "uuid",
    "asset": "BTC",
    "status": "active",
    "startedAt": "2026-04-15T10:30:00Z",
    "viewerCount": null
  } | null,
  "error": null,
  "meta": { "latency_ms": 5 }
}
```

Key contract rules:
- **No active debate:** `200 { data: null, error: null, meta: {} }` — NOT 404. Null data is the common case (3am, new platform).
- **Includes `status` field:** Handles race condition where debate completes between query and render. Frontend checks `status === "active"` before rendering Live state.
- **`viewerCount` is nullable:** Aspirational field, may not be implementable in this story.
- **Cache-Control header:** `public, s-maxage=15, stale-while-revalidate=30`
- **Redis cache:** 10-15s TTL in FastAPI service layer

**`GET /api/debate/history?status=completed&limit=3`** (existing endpoint, reuse for RecentDebates)

Response shape already defined in Story 4.2a. Use existing server action pattern.

### LiveNowTicker States

| State | Condition | UI |
|-------|-----------|----|
| **Live** | `data !== null && data.status === "active"` | Pulsing green dot + "LIVE" badge + asset name (e.g., "BTC"). Links to `/debates/[id]`. `aria-live="polite"`: "Live debate: BTC Bull vs Bear" |
| **Scheduled** | `data !== null && data.status === "scheduled"` (future state — not in this story) | "Next debate: TSLA — starts in 23 min" with countdown |
| **Empty** | `data === null` or fetch failed | "The arena is resting. Start the first debate." — CTA linking to arena. No pulsing dot. |

The Empty state flips the ghost-town problem into an opportunity. The absence becomes a call to action.

### Copy Direction

**Hero headline (AC-3):** Outcome-focused, not mechanism-focused.
- Headline: "Watch AI Agents Debate Your Next Trade" (retained from original — strong)
- Subtext: "Two AI agents argue both sides of every trade. You listen, weigh the evidence, and decide. No more analysis paralysis."
- Tagline (smaller): "It's called Cognitive Offloading — and it works." — the term appears as a tagline, not the primary hook.

**Value Prop section:**
- Headline: "Stop Second-Guessing. Watch the Debate."
- Subtext: "Bull makes the case. Bear tears it apart. Guardian flags the risks. You get clarity."
- Diagram: "Raw Data → Bull & Bear Argue → You Get Clarity"

### Component Isolation — Bundle Size

**REVISED — No live debate component imports on landing page (critical finding)**

The original spec imported `DebateHistoryCard`, `DebateVoteBar`, and `AgentAvatar` from `features/debate/`. These pull in React Query hooks, WebSocket connection logic, Zustand stores, and Framer Motion — defeating the "no heavy deps" constraint.

| Component | Strategy |
|-----------|----------|
| `AgentAvatar` | **CAUTION: `"use client"` component** — can ONLY be imported into client components (`LiveNowTicker`, `StickyCtaBar`). For Server Components (HeroSection, HowItWorksSection), use inline SVG icons with the same emerald/rose colors instead. |
| `DebateHistoryCard` | **DO NOT IMPORT** — It's a Server Component but it imports `DebateVoteBar` (a `"use client"` component) transitively, which forces a client boundary. Create `DebatePreviewCard` in `features/landing/components/` instead. Static, prop-driven, no transitive client deps. |
| `DebateVoteBar` | **DO NOT IMPORT** — It's a `"use client"` component with Framer Motion. Create `VotePreviewBar` in `features/landing/components/` instead. Pure CSS, accepts `bullPct`/`bearPct` props. |
| `ArchivedBadge` | **Consider reuse** — exists in `features/debate/components/ArchivedBadge.tsx`. Check if it's a Server Component without heavy deps; if yes, import is safe for RecentDebatesSection. Otherwise create inline badge. |
| `Badge`, `Button`, `Card` | **Import from `components/ui/`** — these are Shadcn primitives (15+ available including `Skeleton`, `Tooltip`, `Separator`), safe to import. |

Rule: If a component from `features/debate/` imports anything beyond React + CSS, create a static variant in `features/landing/`.

### Design System — "Glass Cockpit" Theme

- **Background:** `bg-slate-900` (dark mode default)
- **Borders:** `border-white/15` (NOT `/10` — fails contrast, per lesson from Story 4.3)
- **Text colors:** `text-slate-400` minimum for secondary text (NOT `text-slate-500`)
- **Primary text:** `text-white` or `text-slate-50`
- **Bull color:** `text-emerald-500` / `bg-emerald-500`
- **Bear color:** `text-rose-500` / `bg-rose-500`
- **Guardian color:** `text-violet-600`
- **Glass effects:** `bg-slate-900/80 backdrop-blur-md` for header/nav overlays
- **Glow effects:** `shadow-emerald-500/20` for Bull highlights
- **Typography:** Geist Sans (already loaded in root layout via `--font-geist-sans` variable)
- **Border radius:** `rounded-lg` (8px) for containers, `rounded-sm` (4px) for buttons

**Per-Section Contrast Requirements (NEW — verified against `bg-slate-900`):**

| Section | Background | Primary Text | Secondary Text | Contrast Ratio |
|---------|-----------|-------------|---------------|----------------|
| Hero | `bg-slate-900` | `text-white` (#fff) | `text-slate-300` | 12.6:1 / 6.4:1 |
| Cards | `bg-slate-800` | `text-white` | `text-slate-400` (#94a3b8) | 10.7:1 / 4.6:1 |
| Footer | `bg-slate-950` | `text-slate-300` | `text-slate-500` (footer only) | 7.3:1 / 3.1:1 (large text) |
| Disclaimer | `bg-slate-950` | `text-slate-300` | `text-slate-400` | 7.3:1 / 4.6:1 |
| Ticker (Live) | `bg-emerald-500/10` | `text-emerald-400` | — | 4.8:1 |

**Anti-patterns:** NO gold/black "luxury" aesthetic, NO FOMO triggers, NO "guru" vibes. Scientific/Clean feel.

### Mobile UX Specification (NEW)

- **Sticky CTA bar:** Mobile-only (`md:hidden`). Appears after LiveNowTicker exits viewport (IntersectionObserver on hero section). Min 44px height, emerald-themed button, "Enter the Arena" text.
- **Thumb zone mapping:** Primary actions (CTA buttons, ticker tap) positioned in bottom-third of screen. Passive content (hero text) at top.
- **Touch targets:** All interactive elements min 44×44px — verified by test (Task 6.8).
- **Scroll behavior:** No scroll-jacking, no full-page snap. Smooth natural scroll.

### Footer Specification (NEW)

The footer is a trust signal, not an afterthought:
- Brand name + tagline ("AI Trading Debate Lab")
- Links: Terms of Service, Privacy Policy, Risk Disclosure, Contact
- Optional: GitHub link (carried over from existing boilerplate)
- Dark background (`bg-slate-950`), `text-slate-400` links, `text-slate-300` brand

### Regulatory/Compliance (REVISED)

From PRD: "A 'This is not financial advice' banner must constitute at least ~5% of viewport height." Revised implementation:

- `DisclaimerBanner` component at page bottom
- **Collapsed state (default):** `min-h-[5vh]`, summary line: "Trading involves risk. This is not financial advice."
- **Expanded state:** "Read full disclaimer" button expands inline to show full legal text. Uses `<details>/<summary>` for no-JS fallback.
- Dark background (`bg-slate-950`), `text-slate-300`
- **CTA cross-reference:** The CTA section includes a small link: "By entering, you acknowledge our risk disclosure." — ties the disclaimer to the moment of action.

### File Structure

```
lib/
  └── api/
      ├── config.ts                      # getApiBaseUrl() — extracted from debate-history.ts
      └── server-action-helpers.ts       # fetchWithTimeout, response validation helpers

features/landing/
  ├── actions/
  │   └── landing-data-action.ts         # Server action for landing page data
  ├── components/
  │   ├── HeroSection.tsx                # Hero + soft CTA + agent icons (Server Component)
  │   ├── LiveNowTicker.tsx              # 3-state ticker (CLIENT COMPONENT)
  │   ├── HowItWorksSection.tsx          # 3-step visual
  │   ├── ValuePropSection.tsx           # Outcome-focused value prop
  │   ├── RecentDebatesSection.tsx       # Recent debates using static preview components
  │   ├── DebatePreviewCard.tsx          # Lightweight static card (no hooks)
  │   ├── VotePreviewBar.tsx             # Lightweight CSS vote bar (no hooks)
  │   ├── StickyCtaBar.tsx               # Mobile sticky CTA (CLIENT COMPONENT)
  │   ├── DisclaimerBanner.tsx           # Collapsible regulatory disclaimer
  │   └── LandingFooter.tsx              # Footer with trust signals
  └── types.ts                           # Landing page data types

tests/unit/factories/
  └── landing-factory.ts                 # Test data factories for landing page
```

Backend changes:
```
app/services/debate/schemas.py             # Add ActiveDebateSummary schema (schemas are co-located here)
app/routes/debate.py                       # Add GET /api/debate/active endpoint
app/services/debate/repository.py          # Add get_active_debate() method
app/services/debate/cache.py               # Redis cache layer (if not existing)
```

### Server Action Pattern

**Pattern source:** Follow `features/debate/actions/debate-detail-action.ts` as the established pattern — it already uses `getApiBaseUrl()` with fetch for server-side data fetching.

```typescript
// features/landing/actions/landing-data-action.ts
"use server";
import { getApiBaseUrl } from "@/lib/api/config";
import { fetchWithTimeout } from "@/lib/api/server-action-helpers";
import type { LandingPageData } from "../types";

export async function getLandingPageData(): Promise<LandingPageData> {
  const baseUrl = getApiBaseUrl();

  let activeDebate = null;
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/debate/active`, {}, 10000);
    const json = await res.json();
    if (typeof json === "object" && json !== null && "data" in json) {
      activeDebate = json.data;
    }
  } catch {
    // Graceful degradation — hero/CTA render regardless
  }

  let recentDebates = [];
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/debate/history?status=completed&limit=3`,
      {},
      10000
    );
    const json = await res.json();
    if (typeof json === "object" && json !== null && "data" in json) {
      recentDebates = json.data?.debates ?? [];
    }
  } catch {
    // Graceful degradation — recent section renders empty
  }

  return { activeDebate, recentDebates };
}
```

### Anti-Patterns

- **DO NOT** use `"use client"` on `app/page.tsx` — must be a Server Component
- **DO NOT** create Next.js API routes for business logic — use server actions calling FastAPI
- **DO NOT** import Framer Motion in above-fold components — CSS only for hero and ticker
- **DO NOT** import `@xyflow/react`, React Query, Zustand, or WebSocket hooks on the landing page
- **DO NOT** import `DebateHistoryCard` or `DebateVoteBar` from `features/debate/` — use static preview variants
- **DO NOT** import `getApiBaseUrl()` from `features/debate/api/` — use `lib/api/config.ts`
- **DO NOT** use `border-white/10` — use `border-white/15` minimum for contrast
- **DO NOT** use `text-slate-500` — use `text-slate-400` or lighter
- **DO NOT** use large hero images or stock photos — "Glass Cockpit" is text + glow based
- **DO NOT** use FOMO triggers or "guru" aesthetics — scientific/clean design only
- **DO NOT** use `vi.fn()` or Vitest — use Jest 29 (`jest.fn()`, `jest.mock()`)
- **DO NOT** create a new layout for the landing page — reuse root `app/layout.tsx`
- **DO NOT** use `force-dynamic` export — use `revalidate = 30` for ISR

### Accessibility Requirements (MANDATORY per AGENTS.md)

Full checklist — ALL items must pass before story is marked complete:

- [ ] **Reduced Motion:** All CSS animations respect `@media (prefers-reduced-motion: reduce)`. When true: no pulse animation on LIVE badge, no stagger effects, gentle opacity fade-in only.
- [ ] **Skip-to-content link:** Present at top of page, links to `<main>`.
- [ ] **Touch Targets:** All interactive elements (CTA buttons, links, ticker) have minimum 44x44px hit area.
- [ ] **Contrast:** Text meets WCAG AA (4.5:1 normal, 3:1 large). Verified per-section against dark backgrounds.
- [ ] **Dual-Coding:** Never convey information by color alone. "LIVE" badge has both green pulse AND text label "LIVE".
- [ ] **Keyboard Navigation:** All CTAs reachable via Tab. Enter/Space activates buttons. Focus indicators visible.
- [ ] **Semantic HTML:** `<main>`, `<section>`, `<footer>` landmarks. Single `<h1>` in hero, `<h2>` for sections.
- [ ] **aria-live:** LiveNowTicker state changes announced via `aria-live="polite"`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-02, FR-17]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Glass Cockpit Theme, Anti-Patterns]
- [Source: _bmad-output/implementation-artifacts/4-3-static-debate-page-seo.md — Previous story patterns]

### Previous Story Intelligence (Story 4.3)

Key learnings from Story 4.3 (Static Debate Page):

| Finding | Impact on 4.4 |
|---------|---------------|
| `border-white/15` (NOT `/10`) for dark mode contrast | All landing page borders must follow this |
| `text-slate-400` minimum (NOT `text-slate-500`) | All secondary text follows this |
| Server Action pattern: `getApiBaseUrl()` with AbortController | Extracted to `lib/api/config.ts` — no cross-feature import |
| `safeToISOString()` helper for date formatting | Reuse if displaying debate timestamps |
| Response envelope validation | Same pattern, now in `lib/api/server-action-helpers.ts` |
| Test convention: Jest 29 + BDD naming + `[4.4-UNIT-NNN]` test IDs | Follow same test conventions |
| Component size limit: 300 lines max | Keep each section component focused |
| `TranscriptMessage` schema added to `vote_schemas.py` | Note for schema evolution if needed |
| `DebateHistoryCard` is Server Component, but imports `DebateVoteBar` (client) | Transitive client boundary — use static preview variants |
| Backend schemas co-located in `app/services/debate/schemas.py` | Add new schema THERE, not in `app/schemas/` |
| `ArchivedBadge` exists in `features/debate/components/` | Check if reusable for RecentDebatesSection |
| `SUPPORTED_ASSETS` defined in backend schemas | Reuse if showing asset-filtered content |

### Adversarial Review Findings — Triage Summary

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| W-1 | Critical | Full SSR won't hit LCP < 1.2s | ISR with `revalidate=30` |
| W-2 | Critical | `/api/debate/active` undefined contract | Full contract specified, Redis cache |
| W-3 | High | Component reuse = bundle bloat | Static preview variants created |
| W-4 | High | No CDN/edge caching | Cache-Control headers + ISR |
| W-5 | Medium | Font loading missing for LCP | Verified `next/font` display: swap |
| W-6 | Medium | No graceful degradation | try/catch + null fallback in server action |
| S-1 | Critical | Funnel asks commitment too early | Section order restructured |
| S-2 | Critical | Live ticker empty state = ghost town | 3-state ticker (Live/Scheduled/Empty) |
| S-3 | High | 5% disclaimer unusable | Collapsible banner + CTA cross-reference |
| S-4 | High | No mobile thumb zone / sticky CTA spec | StickyCtaBar component + thumb zone mapping |
| S-5 | High | Dark theme contrast per-section | Per-section contrast table added |
| S-6 | Medium | "Cognitive Offloading" is jargon | Outcome-focused copy direction |
| S-7 | Medium | No loading state spec | Server/client island pattern documented |
| S-8 | Medium | SEO metadata content missing | Full metadata content specified |
| S-9 | Low | Footer underspecified | Full footer specification |
| A-1 | Critical | `getApiBaseUrl()` cross-feature import | Extract to `lib/api/config.ts` (Task 0) |
| A-2 | Critical | No "no active debate" response contract | `200 { data: null }` specified |
| A-3 | Critical | Server/client boundary undocumented | Boundary map added |
| A-4 | High | DebateVoteBar pulls React Query + WS | Static VotePreviewBar created |
| A-5 | High | No timeout fallback for server action | Graceful degradation in AC-9 |
| A-6 | High | Race condition debate completion | Response includes `status` field |
| A-7 | High | No reduced-motion test task | Added to Task 6.8 |
| A-8 | Medium | Integration test missing | Task 6.7 added |
| A-9 | Medium | No loading state test | Added to Task 6.4 sub-cases |
| A-10 | Medium | Style guard tests missing | Task 6.11 added |
| A-11 | Medium | Component line count not verified | Added to Task 2.11 |
| A-12 | Low | Task ordering wrong | Task 7 dependency order added |
| A-13 | Low | No E2E test | Task 6.10 added |
| A-14 | Low | DebateHistoryCard may not handle active status | Static DebatePreviewCard created instead |
| M-1 | Critical | LCP has zero test coverage | Task 6.9 Lighthouse CI budget |
| M-2 | High | No integration test server action↔backend | Task 6.7 |
| M-3 | High | Server action edge cases missing | Task 6.4 expanded with sub-cases |
| M-4 | High | Accessibility testing underdefined | Task 6.8 covers full checklist |
| M-5 | Medium | Backend edge cases untested | Task 6.6 expanded |
| M-6 | Medium | No E2E metadata verification | Task 6.10 |
| M-7 | Medium | Test data factories missing | Task 6.12 |
| M-8 | Low | No visual regression test | Noted as follow-up story |

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Composite Landing Endpoint & Bug Fixes (2026-04-15, Session 2)

Multi-agent roundtable review (Winston, Amelia, Murat, Sally) identified 5 bugs + 8 follow-up items. All resolved.

#### Bugs Fixed

- [x] **Lesson #10 rounding bug:** `DebatePreviewCard.tsx` rounded both `bullPct` and `bearPct` independently → could sum to 101%. Fixed: `bearPct = Math.max(0, 100 - bullPct - undecidedPct)` [`DebatePreviewCard.tsx:18`]
- [x] **Non-null assertion crash:** `LiveNowTicker.tsx:30` used `activeDebate!.id` — crash on state desync. Fixed with `activeDebate &&` guard [`LiveNowTicker.tsx:28`]
- [x] **Sequential fetches:** Server action fetched active then recent sequentially → wasted TTFB. Fixed with `Promise.all` → then replaced with composite endpoint
- [x] **Redis singleton race condition:** `cache.py` had no lock on module-level singleton. Fixed with `asyncio.Lock` double-checked locking [`cache.py:16-27`]
- [x] **`get_filtered_debates(status=...)` bug:** `landing.py:71` passed non-existent `status` kwarg. Method already hardcodes `Debate.status == "completed"`. Also fixed tuple unpacking (`recent_debates, _ = ...`) [`landing.py:71`]

#### Follow-up Items Completed

- [x] CTA copy: "Ready to Watch?" → "Pick a Side." + "Enter the Arena" → "Start Your First Debate" [`page.tsx`, `StickyCtaBar.tsx`]
- [x] Footer dead links: created 4 legal pages — `app/terms/`, `app/privacy/`, `app/risk-disclosure/`, `app/contact/`
- [x] Scheduled ticker: "coming soon" → warm empty-state with "Start one" CTA [`LiveNowTicker.tsx`]
- [x] Hero icons: replaced minimal circles with Bull (horns/face) and Bear (claws/face) SVG silhouettes [`HeroSection.tsx`]
- [x] Schema contract test — `tests/unit/landing/schema-contract.test.ts` (7 tests)
- [x] Composite `/api/landing` endpoint — `app/routes/landing.py` + registered in `app/main.py`
- [x] Server action rewritten to single `/api/landing` fetch [`landing-data-action.ts`]
- [x] Cache TTL cascade documentation — comment in `cache.py`
- [x] Lighthouse budget warning at 90% — `lighthouse-budget.json`

#### Test Updates

- [x] Rewrote `landing-data-action.test.ts` from dual-fetch to single-fetch (7 tests)
- [x] Rewrote `landing-data-action.edge.test.ts` from dual-fetch to single-fetch (6 tests)
- [x] Updated `StickyCtaBar.test.tsx` assertion: `"Enter the Arena"` → `"Pick a Side"`
- [x] Updated `LiveNowTicker.test.tsx` assertion: `/Next debate scheduled/` → `/No upcoming debates right now/`
- [x] Updated `RecentDebatesSection.test.tsx` for warm empty-state CTA
- [x] Removed unused `bearVotes` variable from `DebatePreviewCard.tsx`

**Quality gates:** 143/143 tests passing, ruff clean.

### Review Findings (2026-04-15)

#### Decision-Needed

- [x] [Review][Decision] Status mismatch: backend `"running"` vs frontend `"active"` — Resolved: backend maps `"running"` → `"active"` via `field_serializer` on `ActiveDebateSummary.status`. Frontend unchanged. Tests updated.
- [x] [Review][Decision] Missing `og:image` and `twitter:image` in generateMetadata() — Resolved: added placeholder `/images/og-default.png` + test assertions. Follow-up task needed for design asset.

#### Patch

- [x] [Review][Patch] Dead code: remove unreachable return statements in cache-hit branch [`debate.py:202-214`]
- [x] [Review][Patch] Redis null cache sentinel ineffective — replaced with `__null_sentinel__` string sentinel [`cache.py:35`]
- [x] [Review][Patch] Redis connection leak — module-level connection pool with shared client [`cache.py:14-15`]
- [x] [Review][Patch] No Redis connection pooling — `_redis_pool` module-level singleton [`cache.py:14-15`]
- [x] [Review][Patch] Undecided votes absorbed into bearPct — now computed from `voteBreakdown.bear` independently [`DebatePreviewCard.tsx:13-14`]
- [x] [Review][Patch] Silent error swallowing — added `console.error` logging in all catch blocks [`landing-data-action.ts`]
- [x] [Review][Patch] `text-slate-500` in CTA risk disclosure link — changed to `text-slate-400` [`page.tsx:80`]
- [x] [Review][Patch] `text-slate-500` in footer tagline — changed to `text-slate-400` [`LandingFooter.tsx:9`]
- [x] [Review][Patch] `<h3>` elements in HowItWorksSection — changed to `<p>` with same styling [`HowItWorksSection.tsx:21,35,49`]
- [x] [Review][Patch] Corrupted Redis cache — wrapped in try/except with graceful fallback to None [`debate.py:196`]
- [x] [Review][Patch] `totalVotes || 1` falsy coalescing — split into `displayVotes` and `totalVotes` with proper pluralization [`DebatePreviewCard.tsx:11,53`]

### Test Automation Expansion (2026-04-15)

Expanded test coverage from 120 → 177 tests (+57 new). 7 new test files + 1 bug fix.

**New test files:**

| File | Tests | Target |
|------|-------|--------|
| `tests/unit/landing/server-action-helpers.test.ts` | 17 | `fetchWithTimeout` + `isValidEnvelope` — shared utilities with 0 prior tests |
| `tests/unit/landing/DebatePreviewCard.edge.test.tsx` | 11 | Zero-votes, rounding, winner colors, touch targets |
| `tests/unit/landing/VotePreviewBar.edge.test.tsx` | 7 | Extremes (0/100%), undecided prop, styling classes |
| `tests/unit/landing/LiveNowTicker.edge.test.tsx` | 9 | Unknown status → empty, state exclusion, aria-hidden, asset uppercase |
| `tests/unit/landing/landing-data-action.edge.test.ts` | 7 | Error logging, URL verification, non-array data guard |
| `tests/services/debate/test_active_debate_cache.py` | 11 | Redis get/set/null sentinel/error paths/singleton/TTL |
| `tests/services/debate/test_active_debate_schema.py` | 8 | Status mapping (`running`→`active`), camelCase aliases, null viewerCount |

**Bug fixed:** `VotePreviewBar.test.tsx` — existing test expected 3 children without passing `undecidedPct` prop (component doesn't auto-calculate undecided from bull+bear). Fixed to pass explicit prop.

**Coverage gaps addressed:**
- P0: `fetchWithTimeout` and `isValidEnvelope` (shared utilities used across features)
- P0: Redis cache module (`cache.py`) — null sentinel, error handling, singleton pattern
- P1: `DebatePreviewCard` computation edge cases — zero-votes, percentage rounding (AGENTS.md lesson #10)
- P1: `LiveNowTicker` state machine completeness — unknown status fallback
- P1: `ActiveDebateSummary` schema — status serializer, camelCase aliases
- P1: Server action — console.error verification, endpoint URL assertions

### Test Quality Review (2026-04-15)

**Score:** 82/100 (A — Good) | **Recommendation:** Approve with Comments

**Review scope:** 24 files, 177 tests (Frontend Unit, Backend Unit, Integration, E2E)

**Key strengths:**
- Excellent data factory pattern (`landing-factory.ts`) with spread overrides
- Comprehensive edge-case files for DebatePreviewCard, VotePreviewBar, LiveNowTicker, server action
- Strong accessibility testing — jest-axe on every section, aria-live, dual-coding, heading hierarchy
- Proper test isolation — fetch mock restore, Redis pool reset, DOM cleanup
- Backend uses real PostgreSQL fixtures (per AGENTS.md lesson #7)

**Follow-up items addressed (this commit):**
- [x] Adopted BDD Given-When-Then naming across all 19 frontend test files
- [x] Extracted IntersectionObserver mock to shared fixture (`tests/unit/fixtures/intersection-observer.ts`)
- [x] Removed confusing `createRecentDebateSummary` wrapper from `LiveNowTicker.edge.test.tsx`

**Full report:** `_bmad-output/test-artifacts/test-review-story-4-4.md`
