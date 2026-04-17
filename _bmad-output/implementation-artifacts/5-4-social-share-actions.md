# Story 5.4: Social Share Actions

Status: party-mode-review

## Party-Mode Adversarial Review — 2026-04-17

**Participants:** Winston (Architect), Amelia (Dev), Murat (Test Architect), Sally (UX)
**Outcome:** 8 blocking changes, 5 P1 improvements, test plan revised. Consensus reached.

### Blocking Changes Applied (P0)
1. TooltipProvider crash — not in root `providers.tsx`, only in `dashboard/layout.tsx`. Fixed Task 5.
2. `navigator.clipboard` undefined guard — crashes on HTTP contexts. Fixed Task 2.
3. `isSharingRef` concurrent guard — prevents double-tap race condition. Fixed Task 2.
4. Empty-string `NEXT_PUBLIC_SITE_URL` — `.env.example` defaults to `""`, not `undefined`. Fixed Task 1.
5. `NotAllowedError` handling — missing alongside `AbortError`. Fixed Task 2.
6. Task 5 integration target wrong — `DebateDetailClientActions` exports separate named components (`BackToHistoryLink`, `WatchLiveCTA`), not a combined component. Fixed Task 5.
7. Share button differentiation — different labels, icons, and placement context to prevent confusion with 5.3's ShareButton. Fixed AC-6, Task 4.
8. "Copy manually" error must show URL — fallback toast includes the URL so user isn't stranded. Fixed AC-5.

### P1 Changes Applied
9. `trackEvent` error isolation — analytics failures never surface to user. Fixed Task 3.
10. `trackEvent` tested at unit level — assertions for event name + payload. Fixed Task 9.
11. Live vs completed share text templates — two templates by debate state. Fixed Task 1, AC-1.
12. E2E scope: clipboard path only — Playwright Chromium doesn't support Web Share API. Fixed Task 12.
13. `externalId` optional guard — disable button when undefined in DebateStream. Fixed Task 6.

### Deferred (Future Stories)
- Post-vote share prompt → Story 5.6 candidate (high value, separate UX flow)
- Silent cancel toast → polish pass (can't distinguish cancel from spec reliably)
- Desktop toast shows copied URL preview → polish pass
- Dynamic share text with vote % → future iteration
- 3 files → 2 file consolidation → withdrawn (consistency with existing pattern wins)

---

## Story

As a Mobile User,
I want to use my phone's native share sheet,
So that sharing feels natural and frictionless.

## Acceptance Criteria

1. **AC-1 (Web Share API — Mobile):** Given the "Share Debate" button on a mobile device (or any browser supporting `navigator.share`), when clicked, then it opens the native share sheet via `navigator.share({ title, text, url })` with a context-aware title and description, and the debate URL. Share text varies by debate state: live debates use `"Watch AI agents debate {ASSET} live"`, completed debates use `"See how Bull & Bear argued on {ASSET}"`.

2. **AC-2 (Clipboard Fallback — Desktop):** Given a desktop browser where `navigator.share` is unavailable, when the "Share Debate" button is clicked, then it copies the debate URL to the clipboard and shows a toast notification ("Link copied to clipboard").

3. **AC-3 (Share Button Placement — Debate Detail Page):** Given the debate detail page (`/debates/{externalId}`), when rendered, then a "Share debate" button is visible in the header area next to the existing `WatchLiveCTA` component. The page renders both CTAs inside a shared flex container with `gap-3`.

4. **AC-4 (Share Button Placement — DebateStream):** Given an active or completed debate in DebateStream, when the SnapshotButton is visible, then a "Share debate" button is also visible in the toolbar. Both buttons coexist without confusion — SnapshotButton captures an image, ShareDebateButton shares the URL. Button is disabled when `externalId` is undefined.

5. **AC-5 (Error Handling):** Given the share or clipboard operation fails (permission denied, API unavailable, browser restriction), when the user clicks "Share Debate", then a graceful toast error is shown including the debate URL so the user can manually copy it (`"Could not share. Copy this link: {url}"`) — no unhandled rejections or blank states. `AbortError` and `NotAllowedError` are handled silently (no toast).

6. **AC-6 (Accessibility):** The ShareDebateButton is fully keyboard operable (Enter/Space), has a descriptive tooltip and `aria-label` of `"Share debate"` (distinct from ShareButton's `"Share this take"` label), meets 44×44px touch target minimum, announces state via `aria-live`, and uses semantic `<button>` markup.

## Tasks / Subtasks

### Part A — Utility & Hook

- [ ] 1. Create share debate utility (AC: #1, #2)
  - [ ] 1.1 Create `features/debate/utils/share-debate.ts` — export `buildShareData(params: { assetName: string; externalId: string; debateStatus?: "active" | "completed" }): ShareData`. Share text varies by debate state: active → `"Watch AI agents debate {ASSET} live"`, completed → `"See how Bull & Bear argued on {ASSET}"`. Title: `"Bull vs Bear on {ASSET} — AI Trading Debate Lab"`. URL: `const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin` then `${baseUrl}/debates/${externalId}`. **CRITICAL:** Use `||` (not nullish coalescing) to catch empty-string `NEXT_PUBLIC_SITE_URL` — `.env.example` defaults to `""`, not `undefined`
  - [ ] 1.2 Export `buildDebateShareUrl(externalId: string): string` — returns the full debate URL string. Uses same `|| window.location.origin` fallback. Used by clipboard fallback path and error toast
  - [ ] 1.3 Export `isWebShareSupported(): boolean` — checks `typeof navigator !== "undefined" && typeof navigator.share === "function"`. Named function for testability, not inline check

- [ ] 2. Create `useShareDebate` hook (AC: #1, #2, #5)
  - [ ] 2.1 Create `features/debate/hooks/useShareDebate.ts` — accepts `{ assetName: string; externalId: string; debateStatus?: "active" | "completed" }`. Returns `{ share: () => Promise<void>; isSharing: boolean }`
  - [ ] 2.2 `share()` implementation — **concurrent-call guard first:**
    - Add `isSharingRef = useRef(false)` at hook level. At top of `share()`: `if (isSharingRef.current) return;` then `isSharingRef.current = true;` in `finally`: `isSharingRef.current = false;`. Mirrors `useSnapshot`'s `isGeneratingRef` pattern
    - Call `buildShareData()` to construct share payload
    - If `isWebShareSupported()`: call `navigator.share(data)`. Handle `AbortError` and `NotAllowedError` silently (no toast — user cancelled or permission denied). Handle other errors → `toast.error(`Could not share. Copy this link: ${url}`)`
    - Else: **guard clipboard existence** — check `navigator?.clipboard?.writeText` is a function. If missing, skip straight to error toast with URL. If present, call `navigator.clipboard.writeText(url)`. On success → `toast.success("Link copied to clipboard")`. On failure → `toast.error(`Could not copy link. Copy this link: ${url}`)`
    - Wrap entire flow in try/catch — no unhandled rejections
  - [ ] 2.3 `isSharing` state — `useState(false)`, set `true` on entry, `false` in `finally`. Used for button disabled state. **NOTE:** `isSharingRef` (boolean ref) prevents concurrent calls; `isSharing` (React state) drives UI disabled state
  - [ ] 2.4 SSR safety: all `navigator` access guarded with `typeof window !== "undefined"` checks

- [ ] 3. Add analytics events with error isolation (AC: #1, #2)
  - [ ] 3.1 Add `"debate_shared"` and `"debate_link_copied"` to `EventName` union in `features/debate/utils/analytics.ts`
  - [ ] 3.2 In `useShareDebate`, call `trackEvent({ name: "debate_shared", properties: { method: "web_share_api", external_id: externalId } })` after successful Web Share. **Wrap in own try/catch** — analytics failure must never surface to user: `try { trackEvent(...) } catch { /* intentional swallow */ }`
  - [ ] 3.3 Call `trackEvent({ name: "debate_link_copied", properties: { external_id: externalId } })` after successful clipboard copy. Same try/catch isolation
  - [ ] 3.4 Add `source` property to both events: `"debate_detail"` or `"debate_stream"` — pass `source` param from integration point

### Part B — ShareDebateButton Component

- [ ] 4. Create ShareDebateButton component (AC: #1, #2, #6)
  - [ ] 4.1 Create `features/debate/components/ShareDebateButton.tsx` — `"use client"` component. Props: `{ assetName: string; externalId: string; debateStatus?: "active" | "completed"; disabled?: boolean; className?: string }`
  - [ ] 4.2 Uses `useShareDebate({ assetName, externalId, debateStatus })` hook. Renders `<button>` (NOT `<div onClick>`) with lucide `Share2` icon. **Button differentiation from ShareButton (5.3):** ShareButton uses `Share` icon + label `"Share this take"` + anchored to ArgumentBubble. ShareDebateButton uses `Share2` icon + label `"Share debate"` + in page header/toolbar. Different icons, different labels, different placement context
  - [ ] 4.3 Icon states: `Share2` icon idle, `Loader2` with spin during `isSharing` (respects `useReducedMotion()`)
  - [ ] 4.4 Disabled during `isSharing` state OR when `disabled` prop is true (used when `externalId` is undefined in DebateStream)
  - [ ] 4.5 Tooltip via Radix `Tooltip` (`delayDuration={200}`, mobile fallback: visually hidden text). Label: `"Share debate"`. **TooltipProvider is added to root `app/providers.tsx` in Task 5.4** — ShareDebateButton does NOT need its own provider wrapper. Simply use `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent>` directly
  - [ ] 4.6 Accessibility: `aria-label="Share debate"`, `aria-busy={isSharing}`, `aria-live="polite"` on sr-only status text. 44×44px touch target (`min-h-[44px] min-w-[44px]`). Focus ring: `focus-visible:ring-2 focus-visible:ring-white/30`
  - [ ] 4.7 Styling: matches SnapshotButton's visual style for consistency (`bg-white/5 hover:bg-white/10 border border-white/15 text-slate-400 hover:text-slate-200 rounded-lg`). **Note: SnapshotButton uses `rounded-lg` (NOT `rounded-md`)** — verify by checking `SnapshotButton.tsx:97`. `border-white/15` minimum (Lesson #24)
  - [ ] 4.8 Entrance animation: `motion.button` fade-in (respects `useReducedMotion()` — `duration: 0`)

### Part C — UI Integration

- [ ] 5. Integrate ShareDebateButton into debate detail page (AC: #3)
  - [ ] 5.1 **ARCHITECTURE NOTE:** `DebateDetailClientActions.tsx` exports TWO separate named components: `BackToHistoryLink` and `WatchLiveCTA`. They are NOT combined — the page imports them individually. To add ShareDebateButton, create a new `DebateDetailActions` wrapper component in the same file that renders `WatchLiveCTA` and `ShareDebateButton` in a `flex gap-3` row. Export it alongside the existing exports
  - [ ] 5.2 New `DebateDetailActions` component: `export function DebateDetailActions({ externalId, assetName, debateStatus }: { externalId: string; assetName: string; debateStatus?: "active" | "completed" })` — renders `<div className="flex items-center gap-3">` containing `WatchLiveCTA` + `ShareDebateButton`. `debateStatus` is forwarded to ShareDebateButton for context-aware share text (AC-1). ShareDebateButton gets `source="debate_detail"` for analytics
  - [ ] 5.3 Modify `app/debates/[externalId]/page.tsx` — import `DebateDetailActions` (replacing `WatchLiveCTA` import), pass `externalId={externalId}`, `assetName={data.asset}` (the debate data object uses `asset` field — confirmed in page.tsx where `data.asset` is used for the heading), and `debateStatus={data.status}` (debate data has a `status` field). Place at line 113 (replacing the standalone `<WatchLiveCTA>`)
  - [ ] 5.4 Add `TooltipProvider` to root `app/providers.tsx` — wrap existing `QueryClientProvider` children with `<TooltipProvider>`. Import from `@/components/ui/tooltip`. This fixes the TooltipProvider crash on `/debates/[externalId]` (currently only in `dashboard/layout.tsx`)

- [ ] 6. Integrate ShareDebateButton into DebateStream (AC: #4)
  - [ ] 6.1 Modify `features/debate/components/DebateStream.tsx` — add `ShareDebateButton` in the toolbar area alongside `SnapshotButton`. Render inside the existing `absolute top-2 right-2 z-10` container, converting to a flex row with `gap-2`
  - [ ] 6.2 `ShareDebateButton` uses `assetName` and `externalId` from existing props. Pass `disabled={!externalId}` — guard against optional `externalId` (DebateStream has `externalId?: string`). Pass `source="debate_stream"` for analytics
  - [ ] 6.3 Show `ShareDebateButton` using same visibility logic as `SnapshotButton` (`showSnapshot` condition — hidden when empty or idle/error status)
  - [ ] 6.4 **CRITICAL: DebateStream is at 275 lines.** Adding ShareDebateButton should add ≤15 lines: import + component render inside existing toolbar div. If it exceeds 300 lines, extract toolbar to a separate `DebateToolbar` component

- [ ] 7. Barrel exports (AC: all)
  - [ ] 7.1 Export `ShareDebateButton` from `features/debate/components/index.ts`
  - [ ] 7.2 Export `useShareDebate` from `features/debate/hooks/index.ts`
  - [ ] 7.3 Export `buildShareData`, `buildDebateShareUrl`, `isWebShareSupported` from `features/debate/utils/index.ts`

### Part D — Tests

- [ ] 8. Unit tests — utilities (AC: #1, #2)
  - [ ] 8.1 Create `tests/unit/share-debate-utils.test.ts` — test:
    - `buildShareData` with `NEXT_PUBLIC_SITE_URL` set (full URL)
    - `buildShareData` with `NEXT_PUBLIC_SITE_URL=""` (empty string — uses `window.location.origin`)
    - `buildShareData` with `NEXT_PUBLIC_SITE_URL` undefined (uses `window.location.origin`)
    - `buildShareData` with Unicode asset names and special chars in externalId
    - `buildShareData` with `debateStatus="active"` vs `"completed"` (different share text)
    - `buildDebateShareUrl` URL construction (same `||` fallback logic)
    - `isWebShareSupported` — navigator.share present/absent, SSR guard (`typeof navigator === "undefined"`)

- [ ] 9. Unit tests — useShareDebate hook (AC: #1, #2, #5)
  - [ ] 9.1 Create `tests/unit/share-debate-hook.test.tsx` — test:
    - Web Share API success path (`navigator.share` resolves → `trackEvent("debate_shared", { method: "web_share_api" })` called, isSharing returns to false)
    - Web Share API abort (`AbortError` → no toast, silent, no trackEvent)
    - Web Share API `NotAllowedError` → no toast, silent, no trackEvent (distinct from generic error)
    - Web Share API failure (non-Abort/NotAllowed error → error toast with URL included)
    - Clipboard fallback (`navigator.share` undefined → `clipboard.writeText` → success toast + `trackEvent("debate_link_copied")`)
    - Clipboard failure (`clipboard.writeText` rejects → error toast with URL)
    - `navigator.clipboard` undefined entirely → error toast with URL (no crash)
    - `trackEvent` throws → share still succeeds (analytics isolation)
    - isSharing state transitions (false → true → false)
    - Concurrent double-click: `share()` called twice rapidly → `navigator.share`/`clipboard.writeText` called exactly once (isSharingRef guard)
    - SSR safety (no navigator crashes)
  - [ ] 9.2 Required mocks: `navigator.share`, `navigator.clipboard` (including undefined case), `toast` from sonner, `trackEvent` from analytics

- [ ] 10. Unit tests — ShareDebateButton component (AC: #6)
  - [ ] 10.1 Create `tests/unit/share-debate-button.test.tsx` — test:
    - Renders button with Share2 icon
    - Click triggers share
    - Disabled during isSharing
    - Disabled when `disabled` prop is true (externalId guard)
    - Tooltip visible on focus (keyboard accessibility — not just hover)
    - `aria-label="Share debate"` (distinct from ShareButton's `"Share this take"`)
    - `aria-busy` and `aria-live` attributes
    - 44px touch target (min-h, min-w)
    - Keyboard activation (Enter/Space)
    - `useReducedMotion` — no animation when true (duration: 0)
    - Loader2 icon rendered during isSharing (icon swap assertion)
  - [ ] 10.2 jest-axe accessibility audit on ShareDebateButton

- [ ] 11. Unit tests — integration (AC: #3, #4)
  - [ ] 11.1 Test `DebateDetailActions` wrapper renders ShareDebateButton alongside WatchLiveCTA in flex row (mount component, find button by `data-testid` or `aria-label`)
  - [ ] 11.2 Test ShareDebateButton renders in DebateStream toolbar alongside SnapshotButton
  - [ ] 11.3 Bundle isolation test — verify ShareDebateButton, useShareDebate, share-debate.ts do NOT transitively import `@tanstack/react-query`, `zustand`, `@xyflow/react`, or WebSocket hooks (use `fs.readFileSync` pattern from Story 5.2/5.3 tests). Also verify no `window` access at module scope that could break SSR

- [ ] 12. E2E tests (AC: #2)
  - [ ] 12.1 Create `tests/e2e/share-debate-flow.spec.ts` — test on debate detail page:
    - ShareDebateButton visible on debate detail page
    - **E2E SCOPE NOTE:** Playwright Chromium does NOT support `navigator.share`. E2E tests cover the **clipboard fallback path only**. Web Share API is covered by unit tests with mocked `navigator.share`
    - Click triggers clipboard copy on desktop viewport (mock clipboard.writeText if needed, verify toast)
    - Keyboard accessible (Enter key)
    - 44px touch target
    - Button coexists with BackToHistoryLink and WatchLiveCTA

- [ ] 13. Lint and typecheck (AC: all)
  - [ ] 13.1 Run `ruff check .` and fix all errors
  - [ ] 13.2 Run `npx tsc --noEmit` and fix all type errors
  - [ ] 13.3 Run `npm run lint` and fix all lint errors

## Dev Notes

### Architecture: Web Share API + Clipboard Fallback

This is the simplest share story in Epic 5. No image capture, no canvas, no html-to-image. Just:
- Mobile: `navigator.share({ title, text, url })` → native OS share sheet
- Desktop: `navigator.clipboard.writeText(url)` → toast confirmation

The Web Share API is already used in Stories 5.2 (`useSnapshot.ts`) and 5.3 (`useQuoteShare.ts`) for sharing captured image files. This story uses it for URL-only sharing (no files), which has broader browser support.

**⚠️ Dependency on Stories 5.2 and 5.3:** Both are currently in `review` status (not merged). This story copies patterns from both — `useSnapshot`'s `isGeneratingRef` concurrent guard, `AbortError`/`NotAllowedError` handling, and `SnapshotButton` styling. If either story's review changes these APIs or patterns, update all references in this story accordingly before starting implementation.

### Reuse from Previous Stories (DO NOT Reinvent)

| Artifact | Path | Reuse |
|----------|------|-------|
| `NEXT_PUBLIC_SITE_URL` env var | `.env.example` | Already added by Story 5.3 — same debate URL construction pattern |
| Web Share API patterns | `hooks/useSnapshot.ts:73-89` | Error handling pattern (AbortError → silent, NotAllowedError → fallback) |
| `isGeneratingRef` pattern | `hooks/useSnapshot.ts:19,33` | Concurrent-call guard — mirror as `isSharingRef` in useShareDebate |
| Toast pattern | `sonner` via `toast.success/error` | Already used throughout DebateStream |
| `SnapshotButton` styling | `components/SnapshotButton.tsx` | Copy visual style for consistency |
| `ShareButton` (5.3) | `components/ShareButton.tsx` | DO NOT extend — different purpose (5.3 shares quote images, this shares debate links). Separate component with distinct icon (`Share2` vs `Share`) and distinct label (`"Share debate"` vs `"Share this take"`) |
| Radix `Tooltip` pattern | `SnapshotButton.tsx`, `ShareButton.tsx` | Same `delayDuration={200}`, mobile inline fallback pattern |
| `trackEvent` | `utils/analytics.ts` | Add new event names to existing `EventName` union (currently 4 events: `debate_detail_page_viewed`, `debate_detail_cta_clicked`, `debate_detail_back_clicked`, `debate_detail_transcript_expanded`). New events: `debate_shared`, `debate_link_copied` — cross-page scope, NOT prefixed with `debate_detail_`. Wrap calls in try/catch — analytics never blocks share |
| `TooltipProvider` | NOT in root `providers.tsx` | **MUST add** to `app/providers.tsx` (Task 5.4) — wrap `<QueryClientProvider>` children with `<TooltipProvider>`. Currently only in `dashboard/layout.tsx` — debate detail route has no provider. After this fix, all pages have tooltip context. Do NOT add component-level TooltipProvider wrappers in individual components |

### Component Naming: ShareDebateButton vs ShareButton

**CRITICAL:** `ShareButton` is already used by Story 5.3 for per-argument quote sharing. This story creates `ShareDebateButton` — a different component with a different purpose:
- `ShareButton` (5.3): Per-argument, captures quote image, uses `html-to-image`, appears on ArgumentBubble, icon=`Share`, label=`"Share this take"`
- `ShareDebateButton` (5.4): Debate-level, shares URL only, no image capture, appears on page header/toolbar, icon=`Share2`, label=`"Share debate"`

Different icons + different labels + different placement context = no user confusion.

### Placement: Two Surfaces

1. **Debate Detail Page** (`/debates/{externalId}`): The primary sharing surface. Users viewing archived debates want to share the link. Added via new `DebateDetailActions` wrapper component that renders `WatchLiveCTA` + `ShareDebateButton` in a flex row. **NOTE:** `DebateDetailClientActions.tsx` exports `BackToHistoryLink` and `WatchLiveCTA` as separate named components. The new `DebateDetailActions` wrapper is a third export from the same file.

2. **DebateStream** (live debates): Secondary surface. Users watching a live debate may want to share the link. Added to the existing toolbar alongside `SnapshotButton`. **DebateStream is at 275 lines — budget is 25 lines.** Button is disabled when `externalId` is undefined (`externalId?: string` in DebateStream props).

### DebateStream Line Budget

DebateStream.tsx is at 275 lines. The 300-line hard limit (Lesson #14) allows 25 more lines. Expected additions:
- Import ShareDebateButton: +1 line
- Convert toolbar div to flex row: +2 lines
- Add ShareDebateButton render with disabled guard: +4 lines
- Total: ~7 lines — well within budget

If integration exceeds budget, extract both buttons into a `DebateToolbar` component.

### Web Share API Browser Support

| Browser | URL Sharing | Expected Path |
|---|---|---|
| Chrome Android | Yes | `navigator.share({ title, text, url })` |
| Safari iOS | Yes | `navigator.share({ title, text, url })` |
| Chrome Desktop (93+) | Yes | `navigator.share({ title, text, url })` |
| Firefox | **No** | Clipboard fallback |
| Safari Desktop | **No** (only link context) | Clipboard fallback |

URL-only sharing (no files) has broader support than file sharing used in 5.2/5.3. Firefox desktop still lacks `navigator.share`, so clipboard fallback is always needed.

**NOTE:** Chrome Desktop 93+ supports Web Share API, so desktop Chrome users will get the native share sheet, NOT clipboard fallback. This is correct behavior — native share is preferred where available.

### Clipboard API Notes

- `navigator.clipboard.writeText()` requires a secure context (HTTPS or localhost). In development (localhost), it works. In production, HTTPS is standard.
- **On HTTP (non-secure context, non-localhost):** `navigator.clipboard` is `undefined` entirely, NOT just non-functional. Guard with `navigator?.clipboard?.writeText` existence check before calling.
- `navigator.clipboard.writeText()` returns a Promise. Always `await` it.
- If clipboard API is unavailable OR fails: show error toast with the URL visible (`"Could not copy link. Copy this link: {url}"`) so user can manually select+copy.

### Share Content — Context-Aware Templates

Share text varies by debate state (party-mode review finding — generic text is "spam-folder energy"):

| State | Title | Text |
|-------|-------|------|
| Active (live) | `"Bull vs Bear on {ASSET} — AI Trading Debate Lab"` | `"Watch AI agents debate {ASSET} live"` |
| Completed | `"Bull vs Bear on {ASSET} — AI Trading Debate Lab"` | `"See how Bull & Bear argued on {ASSET}"` |
| Default (no status) | `"Bull vs Bear on {ASSET} — AI Trading Debate Lab"` | `"Check out this AI debate on {ASSET}"` |

Future enhancement (deferred): dynamic text with vote percentages, post-vote share prompt.

### Error Handling Matrix

| Error | Path | User Feedback |
|-------|------|---------------|
| `AbortError` | Web Share API user cancel | Silent — no toast |
| `NotAllowedError` | Web Share API permission denied | Silent — no toast |
| Other DOMException | Web Share API failure | `toast.error()` with URL |
| `navigator.clipboard` undefined | HTTP context / old browser | `toast.error()` with URL |
| `clipboard.writeText` rejects | Clipboard failure | `toast.error()` with URL |
| `trackEvent` throws | Analytics failure | Silent — swallowed, share still succeeds |

### Analytics Tracking

Add two new event types to `analytics.ts`:
- `"debate_shared"` — fired when Web Share API succeeds (method: "web_share_api", source: "debate_detail" | "debate_stream")
- `"debate_link_copied"` — fired when clipboard copy succeeds (source: "debate_detail" | "debate_stream")

This tracks which share method users actually use, informing future UX decisions. **All `trackEvent` calls wrapped in try/catch** — analytics failure must never surface to user.

### Component Architecture: Callback Flow

```
DebateDetailPage (Server Component)
  └── DebateDetailActions (Client Component — NEW wrapper in DebateDetailClientActions.tsx)
        │   Props: { externalId, assetName, debateStatus }
        ├── WatchLiveCTA (existing)
        └── ShareDebateButton (receives debateStatus for context-aware share text)
              └── useShareDebate (calls navigator.share or clipboard)
                    └── buildShareData / buildDebateShareUrl (utilities)

DebateStream (Client Component)
  └── Toolbar div (absolute top-2 right-2, flex gap-2)
        ├── SnapshotButton (existing)
        └── ShareDebateButton (disabled={!externalId}, uses useShareDebate hook)
```

### Project Structure Notes

New files:
```
features/debate/
  ├── components/
  │   └── ShareDebateButton.tsx        # NEW — URL share button
  ├── hooks/
  │   └── useShareDebate.ts            # NEW — Web Share / clipboard hook
  └── utils/
      └── share-debate.ts              # NEW — share data builder + URL builder
```

Modified files:
- `features/debate/components/DebateDetailClientActions.tsx` — add `DebateDetailActions` wrapper component with `externalId`, `assetName`, `debateStatus` props
- `features/debate/components/DebateStream.tsx` — add ShareDebateButton to toolbar (~7 lines)
- `app/providers.tsx` — add `TooltipProvider` wrapping `QueryClientProvider` children
- `features/debate/components/index.ts` — add ShareDebateButton + DebateDetailActions exports
- `features/debate/hooks/index.ts` — add useShareDebate export
- `features/debate/utils/index.ts` — add share-debate exports
- `features/debate/utils/analytics.ts` — add event names + source tracking
- `app/debates/[externalId]/page.tsx` — import `DebateDetailActions` (replacing `WatchLiveCTA`), pass `assetName`

### Testing Standards

- **Unit tests:** Jest 29 + RTL, tagged `[P0][5.4-XXX]` pattern
- **E2E:** Playwright, test on debate detail page (`/debates/[externalId]`). **Clipboard path only** — Playwright Chromium does NOT support Web Share API
- **Bundle isolation:** Assert no `@tanstack/react-query`, `zustand`, `@xyflow/react`, or WebSocket hook imports in ShareDebateButton, useShareDebate, share-debate.ts. Also verify no `window` access at module scope
- **Accessibility:** `jest-axe` audit on ShareDebateButton
- **Analytics isolation:** Assert `trackEvent` errors are swallowed silently and don't surface to share UX

### Critical Lessons from AGENTS.md

- **Lesson #14:** DebateStream is at 275 lines. Adding ShareDebateButton MUST keep it under 300. Expected ~7 lines.
- **Lesson #15:** Animate via Framer Motion interpolation, NOT key re-animation. Use `useReducedMotion()`.
- **Lesson #21:** ShareDebateButton must NOT transitively import React Query, Zustand, WS hooks, or `@xyflow/react`. Keep imports minimal — only `useShareDebate` hook (which uses only `navigator.share`/`navigator.clipboard` and `toast`).
- **Lesson #24:** `border-white/15` minimum, `text-slate-400` minimum. NOT `/10` or `text-slate-500`.
- **Lesson #18:** If showing any percentage data in share text, use `computePercentages()`. For this story, share text is static template — no percentage rounding needed.

### Accessibility Checklist (Mandatory)

- [ ] All animations respect `useReducedMotion()` from Framer Motion
- [ ] Dynamic content has `aria-live="polite"` regions (share status)
- [ ] Touch targets: minimum 44x44px hit area
- [ ] Contrast ratios: WCAG AA (4.5:1 normal, 3:1 large text)
- [ ] Dual-coding: info not conveyed by color alone
- [ ] Focus management: visible focus indicators, keyboard navigation. Tooltip visible on focus for keyboard users
- [ ] Semantic HTML: `<button>` not `<div onClick>`
- [ ] Share button tooltip: `delayDuration={200}`, mobile inline fallback
- [ ] `aria-label="Share debate"` (distinct from ShareButton's `"Share this take"`)

### File Locations

| File | Action | Path | Changes |
|------|--------|------|---------|
| Share debate utility | CREATED | `features/debate/utils/share-debate.ts` | buildShareData (with status templates), buildDebateShareUrl, isWebShareSupported |
| useShareDebate hook | CREATED | `features/debate/hooks/useShareDebate.ts` | Web Share + clipboard fallback hook with isSharingRef guard |
| ShareDebateButton | CREATED | `features/debate/components/ShareDebateButton.tsx` | URL share button with icon states (no component-level TooltipProvider — uses root provider from Task 5.4) |
| DebateDetailClientActions | MODIFIED | `features/debate/components/DebateDetailClientActions.tsx` | Add `DebateDetailActions` wrapper component |
| Root providers | MODIFIED | `app/providers.tsx` | Add TooltipProvider |
| DebateStream | MODIFIED | `features/debate/components/DebateStream.tsx` | Add ShareDebateButton to toolbar (~7 lines), disabled when no externalId |
| Debate detail page | MODIFIED | `app/debates/[externalId]/page.tsx` | Import DebateDetailActions, pass assetName + externalId + debateStatus (`data.asset`, `data.status`) |
| Analytics | MODIFIED | `features/debate/utils/analytics.ts` | Add debate_shared, debate_link_copied events |
| Components barrel | MODIFIED | `features/debate/components/index.ts` | Add ShareDebateButton + DebateDetailActions exports |
| Hooks barrel | MODIFIED | `features/debate/hooks/index.ts` | Add useShareDebate export |
| Utils barrel | MODIFIED | `features/debate/utils/index.ts` | Add share-debate exports |
| Unit tests — utils | CREATED | `tests/unit/share-debate-utils.test.ts` | |
| Unit tests — hook | CREATED | `tests/unit/share-debate-hook.test.tsx` | |
| Unit tests — component | CREATED | `tests/unit/share-debate-button.test.tsx` | |
| E2E tests | CREATED | `tests/e2e/share-debate-flow.spec.ts` | Clipboard path only |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 — Story 5.4]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-13 — Users can share a Debate Snapshot to social media]
- [Source: _bmad-output/implementation-artifacts/5-3-quote-sharing-flow.md — Web Share API patterns, ShareButton component (distinct from ShareDebateButton), toast patterns]
- [Source: _bmad-output/implementation-artifacts/5-2-debate-snapshot-tool.md — navigator.share + canShare + AbortError handling pattern, SnapshotButton styling]
- [Source: features/debate/hooks/useSnapshot.ts — Web Share API error handling (AbortError, NotAllowedError), isGeneratingRef concurrent guard pattern]
- [Source: features/debate/components/SnapshotButton.tsx — button styling, tooltip pattern, touch target, focus ring]
- [Source: features/debate/components/DebateDetailClientActions.tsx — exports BackToHistoryLink + WatchLiveCTA as separate named components (NOT a combined component)]
- [Source: app/debates/[externalId]/page.tsx — imports BackToHistoryLink + WatchLiveCTA individually at line 9, renders at lines 83 and 113]
- [Source: app/providers.tsx — root providers (QueryClientProvider only, NO TooltipProvider — must add)]
- [Source: features/debate/utils/analytics.ts — existing EventName union (4 events), trackEvent fires to window.dataLayer]
- [Source: AGENTS.md#Lessons #14, #15, #18, #21, #24 — line limits, animation, percentages, bundle isolation, dark mode contrast]
- [Source: Party-Mode Adversarial Review 2026-04-17 — Winston, Amelia, Murat, Sally consensus. 8 blocking + 5 P1 changes applied to this document]

## Dev Agent Record

### Agent Model Used

glm-5.1 (opencode)

### Debug Log References

### Completion Notes List

- Testarch-automate pass completed. 50 tests pass across 6 suites (was 42 across 4 suites).
- Filled 3 coverage gaps: useReducedMotion (Task 10.1), Loader2 icon swap (Task 10.1), source property in trackEvent (Task 3.4).
- New file: `tests/unit/share-debate-button-states.test.tsx` (6 tests).
- Updated: `tests/unit/share-debate-hook.test.tsx` (+2 tests for source prop).
- All ACs fully covered by automated tests. jest-axe accessibility audit passes. Bundle isolation verified.

### File List

- `tests/unit/share-debate-button-states.test.tsx` — NEW — 6 tests for useReducedMotion and isSharing state variations
- `tests/unit/share-debate-hook.test.tsx` — MODIFIED — added 2 tests for source property in trackEvent
- `_bmad-output/test-artifacts/automation-summary-story-5-4.md` — NEW — automation summary

### Review Findings

- [x] [Review][Patch] `"running"` status mismatch — Mapped `"running"` → `"active"` in `buildShareData`. Updated types in `share-debate.ts`, `useShareDebate.ts`, `ShareDebateButton.tsx`, `DebateDetailClientActions.tsx`, and `page.tsx` to accept `"running"`. Added test case.
- [x] [Review][Patch] Empty-string `assetName` passes `??` guard — Changed `??` to `||` in `DebateStream.tsx:183`.
- [x] [Review][Patch] `externalId` not URI-encoded — Added `encodeURIComponent(externalId)` in `buildDebateShareUrl`. Updated tests.
- [x] [Review][Defer] `aria-live` inside `<Tooltip>` root — potential SR double-announcement (pre-existing pattern in SnapshotButton.tsx)

### Test Review (2026-04-17)

**Quality Score**: 96/100 (A+ — Excellent)
**Report**: `_bmad-output/test-artifacts/test-reviews/test-review-story-5-4.md`

- [x] [TestReview][Fixed] Component test missing `debateStatus` prop forwarding — Added 3 tests to `share-debate-button.test.tsx` verifying hook receives `debateStatus=active/completed` and `source=debate_stream`
- [x] [TestReview][Fixed] DebateStream toolbar file-content test — Replaced with 4 rendered toolbar tests + 4 focused static contract tests in `share-debate-integration.test.tsx`
- [x] [TestReview][Fixed] Module-level mutable vars in button-states test — Consolidated 3 `let` vars into single `mockState` object in `share-debate-button-states.test.tsx`
- 59 unit tests + 5 E2E = 64 total. All passing. Zero TS/lint errors.

### Party-Mode Implementation Review (2026-04-17)

**Participants:** Winston (Architect), Amelia (Dev), Murat (Test Architect), Sally (UX)
**Outcome:** All approve — ship it. 6 changes applied, 1 bug filed.

**Verdict:** No architectural debt introduced. Component decomposition, error handling, bundle isolation all correct. Test suite production-ready at 96/100.

#### Changes Applied

- [x] [Review] `@client-only` JSDoc annotation on `share-debate.ts:getBaseUrl` and `buildDebateShareUrl` — defensive documentation for server-side import protection (Amelia)
- [x] [Review] Extracted `DebateToolbar.tsx` (45 lines) from `DebateStream.tsx` — proactive decomposition keeps DebateStream at 282 lines, 18 under 300-line hard limit (Winston)
- [x] [Review] Enhanced concurrent guard test — verifies second call doesn't surface error toast and `isSharing` returns to false (Murat)
- [x] [Review] Added disabled vs loading visual distinction tests — spinner renders in loading state, icon renders in disabled state; `disabled:opacity-50` + `disabled:cursor-not-allowed` asserted (Sally)
- [x] [Review] Updated static contract tests for `DebateToolbar` — 6 tests verify DebateStream→DebateToolbar wiring, toolbar imports both buttons, source prop, disabled guard, early return
- [x] [Review] Updated barrel exports — added `DebateToolbar` to `components/index.ts`

#### Bug Filed

- [ ] `bug-aria-live-tooltip-double-announcement.md` — P2, pre-existing in `SnapshotButton.tsx:120-122` and `ShareDebateButton.tsx:78-80`. Screen reader potential double-announcement from `aria-live` inside Radix Tooltip root. Should block release milestone. (Murat)

#### Advisory Notes (No Action Needed)

- Winston: `"running" → "active"` status mapping is fine as one-off. Extract to shared module only when 2nd+ consumer appears. Don't over-abstract.
- Murat: Bundle isolation tests (6 of 16 integration tests) are static analysis, not true integration. Report honest integration count (~10) to stakeholders.
- Winston: `TooltipProvider` at root is correct — lightweight (~2KB), needed by multiple routes. Don't make root promotion a reflex for every provider.

#### Test Counts After Review

64 unit tests + 5 E2E = 69 total. All passing. Zero TS/lint errors from changed files.
