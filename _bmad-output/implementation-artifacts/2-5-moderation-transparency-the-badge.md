# Story 2.5: Moderation Transparency (The Badge)

Status: review

## Story

As a User,
I want to see a clear visual indicator when a debate message has been safety-filtered,
So that I trust the platform is being transparent about content modifications.

## Acceptance Criteria

1. **Given** a `DEBATE/ARGUMENT_COMPLETE` message with `isRedacted: true` **When** it is displayed in the debate chat **Then** a "Safety Filtered" indicator with a shield icon is visible below the message content, within the bubble, as a secondary metadata footer — NOT next to the agent name/timestamp

2. **Given** the "Safety Filtered" indicator on desktop (viewport >= 640px) **When** hovered or focused via keyboard **Then** a tooltip appears with the text "Part of this message was removed by our safety system"

3. **Given** the "Safety Filtered" indicator on mobile (viewport < 640px) **When** displayed **Then** the explanation text "Part of this message was removed by our safety system" is always visible inline below the shield icon — no tooltip interaction required

4. **Given** a message with `isRedacted: false` or no `isRedacted` field **When** displayed **Then** no "Safety Filtered" indicator appears and the message renders normally

5. **Given** the "Safety Filtered" indicator **When** rendered **Then** it uses a muted violet treatment (`violet-600/20` background, `violet-400` text) that is visually subordinate to the existing `[REDACTED]` inline spans (`purple-500/20`, `purple-300`, `purple-500/30`) to avoid purple signal overload — the badge is secondary metadata, the inline `[REDACTED]` spans are the primary visual signal

6. **Given** a "Safety Filtered" indicator in the DOM **When** a screen reader encounters it **Then** it has an `aria-label` (e.g., `aria-label="This message was filtered by the safety system"`) — WCAG AA compliance, no visual-only information. Do NOT use `role="status"` (avoids live region announcement conflicts during rapid message streaming)

7. **Given** the tooltip on desktop **When** displayed **Then** it is dismissible via Escape key and supports `prefers-reduced-motion` for any entrance animation

8. **Given** the `ArgumentBubble` component **When** `isRedacted` prop is `true` **Then** the badge is shown based solely on the `isRedacted` prop — NO string-based fallback for badge visibility. The existing `content.includes("[REDACTED]")` detection is retained ONLY for `renderContent` (inline `[REDACTED]` span rendering) and content div `aria-label` logic — these are separate concerns from the badge

9. **Given** the `ArgumentMessage` type in `DebateStream.tsx` **When** constructed from `ArgumentPayload` **Then** the `isRedacted` field is preserved (not discarded). The `redactedPhrases` field is NOT carried forward — no current consumer exists for it

10. **Given** the `TooltipProvider` from Radix **When** the app renders **Then** it wraps the debate feature at the nearest stable ancestor (layout level), NOT inside `DebateStream` — `DebateStream` re-renders on every WebSocket message and is unsuitable as a context provider host

## Tasks / Subtasks

- [x] Install Shadcn Tooltip component (AC: #2, #7)
  - [x] Run `npx shadcn@latest add tooltip` to add `@radix-ui/react-tooltip` and `components/ui/tooltip.tsx` (NOTE: use `shadcn` not `shadcn-ui` — v2 CLI)
  - [x] Verify `components/ui/tooltip.tsx` is created and exports `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

- [x] Add `TooltipProvider` to layout level (AC: #10)
  - [x] Add `<TooltipProvider>` to the nearest stable layout ancestor of `DebateStream` (e.g., the debate page layout or app layout), NOT inside `DebateStream.tsx`
  - [x] Scope: wraps the debate feature area only — not the entire app

- [x] Add `isRedacted` to `ArgumentMessage` type (AC: #9)
  - [x] In `DebateStream.tsx`: add `isRedacted?: boolean` to the `ArgumentMessage` interface (NO `redactedPhrases`)
  - [x] In `handleArgumentComplete`: map `payload.isRedacted` from `ArgumentPayload` into the new `ArgumentMessage`

- [x] Update `ArgumentBubbleProps` and component (AC: #1, #4, #5, #6, #8)
  - [x] Add `isRedacted?: boolean` to `ArgumentBubbleProps` (NO `redactedPhrases`)
  - [x] Keep the existing `const hasRedactedContent = content.includes("[REDACTED]")` for `renderContent` and content div aria-label — this is NOT deprecated, it serves a different purpose (inline span rendering) than the badge
  - [x] Add badge logic: `const showBadge = isRedacted === true` — prop-only, no string fallback for badge visibility
  - [x] Add "Safety Filtered" indicator BELOW the message content div (after the content `</div>`), NOT in the agent/timestamp header row — this separates agent identity from moderation action
  - [x] Badge structure: a `div` with `flex items-center gap-1.5 mt-1.5` containing shield icon + "Safety Filtered" text
  - [x] Badge styling: `inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-violet-600/20 text-violet-400 rounded-md` — muted treatment, visually subordinate to inline `[REDACTED]` spans
  - [x] Desktop: wrap badge in `<Tooltip>` / `<TooltipTrigger>` / `<TooltipContent>` — tooltip text: "Part of this message was removed by our safety system"
  - [x] Mobile: render the explanation text inline below the badge, hidden on desktop (`sm:hidden`). Desktop tooltip shown only on `sm:` and above
  - [x] Add `aria-label="This message was filtered by the safety system"` to the badge container — do NOT use `role="status"`
  - [x] Ensure badge container is keyboard focusable for tooltip trigger on desktop (use `<span tabIndex={0}>` or `asChild` with a focusable element)

- [x] Wire `isRedacted` through `DebateStream` (AC: #9)
  - [x] In `DebateStream.tsx`: pass `isRedacted` prop from `ArgumentMessage` to `<ArgumentBubble>` component
  - [x] Verify the data flows: WebSocket → `useDebateSocket` callback → `handleArgumentComplete` → `ArgumentMessage` state → `ArgumentBubble` props
  - [x] The streaming bubble (line ~335-340) does NOT receive `isRedacted` — this is correct. Streaming messages are not yet complete and should not show the badge. The badge appears only on the final `DEBATE/ARGUMENT_COMPLETE` message

- [x] Write component tests (Jest + RTL) (AC: #1-#10)
  - [x] `[2-5-COMP-001]` @p0 `ArgumentBubble` with `isRedacted={true}` renders "Safety Filtered" indicator with shield icon below content
  - [x] `[2-5-COMP-002]` @p0 `ArgumentBubble` with `isRedacted={false}` does NOT render indicator
  - [x] `[2-5-COMP-003]` @p0 `ArgumentBubble` with no `isRedacted` prop (undefined) does NOT render indicator (backward compat)
  - [x] `[2-5-COMP-004]` @p0 Indicator has `aria-label` for screen reader accessibility, no `role="status"`
  - [x] `[2-5-COMP-005]` @p0 Hovering/focusing badge shows tooltip with exact text "Part of this message was removed by our safety system"
  - [x] `[2-5-COMP-006]` @p0 Mobile inline explanation text is present in DOM and matches expected copy
  - [x] `[2-5-COMP-007]` @p0 Tooltip dismisses on Escape key press
  - [x] `[2-5-COMP-008]` @p1 Badge is keyboard focusable with visible focus ring
  - [x] `[2-5-COMP-009]` @p0 `renderContent` still uses string detection for `[REDACTED]` spans — existing redacted content rendering unaffected
  - [x] `[2-5-COMP-010]` @p0 `ArgumentBubble` with `isRedacted={true}` but content without `[REDACTED]` string renders badge without inline spans (handles backend inconsistency gracefully)
  - [x] `[2-5-COMP-011]` @p1 Indicator does NOT appear in the agent name/timestamp header row (placement regression check)

- [x] Write integration tests (AC: #2, #7, #9)
  - [x] `[2-5-INT-001]` @p0 Full flow: `handleArgumentComplete` with `isRedacted: true` constructs `ArgumentMessage` with field preserved
  - [x] `[2-5-INT-002]` @p0 `DebateStream` renders `ArgumentBubble` with `isRedacted` prop when message has field
  - [x] `[2-5-INT-003]` @p1 Streaming message rendered via `ArgumentBubble` without `isRedacted` — no badge during streaming, badge appears on complete message
  - [x] `[2-5-INT-004]` @p1 Multiple redacted messages rendered — only one tooltip visible at a time (concurrent state check)

- [x] Write E2E tests (Playwright) (AC: #1, #2, #5)
  - [x] `[2-5-E2E-001]` @p0 Redacted argument message shows "Safety Filtered" indicator in the debate stream
  - [x] `[2-5-E2E-002]` @p0 Non-redacted messages have no indicator element
  - [x] `[2-5-E2E-003]` @p1 Viewport overflow: badge near bottom of visible area, tooltip renders without clipping (use constrained viewport height)
  - [x] `[2-5-E2E-004]` @p1 Mobile viewport: inline explanation text visible without tooltip interaction

## Dev Notes

### This is a Frontend-Only Story

Story 2.4 (Forbidden Phrase Filter) already implemented the complete backend data contract. The `DEBATE/ARGUMENT_COMPLETE` WebSocket payload already includes:
- `isRedacted: boolean` — `true` when content was redacted by the safety-net filter
- `redactedPhrases: string[]` — list of specific phrases that were redacted (available in backend payload but NOT consumed by this story)

These fields are defined in `ws_schemas.py` (`ArgumentCompletePayload`) and serialized via Pydantic `by_alias=True` as `isRedacted` / `redactedPhrases` (camelCase) in the WebSocket JSON.

The `useDebateSocket.ts` hook already has `isRedacted?: boolean` in its `ArgumentPayload` interface. The data arrives at the frontend but is currently discarded at the `ArgumentMessage` construction step.

### Critical: The Data Flow Gap

This is the core issue this story fixes. The `isRedacted` field's current journey:

```
Backend (ws_schemas.py) → WebSocket JSON → useDebateSocket (ArgumentPayload) → ✅ ARRIVES HERE
  → handleArgumentComplete() → ArgumentMessage ❌ DISCARDED HERE
  → ArgumentBubble ❌ NEVER RECEIVED
```

**Current broken state:**
- `ArgumentMessage` in `DebateStream.tsx` (lines 28-34) has no `isRedacted` field
- `handleArgumentComplete` (lines 91-105) constructs `ArgumentMessage` without `isRedacted`
- `ArgumentBubble` detects redaction via string matching: `content.includes("[REDACTED]")`

**Target state:**
- `ArgumentMessage` includes `isRedacted?: boolean` only
- `handleArgumentComplete` maps `isRedacted` from `ArgumentPayload`
- `ArgumentBubble` uses `isRedacted` prop for badge visibility; existing string detection retained for `renderContent`

### Separation of Concerns: Badge vs. Inline Redaction

There are **two separate redaction concerns** in `ArgumentBubble`. Do NOT conflate them:

1. **Inline `[REDACTED]` span rendering** — handled by `renderContent()` using `content.includes("[REDACTED]")`. This detects `[REDACTED]` tokens in the content string and renders them as purple inline spans. This is correct and must NOT be changed. It serves the content rendering layer.

2. **Badge/indicator visibility** — handled by the new `isRedacted` prop. This is a metadata signal from the backend that the message was filtered. The badge appears below the content as secondary information. This is the new behavior.

The `hasRedactedContent` variable (currently `const isRedacted = content.includes("[REDACTED]")`) must be RENAMED to `hasRedactedContent` to avoid naming confusion with the new `isRedacted` prop. It continues to drive `renderContent` and the content div's `aria-label`. The new `showBadge` variable drives badge visibility from the prop only.

```tsx
// CLEAR SEPARATION:
const hasRedactedContent = content.includes("[REDACTED]"); // for renderContent + aria
const showBadge = isRedacted === true;                      // for badge indicator
```

### Why No String Fallback for Badge

The original story proposed: use `isRedacted` prop when available, fallback to `content.includes("[REDACTED]")` during streaming. This was removed because:

1. **Streaming messages haven't been redacted yet** — redaction happens server-side before `ARGUMENT_COMPLETE`. During token streaming, the content is incomplete. The `isRedacted` flag correctly arrives only with the complete message.

2. **Fallback hides real bugs** — if the backend sends `[REDACTED]` in content without setting `isRedacted: true`, that's a backend data inconsistency that should be surfaced, not wallpapered over in the UI.

3. **Flicker risk** — partial tokens during streaming could cause string detection to flicker (`[REDACT` → false → `[REDACTED]` → true).

### Why No `redactedPhrases`

The `redactedPhrases: string[]` field is available in the backend payload but is excluded from this story because:

1. **No current consumer** — the tooltip text is a static explanation string, not a list of specific phrases
2. **Dual source of truth risk** — carrying both `redactedPhrases` array AND inline `[REDACTED]` tokens in content creates a desync hazard. If phrase count ≠ token count, rendering breaks silently
3. **YAGNI** — when a future story needs to display *which* phrases were redacted, add `redactedPhrases` then. The backend already sends it, so adding it later costs nothing

### Badge Placement: Message Footer, Not Header

The indicator is placed **below the message content** as a footer, NOT in the agent name/timestamp header row. Reasons:

1. **Semantic separation** — moderation acts on *content*, not on the *agent*. Placing the badge next to the agent name creates a false visual association between the agent's identity and the moderation action
2. **Information hierarchy** — the badge is secondary metadata (like a footnote), not primary identity information
3. **Visual clarity** — the header row already contains agent name + timestamp. Adding a badge creates a crowded, ambiguous header

### Shield Icon for the Badge

The badge uses a small shield SVG icon to maintain consistency with the guardian theme. The `DebateStream.tsx` guardian messages already use an inline shield SVG (lines 304-306). Extract or replicate a similar small shield for the badge.

**Consider extracting `ShieldIcon` as a shared component** in `trade-app/nextjs-frontend/features/debate/components/ShieldIcon.tsx` — the guardian messages in `DebateStream.tsx` and this badge both use shield SVGs. Avoiding duplication keeps the icon consistent if it changes later. If extracted, add to the debate components barrel export.

**Shield SVG for badge** (smaller variant):
```tsx
<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
</svg>
```

### Badge Styling — Muted Treatment

The `GuardianOverlay.tsx` establishes the badge pattern with `violet-600/30` background. This story uses a **more muted variant** because the badge is secondary metadata, not a primary call-to-action:

```
Desktop badge classes:
inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-violet-600/20 text-violet-400 rounded-md cursor-help

Mobile inline explanation classes:
text-xs text-violet-400/80 mt-0.5
```

The existing `[REDACTED]` inline spans (`purple-500/20`, `purple-300`, `purple-500/30`) remain the **primary** visual signal for redaction. The badge is the **secondary** signal providing context. This hierarchy avoids purple overload.

### Mobile: No Tooltip — Always-Visible Inline Explanation

Radix Tooltip supports pointer-down on touch devices, but tooltips on mobile are an anti-pattern:
- Small text is hard to read near a finger
- Tooltip position can be obscured by the user's hand
- Discoverable only by accidental tap
- Competes with scroll gestures

**Solution:** On mobile (< `sm` breakpoint), the explanation text "Part of this message was removed by our safety system" is always visible inline below the shield icon. No interaction required. The tooltip component is used on desktop only (`hidden sm:inline-flex` for the tooltip wrapper, `sm:hidden` for the mobile inline text).

### Tooltip Installation

The Shadcn Tooltip component needs to be installed:
```bash
npx shadcn@latest add tooltip
```

**IMPORTANT:** Use `shadcn` (v2 CLI), NOT `shadcn-ui` (v1, deprecated). The project already has `components.json` configured at `trade-app/nextjs-frontend/components.json` and 15 existing UI components in `trade-app/nextjs-frontend/components/ui/`. If `components/ui/tooltip.tsx` already exists from a prior install, the CLI will prompt to overwrite — check first.

This installs `@radix-ui/react-tooltip` and creates `components/ui/tooltip.tsx`. The Radix tooltip supports:
- Hover trigger (desktop)
- Focus trigger (keyboard)
- Escape key dismiss
- `prefers-reduced-motion` support via Radix internals

### TooltipProvider Placement — Layout Level, NOT DebateStream

`DebateStream` re-renders on every WebSocket message (token stream, argument complete, guardian interrupt). Placing `TooltipProvider` inside it re-creates the context on every re-render, which is a performance concern and architecturally wrong.

Place `TooltipProvider` in the nearest **stable** layout ancestor. The debate feature renders under `trade-app/nextjs-frontend/app/dashboard/layout.tsx` — this is the correct location. Wrap the `<section className="grid gap-6">{children}</section>` with `<TooltipProvider>`.

Set `delayDuration={300}` on `<TooltipProvider>` for faster tooltip appearance (Radix default is 700ms, which feels sluggish on an interactive element).

### Key Integration Points

**`DebateStream.tsx` — `ArgumentMessage` interface (lines 28-34):**
```ts
// CURRENT:
export interface ArgumentMessage {
  id: string;
  type: "argument";
  agent: AgentType;
  content: string;
  timestamp: string;
}

// TARGET:
export interface ArgumentMessage {
  id: string;
  type: "argument";
  agent: AgentType;
  content: string;
  timestamp: string;
  isRedacted?: boolean;
}
```

**`DebateStream.tsx` — `handleArgumentComplete` (lines 91-105):**
```ts
// CURRENT (line 92-98):
const msg: ArgumentMessage = {
  id: generateId(),
  type: "argument",
  agent: payload.agent,
  content: payload.content,
  timestamp: new Date().toISOString(),
};

// TARGET:
const msg: ArgumentMessage = {
  id: generateId(),
  type: "argument",
  agent: payload.agent,
  content: payload.content,
  timestamp: new Date().toISOString(),
  isRedacted: payload.isRedacted,
};
```

**`DebateStream.tsx` — ArgumentBubble rendering (lines 313-317):**
```tsx
// CURRENT:
<ArgumentBubble
  agent={msg.agent}
  content={msg.content}
  timestamp={msg.timestamp}
/>

// TARGET:
<ArgumentBubble
  agent={msg.agent}
  content={msg.content}
  timestamp={msg.timestamp}
  isRedacted={msg.isRedacted}
/>
```

**Streaming bubble (lines 334-343) — NO CHANGE needed:**
```tsx
// This correctly does NOT pass isRedacted — streaming messages are incomplete
<ArgumentBubble
  agent={currentAgent}
  content={streamingText}
  timestamp={new Date().toISOString()}
  isStreaming
/>
```

**`ArgumentBubble.tsx` — Updated props and logic:**
```tsx
interface ArgumentBubbleProps {
  agent: AgentType;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  isRedacted?: boolean;
}

export function ArgumentBubble({ agent, content, timestamp, isStreaming, isRedacted }: ArgumentBubbleProps) {
  const isBull = agent === "bull";
  const hasRedactedContent = content.includes("[REDACTED]"); // for renderContent only
  const showBadge = isRedacted === true;                      // for badge only

  return (
    <motion.div ...>
      <AgentAvatar agent={agent} />
      <div className="flex-1 min-w-0">
        {/* Header row — agent name + timestamp ONLY, no badge */}
        <div className={cn("flex items-center gap-2 mb-1", ...)}>
          <span ...>{isBull ? "Bull" : "Bear"}</span>
          <span data-testid="argument-timestamp" ...>{formatTime(timestamp)}</span>
        </div>

        {/* Content */}
        <div
          role={hasRedactedContent ? "text" : undefined}
          aria-label={hasRedactedContent ? "Debate argument containing filtered phrases for safety compliance" : undefined}
          className="text-slate-200 text-base leading-relaxed break-words"
        >
          {renderContent(content, hasRedactedContent)}
          {isStreaming && <span data-testid="streaming-cursor" ... />}
        </div>

        {/* Safety filtered indicator — BELOW content, as footer */}
        {showBadge && (
          <div className="mt-1.5">
            {/* Desktop: badge with tooltip */}
            <div className="hidden sm:block">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span
                    data-testid="safety-filtered-badge"
                    tabIndex={0}
                    aria-label="This message was filtered by the safety system"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-violet-600/20 text-violet-400 rounded-md cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                  >
                    <ShieldIcon />
                    Safety Filtered
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Part of this message was removed by our safety system.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {/* Mobile: always visible inline */}
            <div className="sm:hidden flex items-start gap-1.5 text-xs text-violet-400/80">
              <ShieldIcon />
              <span>Safety Filtered — Part of this message was removed by our safety system.</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

### Accessibility Requirements

- Badge has `aria-label` — screen readers announce the filtering status. Do NOT use `role="status"` (live region would cause disruptive announcements during rapid message streaming)
- Tooltip content accessible via focus (keyboard Tab to badge → tooltip appears)
- Tooltip dismisses on Escape key (Radix default behavior)
- Focus ring visible on badge via `focus-visible:ring-2` classes
- `prefers-reduced-motion`: Radix Tooltip respects this for animation — verify in test
- No visual-only information — badge has icon AND text label (dual-coding per UX spec)
- Mobile explanation is always visible text — no interaction required, fully accessible
- DOM order: content renders before badge — screen readers encounter the message first, then the filtering metadata

### Edge Case: `isRedacted: true` But No `[REDACTED]` in Content

If the backend sets `isRedacted: true` but the content string contains no `[REDACTED]` tokens, the badge will appear (prop says filtered) but the inline `[REDACTED]` spans won't render (no tokens to split on). The user sees a badge saying "Safety Filtered" on apparently normal text.

This is a **backend data inconsistency** — the flag and the content should always agree. The UI handles it gracefully: badge shows, content renders as-is. Do NOT attempt to "fix" this in the UI. Log a warning if desired, but the fix belongs in the backend.

### Architecture Compliance

- **Frontend-only story:** No backend changes needed. The WS payload contract is complete from Story 2.4.
- **Component Structure:** Badge and tooltip live inside `ArgumentBubble.tsx` — no new component files needed
- **Naming:** `isRedacted` (camelCase) in TypeScript matches the WS JSON key. No `redactedPhrases` in frontend types.
- **State Management:** No Zustand or React Query needed — data flows through existing component props
- **Testing:** Jest 29 + RTL for component tests, Playwright for E2E. Use `jest.fn()` and `jest.mock()` — never `vi.fn()`.
- **Barrel exports:** If `ShieldIcon` is extracted as a named export, add to `index.ts`

### Previous Story Intelligence

**From Story 2-4 (Forbidden Phrase Filter):**
- Backend sends `isRedacted: boolean` and `redactedPhrases: string[]` in `DEBATE/ARGUMENT_COMPLETE`
- `ArgumentPayload` in `useDebateSocket.ts` already has `isRedacted?: boolean`
- `ArgumentBubble.tsx` already renders `[REDACTED]` spans with purple styling and ARIA labels
- `ArgumentBubbleRedacted.test.tsx` has 10 existing tests for redacted content — DO NOT REMOVE
- `useDebateSocketRedacted.test.ts` has 5 existing tests — DO NOT REMOVE
- The `[REDACTED]` inline styling uses `purple-500/20` bg, `purple-300` text, `purple-500/30` border

**From Story 2-3 (Guardian UI Overlay):**
- `GuardianOverlay.tsx` establishes the badge pattern with `violet-600` styling
- Guardian messages in `DebateStream.tsx` use `violet-600/20` background
- The "Freeze" modal uses Violet-600 as primary color for guardian elements

**From Story 2-1 (Guardian Agent Logic):**
- The guardian is thematically tied to violet/purple colors throughout the app
- The badge follows this same visual language but with a muted treatment to avoid overload

### Scope Boundary

**DO NOT modify:**
- Backend files (data contract is complete from Story 2.4)
- `useDebateSocket.ts` hook logic (it already passes `isRedacted` through — the hook is correct)
- `sanitization.py`, `engine.py`, `ws_schemas.py`, `streaming.py` — all backend
- Existing tests in `ArgumentBubbleRedacted.test.tsx` and `useDebateSocketRedacted.test.ts`
- `guardian.py`, `bull.py`, `bear.py`
- The `renderContent` function's string-based `[REDACTED]` detection — this is correct and separate from badge logic

**This story touches:**
- `DebateStream.tsx` — add `isRedacted` to `ArgumentMessage`, pass to `ArgumentBubble`
- `ArgumentBubble.tsx` — add `isRedacted` prop, add Safety Filtered indicator below content, add desktop tooltip + mobile inline text, rename `isRedacted` variable to `hasRedactedContent`
- `trade-app/nextjs-frontend/app/dashboard/layout.tsx` — add `TooltipProvider` import and wrapper
- NEW: `components/ui/tooltip.tsx` — installed via Shadcn CLI
- NEW: Test files for badge/tooltip behavior

### File List (Planned)

**MODIFY:**
- `trade-app/nextjs-frontend/features/debate/components/ArgumentBubble.tsx` — add `isRedacted` prop, add Safety Filtered indicator with desktop tooltip + mobile inline text, rename `isRedacted` variable to `hasRedactedContent`
- `trade-app/nextjs-frontend/features/debate/components/DebateStream.tsx` — add `isRedacted` to `ArgumentMessage`, pass through in `handleArgumentComplete`, pass new prop to `ArgumentBubble`
- `trade-app/nextjs-frontend/app/dashboard/layout.tsx` — add `TooltipProvider` wrapper around the `<section>` content area

**NEW (via CLI):**
- `trade-app/nextjs-frontend/components/ui/tooltip.tsx` — Shadcn Tooltip component

**NEW (tests):**
- `trade-app/nextjs-frontend/tests/unit/ArgumentBubbleSafetyBadge.test.tsx` — component tests for badge rendering, tooltip, accessibility, mobile pattern
- `trade-app/nextjs-frontend/tests/e2e/debate-safety-badge.spec.ts` — E2E tests for badge visibility and viewport behavior

### References

- [Source: epics.md#Story 2.5 — Moderation Transparency (The Badge)]
- [Source: prd.md#FR-09 — Moderation Transparency]
- [Source: ux-design-specification.md#Safety is Loud — Risk warnings must be visually distinct]
- [Source: ux-design-specification.md#Trust Framing — Frame success as "Risk Avoided"]
- [Source: ux-design-specification.md#Color System — Guardian Violet-600, ambient logic]
- [Source: ux-design-specification.md#Accessibility — Dual-Coding for Color, WCAG AA, Motion Safety]
- [Source: ux-design-specification.md#Mobile-First — Portrait Mode, Thumb Zone]
- [Source: architecture.md#Communication Patterns — WebSocket Actions with camelCase payload]
- [Source: architecture.md#The "Border Control" Pattern — camelCase in frontend]
- [Source: 2-4-forbidden-phrase-filter-regex.md — Backend `isRedacted` and `redactedPhrases` implementation]
- [Source: ArgumentBubble.tsx — Current `[REDACTED]` rendering with purple styling, `renderContent` function]
- [Source: ArgumentBubble.tsx:50 — `const isRedacted = content.includes("[REDACTED]")` — rename to `hasRedactedContent`]
- [Source: DebateStream.tsx:28-34 — `ArgumentMessage` interface missing `isRedacted`]
- [Source: DebateStream.tsx:91-105 — `handleArgumentComplete` discards `isRedacted` from payload]
- [Source: DebateStream.tsx:313-317 — `ArgumentBubble` rendering without `isRedacted` prop]
- [Source: DebateStream.tsx:335-340 — Streaming bubble correctly omits `isRedacted`]
- [Source: useDebateSocket.ts:12-18 — `ArgumentPayload` with `isRedacted?: boolean` already defined]
- [Source: GuardianOverlay.tsx:92-96 — Badge pattern with `violet-600/30` styling precedent]
- [Source: GuardianOverlay.tsx — File: trade-app/nextjs-frontend/features/debate/components/GuardianOverlay.tsx]
- [Source: dashboard/layout.tsx — File: trade-app/nextjs-frontend/app/dashboard/layout.tsx — TooltipProvider placement target]
- [Source: components.json — File: trade-app/nextjs-frontend/components.json — Shadcn config already initialized]
- [Source: project-context.md — Jest 29, RTL, strict TypeScript, WCAG AA]

### Adversarial Review Changelog

Updated following party-mode adversarial review (Winston/Architect, Murat/Test Architect, Sally/UX, Amelia/Developer):

| Change | Rationale | Source |
|--------|-----------|--------|
| Removed `redactedPhrases` from all frontend types | No current consumer; creates dual-source-of-truth risk with inline `[REDACTED]` tokens | Winston, Amelia |
| Killed string fallback for badge visibility | Fallback hides backend bugs; streaming correctly doesn't show badge; prevents flicker | Winston, Amelia |
| Renamed `isRedacted` variable to `hasRedactedContent` | Avoids naming collision with new `isRedacted` prop; clarifies separate concerns | Amelia |
| Moved badge from header to content footer | Prevents false agent/moderation association; correct information hierarchy | Sally |
| Changed label from "Moderated" to "Safety Filtered" | "Moderated" has 6 ambiguous interpretations; new label is specific and clear | Sally |
| Changed tooltip copy from "Modified for Safety Compliance" to human-friendly text | Original was bureaucratic/paternalistic; new copy is transparent and clear | Sally |
| Added mobile always-visible inline explanation | Radix Tooltip is a mobile anti-pattern; always-visible text is accessible and discoverable | Sally |
| Muted badge styling from `violet-600/30` to `violet-600/20` | Reduces purple overload; badge is secondary to inline `[REDACTED]` spans | Sally |
| Removed `role="status"` from badge | Live region causes disruptive announcements during rapid message streaming | Sally |
| Moved `TooltipProvider` from DebateStream to layout level | DebateStream re-renders on every WS message; provider should be on stable ancestor | Amelia |
| Fixed CLI command from `shadcn-ui` to `shadcn` | v1 CLI deprecated; v2 is `shadcn` | Amelia |
| Added focus ring classes to badge | Keyboard focusability requires visible focus indicator | Amelia, Murat |
| Cut redundant tests (UNIT-006, UNIT-007, UNIT-008) | CSS class testing, type checking, prop-passing are testing the framework, not behavior | Murat |
| Consolidated COMP-001/002 into COMP tests | Removed duplicate "full flow" tests that tested same thing as unit tests | Murat |
| Added tooltip content correctness test | No test verified the actual tooltip text — the core transparency promise | Murat |
| Added concurrent tooltip state test | Multiple badges could show overlapping tooltips | Murat |
| Added viewport overflow E2E test | Tooltip near viewport bottom can clip | Murat |
| Added `isRedacted: true` with no `[REDACTED]` content edge case test | Backend inconsistency should be handled gracefully | Winston |
| Added placement regression test | Ensures badge stays in footer, not header | Sally |
| Clarified streaming bubble needs no `isRedacted` | Streaming messages are incomplete; badge only on complete messages | Amelia |

## Dev Agent Record

### Agent Model Used

glm-5.1 (zai-coding-plan/glm-5.1)

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- ✅ Installed `@radix-ui/react-tooltip` via `npx shadcn@latest add tooltip` — created `components/ui/tooltip.tsx`
- ✅ Added `TooltipProvider` with `delayDuration={300}` to `app/dashboard/layout.tsx` wrapping the debate feature area
- ✅ Added `isRedacted?: boolean` to `ArgumentMessage` interface in `DebateStream.tsx`
- ✅ Mapped `payload.isRedacted` in `handleArgumentComplete` to preserve the field from WebSocket payload
- ✅ Passed `isRedacted` prop from `DebateStream` to `ArgumentBubble` for complete messages (streaming bubble correctly omits it)
- ✅ Updated `ArgumentBubble`: renamed `isRedacted` variable to `hasRedactedContent`, added `isRedacted` prop, added `showBadge` logic, added ShieldIcon component, added Safety Filtered badge with desktop tooltip + mobile inline explanation
- ✅ Badge uses `violet-600/20` background (muted, subordinate to inline `[REDACTED]` purple spans)
- ✅ Desktop: Radix Tooltip with focus/hover trigger, Escape dismiss, `prefers-reduced-motion` support
- ✅ Mobile: always-visible inline explanation text (no tooltip interaction required)
- ✅ Accessibility: `aria-label` on badge, keyboard focusable with visible focus ring, no `role="status"`
- ✅ Separation of concerns: `hasRedactedContent` (string detection) for `renderContent` + content aria, `showBadge` (prop) for badge visibility
- ✅ 11 component tests in `ArgumentBubbleSafetyBadge.test.tsx` — all pass
- ✅ 5 integration tests in `DebateStreamSafetyBadge.test.tsx` — all pass
- ✅ 4 E2E tests in `debate-safety-badge.spec.ts` — written for Playwright
- ✅ Full regression suite: 208 tests pass, 0 failures
- ✅ Lint clean on all changed files

### Change Log

- 2026-04-11: Implemented Story 2.5 — Moderation Transparency (The Badge). Connected `isRedacted` data flow from WebSocket through to UI. Added Safety Filtered badge with desktop tooltip and mobile inline text. Full test coverage with 20 new tests.

### File List

**MODIFIED:**
- `trade-app/nextjs-frontend/features/debate/components/ArgumentBubble.tsx` — added `isRedacted` prop, ShieldIcon component, Safety Filtered badge with tooltip (desktop) + inline text (mobile), renamed `isRedacted` var to `hasRedactedContent`
- `trade-app/nextjs-frontend/features/debate/components/DebateStream.tsx` — added `isRedacted` to `ArgumentMessage`, mapped in `handleArgumentComplete`, passed prop to `ArgumentBubble`
- `trade-app/nextjs-frontend/app/dashboard/layout.tsx` — added `TooltipProvider` import and wrapper around section content

**NEW (via CLI):**
- `trade-app/nextjs-frontend/components/ui/tooltip.tsx` — Shadcn Tooltip component

**NEW (tests):**
- `trade-app/nextjs-frontend/tests/unit/ArgumentBubbleSafetyBadge.test.tsx` — 11 component tests for badge rendering, tooltip, accessibility, mobile pattern
- `trade-app/nextjs-frontend/tests/unit/DebateStreamSafetyBadge.test.tsx` — 5 integration tests for isRedacted data flow
- `trade-app/nextjs-frontend/tests/e2e/debate-safety-badge.spec.ts` — 4 E2E tests for badge visibility and viewport behavior
