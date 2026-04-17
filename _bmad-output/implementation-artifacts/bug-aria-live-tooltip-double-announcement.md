# Bug: aria-live inside Radix Tooltip root causes potential SR double-announcement

**Priority:** P2 (should block release milestone)
**Discovered:** Story 5.4 party-mode implementation review (2026-04-17)
**Reporter:** Murat (Test Architect) + Amelia (Dev)
**Status:** Open

## Description

`SnapshotButton.tsx:120-122` and `ShareDebateButton.tsx:78-80` place an `aria-live="polite"` `<span>` as a sibling of `TooltipContent` inside the Radix `<Tooltip>` root element. Radix Tooltip may surface its content to screen readers via internal aria attributes, creating a scenario where the button's status text is announced twice — once by the tooltip mechanism and once by the explicit `aria-live` region.

## Affected Files

- `features/debate/components/SnapshotButton.tsx:120-122`
- `features/debate/components/ShareDebateButton.tsx:78-80`

## Pre-Existing

This pattern was introduced in `SnapshotButton` (Story 5.2) and copied to `ShareDebateButton` (Story 5.4). It is NOT a regression from Story 5.4.

## Risk Assessment

- **Impact:** Screen reader users may hear confusing duplicate announcements when button state changes (e.g., "Generating snapshot…" announced twice).
- **Likelihood:** Depends on Radix Tooltip internals + screen reader behavior. Low-medium — not all SR/AT combinations trigger this.
- **WCAG relevance:** Potential 4.1.2 (Name, Role, Value) or 1.3.1 (Info and Relationships) concern.

## Suggested Fix

Move the `aria-live` region *outside* the `<Tooltip>` root, or use `aria-hidden="true"` on the tooltip content when the live region is the authoritative announcement source. Verify with NVDA/VoiceOver testing.

## Acceptance Criteria

- [ ] Screen reader testing confirms single announcement of button state changes
- [ ] jest-axe still passes on both components
- [ ] Tooltip content still accessible on focus/hover
