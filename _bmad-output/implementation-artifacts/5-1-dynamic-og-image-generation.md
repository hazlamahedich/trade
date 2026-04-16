# Story 5.1: Dynamic OG Image Generation

Status: done

## Story

As a System,
I want to generate dynamic social preview images for every debate,
So that links shared on Twitter/Discord look data-rich and clickable.

## Acceptance Criteria

1. **AC-1 (Crawler OG Image):** Given a distinct debate link (`/debates/{externalId}`), when a crawler requests the page metadata, then the `og:image` tag points to a dynamically generated PNG image (1200x630) containing the debate's key data.
2. **AC-2 (Image Content):** Given the generated OG image, when rendered, then it displays:
   - Asset Name (e.g., "BTC", "ETH") — truncated to 10 chars, uppercase
   - Current/Final Winner label (Bull/Bear/Undecided)
   - Sentiment Bar visual (bull vs bear vote percentages)
   - Total vote count
3. **AC-3 (Fallback):** Given a debate that fails to load (404, network error), when the image generation is attempted, then a fallback branded placeholder image is returned (not a broken image or 500).
4. **AC-4 (Caching):** Given a completed debate, when the OG image is generated, then it is cached via ISR (`revalidate = 3600`) matching the debate detail page's existing ISR strategy.
5. **AC-5 (Twitter Card):** Given the debate detail page, when crawled by Twitter's bot, then `twitter:image` is also populated with the same dynamic image (`summary_large_image`).

## Tasks / Subtasks

> **Note (41 subtasks):** Exceeds the 30-subtask threshold from Lesson #23. This story is a single tightly-coupled deliverable (one OG image file + metadata update + tests) — splitting backend/frontend doesn't apply naturally. The tests (Tasks 7-8, 11 subtasks) could be split into a follow-up test story if needed during execution.

- [x] 1. Create `opengraph-image.tsx` route handler (AC: #1, #2, #4)
  - [x] 1.1 Create file `app/debates/[externalId]/opengraph-image.tsx`
  - [x] 1.2 Export `size = { width: 1200, height: 630 }`, `contentType = 'image/png'`, `alt = 'Debate preview image — AI Trading Debate Lab'` (NOTE: `alt` is a static string constant — Next.js file convention does NOT support dynamic alt per request)
  - [x] 1.3 Export `revalidate = DEBATE_DETAIL_ISR_REVALIDATE_SECONDS` (import from page.tsx) — ISR is file-scoped, NOT inherited from page
  - [x] 1.4 Create self-contained `fetchDebateForOG()` function — uses `getApiBaseUrl()` + direct `fetch()` with try/catch returning `null` on ANY error (NOT `getDebateDetail()` which calls `notFound()` on 404). Add `console.error('[OG Image]', error)` before returning null for production debugging (ISR caches errors for 1 hour — silent failures are expensive)
  - [x] 1.5 In default export: `await params`, call `fetchDebateForOG(externalId)`, if null return fallback `ImageResponse`, otherwise return debate `ImageResponse`. Handle active/in-progress debates: the `/result` endpoint may return partial data (no `voteBreakdown` or `completedAt`) — treat missing voteBreakdown as zero votes with winner "undecided"
  - [x] 1.6 Import `DebateDetailData` type from `features/debate/types/debate-detail.ts` (pure type import — safe)
  - [x] 1.7 Import `getApiBaseUrl` from `lib/api/config.ts` (pure utility — safe)
- [x] 2. Design OG image JSX layout (AC: #2)
  - [x] 2.1 Dark background (`#0f172a` / slate-900) to match site theme
  - [x] 2.2 Asset name in large bold text (uppercase, truncated to 10 chars to prevent overflow)
  - [x] 2.3 Winner badge/label (Bull in green `#22c55e`, Bear in red `#ef4444`, Undecided in `#94a3b8` / slate-400 — NOT slate-500 which fails contrast)
  - [x] 2.4 Sentiment bar: horizontal bar showing bull% vs bear% using inline percentage calculation (see dev notes for safe rounding)
  - [x] 2.5 Total vote count text ("123 votes") with `toLocaleString()` for large numbers
  - [x] 2.6 "AI Trading Debate Lab" branding text at bottom with 40px safe-zone padding
  - [x] 2.7 All styling via inline `style` objects only (NO Tailwind `className` — Satori does not support it)
  - [x] 2.8 Safe zone: 40px padding on all sides — content within 1120×550 area to prevent platform cropping
- [x] 3. Implement error handling / fallback (AC: #3)
  - [x] 3.1 `fetchDebateForOG()` wraps entire fetch in try/catch, returns `null` on any error (404, network, parse failure, Zod validation failure). Log error via `console.error('[OG Image]', error)` before returning null — ISR caches the fallback for 1 hour, so silent failures hide problems
  - [x] 3.2 Default export: if `fetchDebateForOG()` returns null, return a fallback `ImageResponse` with generic branding ("AI Trading Debate Lab") and no debate-specific data
  - [x] 3.3 Fallback uses the same Inter TTF fonts and dark background
  - [x] 3.4 Fallback always returns 200 with valid `image/png` — OG images must NEVER 500
- [x] 4. Update `generateMetadata` in debate detail page (AC: #1, #5)
  - [x] 4.1 Remove the `// TODO: og:image — Story 5.1` comment from `app/debates/[externalId]/page.tsx`
  - [x] 4.2 NOTE: `opengraph-image.tsx` file convention auto-generates `<meta property="og:image">` tags — NO manual `openGraph.images` needed. However, add `siteName: 'AI Trading Debate Lab'` to the existing `openGraph` config to match the landing page convention (see `app/page.tsx` lines 25-33)
  - [x] 4.3 Add `twitter` card metadata matching landing page pattern: `twitter: { card: 'summary_large_image', title, description, images: [\`/debates/\${externalId}/opengraph-image\`] }` (twitter:image is NOT auto-generated by the file convention — see `app/page.tsx` lines 34-39 for reference pattern)
- [x] 5. Font loading (AC: #2)
  - [x] 5.1 Use static Inter TTF fonts from `app/fonts/` (Inter-Regular.ttf and Inter-Bold.ttf). **VERIFY fonts are git-tracked:** run `git ls-files app/fonts/Inter-*.ttf` — if empty, the spike files were never committed and must be `git add`ed
  - [x] 5.2 Load via `readFile(join(process.cwd(), 'app/fonts/Inter-Regular.ttf'))` and `readFile(join(process.cwd(), 'app/fonts/Inter-Bold.ttf'))`
  - [x] 5.3 Pass both as `fonts` array: `[{ name: 'Inter', data: regularData, style: 'normal', weight: 400 }, { name: 'Inter', data: boldData, style: 'normal', weight: 700 }]`
  - [x] 5.4 CRITICAL: Only static (non-variable) TTF/OTF fonts work in Satori. Variable fonts (GeistVF.woff, InterVariable.ttf) crash with `Cannot read properties of undefined` — confirmed by spike. DO NOT use them.
- [x] 6. Inline utility functions (AC: #2)
  - [x] 6.1 Inline `extractVotes()` — extract bullVotes/bearVotes/undecidedVotes from `voteBreakdown` with `?? 0` defaults
  - [x] 6.2 Inline `computePercentages()` — MUST follow Lessons #10/#18: round only bullPct and undecidedPct independently, derive bearPct as complement
  - [x] 6.3 Inline `deriveWinner()` — determine bull/bear/undecided from vote counts
  - [x] 6.4 Handle `totalVotes === 0` — return `{ bullPct: 0, bearPct: 0, undecidedPct: 0 }` and winner "undecided"
- [x] 7. Unit tests (AC: all)
  - [x] 7.1 Test `fetchDebateForOG()` returns debate data for valid externalId
  - [x] 7.2 Test `fetchDebateForOG()` returns `null` on 404, network error, invalid response
  - [x] 7.3 Test fallback `ImageResponse` returned when `fetchDebateForOG()` returns null
  - [x] 7.4 Test `generateMetadata` includes `twitter` card with `card: 'summary_large_image'` and `images`
  - [x] 7.5 Test inline `computePercentages` matches `computePercentages` from `percentages.ts` — contract test with same inputs
  - [x] 7.6 Test inline `deriveWinner` matches `deriveWinner` from `structured-data.ts` — contract test
  - [x] 7.7 Edge cases: zero votes, tie votes (50/50), missing voteBreakdown keys, empty voteBreakdown, long asset name truncation
  - [x] 7.8 Test `revalidate` export equals `DEBATE_DETAIL_ISR_REVALIDATE_SECONDS`
  - [x] 7.9 Use `createMockDebateDetail` factory with presets (zeroVotes, tieVotes, bearWinner)
- [x] 8. Lint and typecheck (AC: all)
  - [x] 8.1 `npm run lint && npx tsc --noEmit` passes
  - [x] 8.2 `ruff check .` passes (no backend changes expected, but verify)

## Dev Notes

### Architecture & Technology

- **Next.js version:** This project uses **Next.js 16.0.8** (NOT 14). `params` in both page components and `opengraph-image.tsx` is a `Promise` — you MUST `await params` before accessing properties.
- **OG Image approach:** Use the **Next.js file convention** `opengraph-image.tsx` (NOT a separate Route Handler). This automatically generates `<meta property="og:image">` tags. It does NOT auto-generate `twitter:image` — that requires manual metadata in `generateMetadata` (Task 4.3).
- **ImageResponse import:** `import { ImageResponse } from 'next/og'` — works without any external dependencies. Next.js 16 bundles `@vercel/og@0.7.2` internally with Satori.
- **Satori limitations:** `ImageResponse` uses Satori internally. Only inline `style` objects work — NO `className`, NO Tailwind, NO CSS Grid, NO external stylesheets, NO CSS animations.
- **Variable fonts FAIL in Satori:** Only static (non-variable) TTF/OTF fonts work. Variable fonts (GeistVF.woff, InterVariable.ttf) crash with `Cannot read properties of undefined`. Use Inter-Regular.ttf and Inter-Bold.ttf in `app/fonts/`.
- **ISR is file-scoped:** `export const revalidate` in `opengraph-image.tsx` is independent from the page's revalidate. Must export explicitly. Import `DEBATE_DETAIL_ISR_REVALIDATE_SECONDS` from the page for consistency.
- **`opengraph-image.tsx` is a specialized Route Handler:** Supports Route Segment Config options (`revalidate`, `dynamic`, `dynamicParams`).

### Why NOT Use `getDebateDetail()` Server Action

`getDebateDetail()` calls `notFound()` on HTTP 404 (line 62). In `opengraph-image.tsx`, this triggers Next.js's `not-found.tsx` boundary instead of returning a fallback image. Use a self-contained fetch with try/catch → null.

### Why NOT Use `React.cache()` for Deduplication

`generateMetadata` and `opengraph-image.tsx` are separate render passes. `React.cache()` only deduplicates within a single render. ISR `revalidate = 3600` means the OG image fetches at most once per hour — negligible cost.

### Self-Contained Fetch Pattern

```tsx
async function fetchDebateForOG(externalId: string): Promise<DebateDetailData | null> {
  try {
    const url = `${getApiBaseUrl()}/api/debate/${encodeURIComponent(externalId)}/result?include_transcript=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.data) return null;
    return json.data as DebateDetailData;
  } catch (error) {
    console.error('[OG Image] fetch failed for', externalId, error);
    return null;
  }
}
```

**NOTE:** `AbortSignal.timeout(8000)` requires Node.js 17.3+. Next.js 16.0.8 ships with Node.js 18+, so this is safe.

### Active/In-Progress Debates

The `/api/debate/{externalId}/result` endpoint may return data for active (non-completed) debates with `status !== "completed"`. In that case, `voteBreakdown` may be empty or missing, and `completedAt` will be null. The OG image should handle this gracefully: treat missing/empty `voteBreakdown` as zero votes, winner "undecided". Do NOT return the fallback image for active debates — they have valid data to display.

### Inline Utility Functions — Contract Test Requirement

The inline `computePercentages` and `deriveWinner` functions MUST produce identical output to the shared utilities. Write **contract tests** that run the same inputs through both the inline version and the shared version, asserting equality. This prevents the inline copy from diverging (the exact class of bug documented in Lessons #10/#18 — percentage rounding bugs recurred in 4 stories).

### Existing Code to Reuse

| Utility | Location | Usage |
|---------|----------|-------|
| `getApiBaseUrl()` | `lib/api/config.ts` | Backend URL for fetch. **IMPORT directly** — pure utility, no browser deps. |
| `DebateDetailData` type | `features/debate/types/debate-detail.ts` | TypeScript interface. **IMPORT directly** — type-only import, safe. |
| `DEBATE_DETAIL_ISR_REVALIDATE_SECONDS` | `app/debates/[externalId]/page.tsx` | ISR constant (3600s). Import for cache consistency. |
| `createMockDebateDetail` factory | `tests/unit/factories/debate-detail-factory.ts` | Test data factory. |
| `computePercentages()` | `features/debate/utils/percentages.ts` | Reference for contract test. DO NOT import in OG image. |
| `deriveWinner()` | `features/debate/utils/structured-data.ts` | Reference for contract test. DO NOT import in OG image. |
| `extractVotes()` | `features/debate/api/debate-history.ts` | Reference for inline reimplementation. DO NOT import (transitive deps). |

### File Locations

| File | Action | Path |
|------|--------|------|
| OG image handler | **CREATE** | `app/debates/[externalId]/opengraph-image.tsx` |
| Debate detail page | **MODIFY** | `app/debates/[externalId]/page.tsx` — add `siteName` to openGraph, add `twitter` card, remove TODO |
| Inter-Regular.ttf | **VERIFY git-tracked** | `app/fonts/Inter-Regular.ttf` — exists on disk but spike was never committed. Run `git ls-files app/fonts/Inter-*.ttf` |
| Inter-Bold.ttf | **VERIFY git-tracked** | `app/fonts/Inter-Bold.ttf` — same as above |
| OG image tests | **CREATE** | `tests/unit/opengraph-image.test.tsx` |
| Metadata tests | **MODIFY** | `tests/unit/DebateDetail.test.tsx` — add twitter card + siteName assertions (NOTE: currently only tests utility functions, not page `generateMetadata`; will need to mock `getDebateDetail` and `notFound`) |

### Percentage Bar Rules (Lesson #10, #18 from AGENTS.md)

Only round ONE percentage independently. Derive the complement:
```
bullPct = Math.round((bullVotes / total) * 100)
undecidedPct = Math.round((undecidedVotes / total) * 100)
bearPct = Math.max(0, 100 - bullPct - undecidedPct)
```
NEVER round all percentages independently. This is a recurring bug.

### Bundle Isolation (Lesson #21)

The OG image file MUST NOT transitively pull in React Query, Zustand, WebSocket hooks, or `@xyflow/react`. Keep imports minimal — only `next/og`, `react`, `fs/promises`, `path`, `getApiBaseUrl`, and `DebateDetailData` type.

### XSS Safety (Lesson #22)

Debate data values are rendered inside Satori's JSX context (generates a PNG image), NOT HTML. XSS is not a concern here. However, the `generateMetadata` in `page.tsx` still uses `dangerouslySetInnerHTML` for JSON-LD — do NOT touch that code.

### Fonts

Static Inter TTF fonts in `app/fonts/` — `Inter-Regular.ttf` (weight 400) and `Inter-Bold.ttf` (weight 700). Load via `readFile(join(process.cwd(), 'app/fonts/Inter-Regular.ttf'))`. The `name` field in `fonts` array MUST match `fontFamily` in inline styles (`'Inter'`).

**VERIFY git tracking:** The spike added these files locally but never committed them. Run `git ls-files app/fonts/Inter-*.ttf` — if empty, `git add` both files before proceeding. Variable fonts (GeistVF.woff, InterVariable.ttf) crash Satori's font parser — DO NOT use them.

### Visual Safe Zones

Social platforms crop OG images:
- Twitter: ~20px top/bottom crop at thumbnail scale
- Discord/Slack: aggressive scale-down, bottom text unreadable

Use 40px padding on all sides. Keep critical content (asset name, winner) in top 70% of image.

### Testing Approach

Per the test design QA doc, OG image generation is categorized as: **"Unit tests for generation logic; manual E2E check."**
- Unit test the fetch logic, fallback path, percentage calculation, and metadata output.
- Contract tests: inline `computePercentages` vs shared utility, inline `deriveWinner` vs shared utility.
- Do NOT attempt to render actual PNGs in Jest (Satori doesn't run in jsdom).
- Edge cases: zero votes, tie, missing keys, empty breakdown, long asset name, active (non-completed) debates.
- Manual E2E: verify `<meta property="og:image">` exists on a running page.

**Metadata test complexity (Task 7.4):** `tests/unit/DebateDetail.test.tsx` currently tests utility functions only — NOT the page's `generateMetadata`. Testing `generateMetadata` requires importing from `app/debates/[externalId]/page.tsx` and mocking `getDebateDetail` + `notFound` from `next/navigation`. Consider extracting the twitter card config into a testable helper if mocking the page proves too complex.

### Test ID Convention

Follow existing pattern: `[P0][5.1-XXX]` prefix for story 5.1 tests.

### Project Structure Notes

- Frontend root: `trade-app/nextjs-frontend/` (all paths above are relative to this)
- Feature module pattern: `features/debate/` for debate-specific code
- Test pattern: `tests/unit/` for unit tests, `tests/unit/factories/` for test factories
- The OG image file lives in the App Router directory (`app/debates/[externalId]/`) per Next.js convention — NOT in `features/`

### Pre-Dev Spike Reference

Full spike results documented in `_bmad-output/implementation-artifacts/5-1-pre-dev-spike.md`.

### References

- [Source: epics.md#Story 5.1]
- [Source: prd.md#FR-13, FR-14]
- [Source: architecture.md#Technical Stack, API Patterns, Structure Patterns]
- [Source: app/debates/[externalId]/page.tsx — TODO on line 42]
- [Source: app/page.tsx — existing OG metadata pattern: `siteName: 'AI Trading Debate Lab'`, `twitter: { card: 'summary_large_image', images: [...] }`]
- [Source: features/debate/utils/percentages.ts — computePercentages]
- [Source: features/debate/utils/structured-data.ts — deriveWinner]
- [Source: features/debate/api/debate-history.ts — extractVotes]
- [Source: features/debate/types/debate-detail.ts — DebateDetailData interface]
- [Source: features/debate/actions/debate-detail-action.ts — getDebateDetail (NOT to be used in OG image)]
- [Source: tests/unit/factories/debate-detail-factory.ts — test factory]
- [Source: _bmad-output/test-artifacts/test-design-qa.md — OG image test strategy]
- [Source: _bmad-output/implementation-artifacts/5-1-pre-dev-spike.md — spike results]
- [Source: Epic 4 retro — "OG image generation (5.1) — satori/ImageResponse is new technology for the team. Needs spike story or pre-dev research."]
- [Next.js docs: File Convention `opengraph-image.tsx`]
- [Next.js docs: `ImageResponse` from `next/og`]
- [Satori constraints: inline styles only, no Tailwind, no CSS Grid, no variable fonts]

## Dev Agent Record

### Agent Model Used

GLM-5.1 (zai-coding-plan/glm-5.1)

### Debug Log References

- Font files `Inter-Regular.ttf` and `Inter-Bold.ttf` were on disk but not git-tracked. Ran `git add` to stage them.
- Initial test failures for metadata tests (5.1-016, 5.1-017): `jest.mock` with `"use server"` module couldn't resolve. Fixed by using `global.fetch` mocking + direct page import instead.
- Asset truncation test had wrong expected value: "VERYLONGAS" (not "VERYLONGASS") for 10-char slice of "VERYLONGASSETNAME12345".

### Completion Notes List

- Created `opengraph-image.tsx` using Next.js file convention with `ImageResponse` from `next/og`
- Implemented self-contained `fetchDebateForOG()` with try/catch, AbortSignal.timeout(8000), console.error logging
- Inline utilities (extractVotes, computePercentages, deriveWinner) follow Lessons #10/#18 for safe percentage rounding
- Fallback ImageResponse returns branded placeholder (dark bg, "AI Trading Debate Lab") when fetch fails
- JSX layout: dark theme (#0f172a), asset name (uppercase, 10-char max), winner badge, sentiment bar, vote count, branding
- Updated page.tsx: added `siteName` to openGraph, added `twitter` card with `summary_large_image`, removed TODO comment
- Font loading via static Inter TTF (NOT variable fonts which crash Satori)
- 46 unit tests pass (27 original + 19 expanded coverage): fetch logic via dynamic import, URL encoding, AbortSignal polyfill, fallback paths, null guards, module exports, contract tests, edge cases, metadata twitter card
- Full suite: 727/727 tests pass, no new lint/type errors

### File List

| File | Action | Path |
|------|--------|------|
| OG image handler | CREATED | `trade-app/nextjs-frontend/app/debates/[externalId]/opengraph-image.tsx` |
| Debate detail page | MODIFIED | `trade-app/nextjs-frontend/app/debates/[externalId]/page.tsx` |
| Inter-Regular.ttf | STAGED (git add) | `trade-app/nextjs-frontend/app/fonts/Inter-Regular.ttf` |
| Inter-Bold.ttf | STAGED (git add) | `trade-app/nextjs-frontend/app/fonts/Inter-Bold.ttf` |
| OG image tests | CREATED/MODIFIED | `trade-app/nextjs-frontend/tests/unit/opengraph-image.test.tsx` |

### Review Findings

- [x] [Review][Patch] Null guards missing on voteBreakdown/totalVotes/asset — crashes to 500 on missing or null fields (violates AC-3, constraint #7) [`opengraph-image.tsx:30-35,64,74`]
- [x] [Review][Patch] Font loading has no try/catch — ENOENT on missing fonts crashes entire OG route to 500 (violates constraint #7) [`opengraph-image.tsx:256-259`]
- [x] [Review][Patch] Transitive dependency: importing constant from page.tsx bundles React Query/Zustand/etc into OG image route (violates constraint #13) [`opengraph-image.tsx:7`]
- [x] [Review][Patch] Tests 001-004 test global.fetch mock, not fetchDebateForOG — zero coverage of URL construction, timeout, error path [`opengraph-image.test.tsx:40-80`]
- [x] [Review][Patch] Test 005 is a tautology (asserts null === null) — no function is called [`opengraph-image.test.tsx:86-90`]
- [x] [Review][Patch] toLocaleString test 013 is locale-dependent — fails in non-en-US CI [`opengraph-image.test.tsx`]
- [x] [Review][Patch] loadPageWithMock leaks global.fetch on thrown error — poisons subsequent tests [`opengraph-image.test.tsx:173-187`]
- [x] [Review][Patch] Dynamic import() may return stale cached module — needs jest.resetModules() [`opengraph-image.test.tsx:180-183`]
- [x] [Review][Defer] Undecided votes not shown in sentiment bar — spec says "bull vs bear" only, but bar visually gaps when undecidedPct > 0 [`opengraph-image.tsx:143-157`] — deferred, spec-aligned
- [x] [Review][Defer] Duplicate inline utilities risk drift from shared versions — intentional by spec design with contract tests [`opengraph-image.tsx:38-61`] — deferred, by-design with mitigation
- [x] [Review][Defer] ISR caches fallback for 1 hour on transient API error — expected ISR behavior, not a bug [`opengraph-image.tsx:12`] — deferred, expected behavior
- [x] [Review][Defer] twitter.images uses relative path — depends on metadataBase being configured [`page.tsx:55`] — deferred, verify in E2E
- [x] [Review][Defer] Bull-undecided tie (bull=40, undecided=40) breaks in bull's favor — matches shared deriveWinner behavior [`opengraph-image.tsx:58`] — deferred, consistent with shared utility

### Change Log

- 2026-04-16: Implemented dynamic OG image generation for debate pages (Story 5.1)
- 2026-04-16: Expanded test automation — 19 new tests (018-035) covering fetchDebateForOG URL construction, AbortSignal, URL encoding, null guards, module exports, bull-undecided tie edge case. Total: 46 tests.
