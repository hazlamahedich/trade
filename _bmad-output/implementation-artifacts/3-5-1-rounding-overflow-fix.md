# Story 3.5.1: Rounding Overflow Fix

Status: done

## Story

As a User,
I want percentage bars that always sum to exactly 100%,
So that I can trust the data displayed on the platform.

## Acceptance Criteria

1. **AC1: Percentages Always Sum to 100** — Given any vote distribution, When percentages are calculated, Then `bullPct + bearPct + otherPct === 100` in all cases. No 99% or 101% totals.

## Tasks

- [ ] Task 1: Fix percentage calculation in SentimentReveal.tsx (AC: #1)
  - [ ] Change `bearPct` calculation from `Math.round((bearVotes / totalVotes) * 100)` to `100 - bullPct - otherPct`
  - [ ] `otherPct` remains `100 - bullPct - bearVotes` (undecided is calculated, bear is the complement)
  - [ ] Wait — since `otherPct` was already `100 - bullPct - bearPct`, the fix is: `bearPct = 100 - bullPct - otherPct` where `otherPct = Math.round((otherVotes / totalVotes) * 100)` and bear is the remainder. Actually simpler: keep `bullPct = Math.round(...)`, `otherPct = Math.round(...)` only if other > 0, then `bearPct = 100 - bullPct - otherPct`.
  - [ ] The `overflow-hidden` CSS workaround remains as safety net but should never trigger

## Dev Notes

### Current Bug

In `SentimentReveal.tsx:45-47`:
```tsx
const bullPct = totalVotes > 0 ? Math.round((bullVotes / totalVotes) * 100) : 0;
const bearPct = totalVotes > 0 ? Math.round((bearVotes / totalVotes) * 100) : 0;
const otherPct = 100 - bullPct - bearPct;
```

Two independent `Math.round` calls can sum to 99 or 101. Example: 3 votes (2 bull, 1 bear) → bullPct=67, bearPct=33, otherPct=0. But: 7 votes (5 bull, 2 bear) → bullPct=71, bearPct=29, otherPct=0 (OK). Edge case: 6 votes (3 bull, 2 bear, 1 other) → bullPct=50, bearPct=33, otherPct=17 = 100 (OK). Problem case: 33 votes (17 bull, 16 bear) → bullPct=52, bearPct=48, otherPct=0 = 100 (OK). Real problem: rounding both independently e.g. 1 bull, 1 bear, 1 other → bullPct=33, bearPct=33, otherPct=34 = 100. But 2 bull, 2 bear → bullPct=50, bearPct=50, otherPct=0 = 100. The issue is rarer but real with uneven distributions.

### Fix

```tsx
const bullPct = totalVotes > 0 ? Math.round((bullVotes / totalVotes) * 100) : 0;
const otherVotes = totalVotes - bullVotes - bearVotes;
const otherPct = otherVotes > 0 ? Math.round((otherVotes / totalVotes) * 100) : 0;
const bearPct = 100 - bullPct - otherPct;
```

`bearPct` is always the complement — guaranteed to sum to 100.

## Change Log

- 2026-04-12: Story created from Story 3.4 party-mode implementation review (consensus: John, Winston, Amelia, Murat, Sally, Bob, Mary).
