# Story 5.1 Pre-Dev Spike Results

Date: 2026-04-16
Status: Complete

## Spike Goals

Validate technical assumptions flagged during adversarial review of Story 5.1 (Dynamic OG Image Generation) before entering dev.

---

## Finding 1: `next/og` ImageResponse — CONFIRMED WORKING

- **Next.js 16.0.8** bundles `@vercel/og@0.7.2` internally at `next/dist/server/og/image-response.js`
- **No external dependency needed.** `import { ImageResponse } from 'next/og'` works (Next.js resolves it at build/dev time)
- `satori` and `@vercel/og` are NOT in `package.json` — they ship inside the `next` package under `dist/compiled/@vercel/og/`
- **Empirical test:** Generated a 1200×630 PNG (14,222 bytes) using the Node.js API directly

**Story impact:** Remove concern about missing dependencies. No `npm install` needed.

---

## Finding 2: GeistVF.woff FAILS in Satori — Variable Font Is the Problem

### Test Matrix

| Font | Format | Variable? | Result |
|------|--------|-----------|--------|
| No font (system default) | N/A | N/A | ✅ Works (9,299 bytes) |
| GeistVF.woff | WOFF | Yes | ❌ `Cannot read properties of undefined (reading '256')` |
| GeistVF.ttf (WOFF→TTF converted) | TTF | Yes | ❌ `Cannot read properties of undefined (reading '256')` |
| InterVariable.ttf | TTF | Yes | ❌ `Cannot read properties of undefined (reading '277')` |
| Noto Sans (bundled) | TTF | No | ✅ Works (9,441 bytes) |
| Inter-Regular.ttf (static) | TTF | No | ✅ Works |
| Inter-Bold.ttf (static) | TTF | No | ✅ Works |

### Root Cause

**The issue is variable fonts, NOT the WOFF format.** Satori's font parser (yoga-js) cannot handle variable font tables (`fvar`, `gvar`). Both WOFF and TTF wrappers of variable fonts fail identically. Only static (non-variable) TTF fonts work.

### Resolution

**Ship static Inter TTF files** alongside the existing GeistVF.woff:
- `app/fonts/Inter-Regular.ttf` — for body text (weight 400)
- `app/fonts/Inter-Bold.ttf` — for headings (weight 700)

Inter is the standard OG image font (used in Next.js docs examples). The font files are ~300KB each (acceptable for server-side only use).

**Story task change:** Replace Task 5 (font loading) with:
1. Download Inter-Regular.ttf and Inter-Bold.ttf to `app/fonts/`
2. Load via `readFile(join(process.cwd(), 'app/fonts/Inter-Regular.ttf'))`
3. Pass both as `fonts` array to `ImageResponse`

---

## Finding 3: `opengraph-image.tsx` Supports Route Segment Config — ISR Works

From Next.js docs (confirmed for v16):
> `opengraph-image` and `twitter-image` are specialized Route Handlers that can use the same route segment configuration options as Pages and Layouts.

This means `export const revalidate = 3600` works directly in `opengraph-image.tsx`.

**Story task change:** Add explicit `export const revalidate = DEBATE_DETAIL_ISR_REVALIDATE_SECONDS` in the OG image file. This is file-scoped — the page's revalidate does NOT apply to the image route automatically.

---

## Finding 4: `getDebateDetail()` Calls `notFound()` on 404 — BLOCKS OG Image

`debate-detail-action.ts:63` calls `notFound()` when the API returns 404. In `opengraph-image.tsx`, this would trigger Next.js's `not-found.tsx` boundary, NOT return a fallback image.

**Resolution:** The OG image file MUST NOT use `getDebateDetail()`. Instead, it must make its own `fetch()` call with error handling that returns a fallback `ImageResponse` on any error (404, network, parse failure).

**Story task change:** Replace Task 1.3 (React.cache wrapper) with a self-contained fetch function inside the OG image file. The fetch logic should mirror `getDebateDetail()` but with try/catch returning `null` on any error instead of throwing/calling `notFound()`.

---

## Finding 5: `React.cache()` Deduplication Will NOT Work

`generateMetadata` and `opengraph-image.tsx` are invoked as **separate render passes** by Next.js. `React.cache()` only deduplicates within a single render. The OG image must be self-contained.

**Resolution:** Remove the `React.cache()` deduplication pattern entirely. The OG image file makes its own independent fetch. ISR `revalidate = 3600` means this happens at most once per hour — the duplicate fetch cost is negligible.

**Story task change:** Remove Task 1.3 (React.cache wrapper). Replace with self-contained fetch function.

---

## Finding 6: `opengraph-image.tsx` Does NOT Auto-Generate Twitter Card

Per Next.js docs:
- `opengraph-image.tsx` generates: `<meta property="og:image">`, `<meta property="og:image:type">`, `<meta property="og:image:width">`, `<meta property="og:image:height">`
- `twitter-image.tsx` is a **separate file convention** that generates: `<meta name="twitter:image">`, etc.

For AC-5 (Twitter card), we need EITHER:
- **Option A (Recommended):** Add `twitter` metadata manually in `generateMetadata` with `card: 'summary_large_image'` and `images` pointing to the OG image URL
- **Option B:** Create a separate `twitter-image.tsx` that reuses the same logic

Option A is simpler — just add `twitter` config to `generateMetadata`. The `opengraph-image.tsx` file convention auto-wires `og:image`, and manual `twitter` metadata handles the Twitter card.

**Story task change:** Keep Task 4.3 (add twitter card metadata to generateMetadata). Task 4.2 is NOT needed — the file convention handles `og:image` automatically. But we SHOULD keep it for explicit `openGraph.images` to ensure the URL is predictable and for documentation purposes.

---

## Summary of Required Story Changes

| Original Task | Change Required | Reason |
|---------------|----------------|--------|
| Task 1.3 (React.cache) | **REMOVE** — replace with self-contained fetch | React.cache doesn't deduplicate across separate render passes |
| Task 4.2 (add openGraph.images) | **KEEP but clarify** — file convention auto-wires og:image, but explicit metadata provides documentation | Not harmful; both work together |
| Task 5 (font loading) | **REWRITE** — use static Inter TTF, not GeistVF.woff | Variable fonts fail in Satori (both WOFF and TTF wrappers) |
| New subtask | **ADD** — download Inter-Regular.ttf + Inter-Bold.ttf to `app/fonts/` | Required for Finding 2 |
| New subtask | **ADD** — self-contained fetch function with try/catch → null on error | Required for Findings 4+5 |
| Task 3 (fallback) | **CLARIFY** — fallback must use the same Inter TTF fonts | Must be a valid ImageResponse, not a static file redirect |

## Artifacts Produced

- `/tmp/og-test.png` — Test OG image generated with static Inter TTF (14,282 bytes, 1200×630 RGBA PNG)
- `/tmp/Inter-Regular.ttf` — Static Inter Regular for repo inclusion
- `/tmp/Inter-Bold.ttf` — Static Inter Bold for repo inclusion
